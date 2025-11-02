import React, { useEffect, useMemo, useState } from 'react';
import type { List } from './types';
import './App.css';
import type { Item } from './types';
import { MAX_DEPTH } from './types';
import { Board } from './components/Board';
import { SortableListColumn } from './components/SortableListColumn';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, KeyboardSensor } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { ListOverlay, ItemSubtreeOverlay } from './components/DragOverlayContent';
import { ListDropSlot } from './components/ListDropSlot';
import { useAuth } from './auth/useAuth';
import { useLists } from './hooks/useLists';
import { useItems } from './hooks/useItems';
import { Loading } from './components/Loading';

/**
 * Main application component that orchestrates the hierarchical todo board.
 * 
 * This component manages:
 * - Real-time data synchronization with Firebase Firestore
 * - Optimistic UI updates for responsive drag-and-drop interactions
 * - Drag-and-drop orchestration for lists and items
 * - Hierarchical item operations (indent/outdent, reparenting)
 * 
 * Key architectural decisions:
 * - Optimistic updates: UI responds immediately, then reconciles with server state
 * - Separation of concerns: Data operations delegated to hooks and services
 * - Real-time subscriptions: Firestore onSnapshot for live data updates
 */
function App() {
  // Authentication state - required for Firebase queries
  const { user, signOut } = useAuth();
  
  // Data subscriptions via custom hooks
  // These hooks manage Firestore subscriptions and provide CRUD operations
  const { lists, createList, renameList, deleteList, reorderLists, loading: listsLoading } = useLists(user?.uid);
  const [maxDepth, setMaxDepth] = useState<number>(MAX_DEPTH);
  const { items, createRootItem, createChildItem, updateItem, toggleComplete, toggleCollapse, deleteItemSubtree, reorderSiblings, reparentSubtree, loading: itemsLoading } = useItems(user?.uid, maxDepth);
  
  // Configure drag sensors: pointer (mouse/touch) and keyboard for accessibility
  // Distance constraint prevents accidental drags from small mouse movements
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  // Track currently dragged element for drag overlay display
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'list' | 'item' | null>(null);

  /**
   * Optimistic update state management
   * 
   * Optimistic updates provide immediate UI feedback before server confirmation.
   * When a user performs an action, we:
   * 1. Immediately update the UI with optimistic state
   * 2. Send the operation to the server
   * 3. Reconcile when Firestore snapshot arrives
   * 
   * This pattern ensures the UI feels responsive even with network latency.
   */
  
  // List optimistic updates
  const [optimisticListOrder, setOptimisticListOrder] = useState<string[] | null>(null); // Reordered list IDs during drag
  const [optimisticListsAdd, setOptimisticListsAdd] = useState<List[]>([]); // Temporarily added lists
  const [optimisticListsDelete, setOptimisticListsDelete] = useState<Set<string>>(new Set()); // Temporarily deleted list IDs
  
  // Item optimistic updates - discriminated union for different operation types
  type OptimisticItemChange =
    | { type: 'reorder'; listId: string; parentId: string | null; orderedIds: string[] }
    | { type: 'reparent'; itemId: string; targetListId: string; targetParentId: string | null; insertIndex?: number };
  const [optimisticItemChange, setOptimisticItemChange] = useState<OptimisticItemChange | null>(null);
  const [optimisticItemsAdd, setOptimisticItemsAdd] = useState<Item[]>([]); // Temporarily added items
  const [optimisticItemsDelete, setOptimisticItemsDelete] = useState<Set<string>>(new Set()); // Temporarily deleted item IDs (includes subtrees)

  /**
   * Helper functions for item relationships
   * These operate on the items array to find related items by hierarchy.
   */
  
  /** Find all siblings of an item (items with same parent and list) */
  const getSiblings = (it: Item, pool: Item[] = items) => {
    return pool.filter((x) => x.listId === it.listId && x.parentId === it.parentId).sort((a, b) => a.order - b.order);
  };

  /** Find all children of a parent item in a specific list */
  const getChildren = (parentId: string, listId: string, pool: Item[] = items) => {
    return pool.filter((x) => x.listId === listId && x.parentId === parentId).sort((a, b) => a.order - b.order);
  };

  /** Find an item by its ID */
  const getItemById = (id: string) => items.find((x) => x.id === id);

  /**
   * Move an item (and its subtree) to a different container (list or parent).
   * This is a wrapper around the service function that handles the complex
   * path recalculation and order updates for the entire subtree.
   */
  const moveItemToContainer = async (itemId: string, targetListId: string, targetParentId: string | null, insertIndex?: number) => {
    const item = getItemById(itemId);
    if (!item) return;
    await reparentSubtree(item.id, targetListId, targetParentId, insertIndex);
  };

  /**
   * Compute the display state for lists by applying optimistic updates.
   * 
   * This memoized computation:
   * 1. Filters out optimistically deleted lists
   * 2. Adds optimistically created lists
   * 3. Applies optimistic reordering if active
   * 
   * The result is used by the UI to show the current state including pending changes.
   */
  const displayLists = useMemo(() => {
    // Start with server state, exclude optimistically deleted lists
    const sorted = [...lists].filter((l) => !optimisticListsDelete.has(l.id)).sort((a, b) => a.order - b.order);
    // Add optimistically created lists (temporary placeholders)
    const withAdds = [...sorted, ...optimisticListsAdd];
    // Use optimistic order if available, otherwise use natural order
    const ids = optimisticListOrder ?? withAdds.map((l) => l.id);
    // Create lookup map for efficient ID-to-list mapping
    const map = new Map(withAdds.map((l) => [l.id, l] as const));
    // Return lists in the computed order
    return ids.map((id) => map.get(id)!).filter(Boolean);
  }, [lists, optimisticListOrder, optimisticListsAdd, optimisticListsDelete]);

  /**
   * Compute the display state for items by applying optimistic updates.
   * 
   * This is the most complex part of optimistic updates because items have:
   * - Hierarchical relationships (parent/child, path)
   * - Ordering among siblings
   * - List membership
   * 
   * The computation handles:
   * 1. Removing optimistically deleted items (and their descendants via path check)
   * 2. Adding optimistically created items (deduplicated by clientId)
   * 3. Applying optimistic reordering (changing order among siblings)
   * 4. Applying optimistic reparenting (moving items between containers with path recalculation)
   */
  const displayItems: Item[] = useMemo(() => {
    // Start with server snapshot, remove optimistically deleted items
    // Also remove items that are descendants of deleted items (checked via path)
    let base = items.filter((it) => !optimisticItemsDelete.has(it.id) && !it.path.some((p) => optimisticItemsDelete.has(p)));
    
    // Deduplicate optimistic additions: if server already has an item with the same clientId,
    // don't show the optimistic placeholder (prevents showing duplicate during reconciliation)
    const baseClientIds = new Set(base.map((it) => it.clientId).filter(Boolean) as string[]);
    const optimisticAdds = optimisticItemsAdd.filter((it) => !it.clientId || !baseClientIds.has(it.clientId));
    base = [...base, ...optimisticAdds];
    
    // If no optimistic change is in progress, return the base state
    if (!optimisticItemChange) return base;
    // Handle optimistic reordering: change the order of siblings
    if (optimisticItemChange.type === 'reorder') {
      const { listId, parentId, orderedIds } = optimisticItemChange;
      const next = base.slice(); // Shallow copy for mutation
      // Find all siblings in the affected group
      const sibs = next
        .filter((x) => x.listId === listId && x.parentId === parentId)
        .sort((a, b) => a.order - b.order);
      // Create lookup map
      const byId = new Map(sibs.map((s) => [s.id, s] as const));
      // Apply new order from optimistic change
      orderedIds.forEach((id, idx) => {
        const it = byId.get(id);
        if (it) it.order = idx;
      });
      return next;
    }
    // Handle optimistic reparenting: move item (and subtree) to different container
    if (optimisticItemChange.type === 'reparent') {
      const { itemId, targetListId, targetParentId, insertIndex } = optimisticItemChange;
      const source = base.find((x) => x.id === itemId);
      if (!source) return base;
      
      // Create deep copy of all items for safe mutation
      const next = base.map((it) => ({ ...it }));
      const getLocal = (id: string) => next.find((x) => x.id === id);
      
      // Find all descendants of the moved item (they all need path updates)
      const descendants = next.filter((x) => x.listId === source.listId && x.path.includes(source.id));
      
      // Calculate new path for the root item
      // Path = all ancestor IDs, so if new parent exists, path = [parent's ancestors, parent's id]
      const parent = targetParentId ? getLocal(targetParentId) : null;
      const newPath = parent ? [...parent.path, parent.id] : [];
      
      // Find new siblings in target container (exclude the item being moved)
      const targetSibs = next
        .filter((x) => x.listId === targetListId && x.parentId === targetParentId && x.id !== source.id)
        .sort((a, b) => a.order - b.order);
      // Calculate insert position (clamp to valid range)
      const idx = insertIndex === undefined ? targetSibs.length : Math.min(Math.max(insertIndex, 0), targetSibs.length);
      
      // Find old siblings in source container (for reordering after removal)
      const oldSibs = next
        .filter((x) => x.listId === source.listId && x.parentId === source.parentId && x.id !== source.id)
        .sort((a, b) => a.order - b.order);

      // Update the root item being moved
      const root = getLocal(source.id)!;
      root.listId = targetListId;
      root.parentId = targetParentId;
      root.path = newPath;
      root.order = idx;

      // Update all descendants: they move to the same list and get new path prefix
      // The path structure is preserved: [new ancestors] + [old path suffix after root]
      const newPrefix = [...newPath, root.id];
      for (const d of descendants) {
        const local = getLocal(d.id)!;
        // Find where the root appears in the descendant's path to extract suffix
        const idIdx = local.path.indexOf(root.id);
        const suffix = idIdx >= 0 ? local.path.slice(idIdx + 1) : [];
        local.listId = targetListId;
        local.path = [...newPrefix, ...suffix];
      }

      // Reindex items in target container: insert root at position idx
      const withInserted = [
        ...targetSibs.slice(0, idx),
        root,
        ...targetSibs.slice(idx),
      ];
      withInserted.forEach((s, i) => { const local = getLocal(s.id)!; local.order = i; });

      // Reindex items in source container: remove root, compact order
      oldSibs.forEach((s, i) => { const local = getLocal(s.id)!; local.order = i; });

      return next;
    }
    return base;
  }, [items, optimisticItemChange, optimisticItemsAdd, optimisticItemsDelete]);

  /**
   * Reconciliation effects: Clear optimistic state when server confirms changes
   * 
   * When Firestore sends a snapshot that matches our optimistic update, we clear
   * the optimistic state to avoid showing duplicate or incorrect data.
   * This ensures the UI eventually matches server state.
   */
  
  // Reconcile list reordering: clear when server order matches optimistic order
  useEffect(() => {
    if (optimisticListOrder) {
      const currentIds = [...lists].sort((a, b) => a.order - b.order).map((l) => l.id);
      // If server state matches optimistic state, clear the optimistic update
      if (JSON.stringify(currentIds) === JSON.stringify(optimisticListOrder)) {
        setOptimisticListOrder(null);
      }
    }
  }, [lists, optimisticListOrder]);

  // Reconcile item operations: clear when server state confirms the change
  useEffect(() => {
    if (!optimisticItemChange) return;
    if (optimisticItemChange.type === 'reorder') {
      // Check if server order matches optimistic order
      const { listId, parentId, orderedIds } = optimisticItemChange;
      const currentIds = items
        .filter((x) => x.listId === listId && x.parentId === parentId)
        .sort((a, b) => a.order - b.order)
        .map((x) => x.id);
      if (JSON.stringify(currentIds) === JSON.stringify(orderedIds)) {
        setOptimisticItemChange(null);
      }
    } else if (optimisticItemChange.type === 'reparent') {
      // Check if server shows item in target location
      const { itemId, targetListId, targetParentId } = optimisticItemChange;
      const it = items.find((x) => x.id === itemId);
      if (it && it.listId === targetListId && it.parentId === targetParentId) {
        setOptimisticItemChange(null);
      }
    }
  }, [items, optimisticItemChange]);

  // Reconcile list deletes: remove IDs from optimistic set if they no longer exist in server
  useEffect(() => {
    if (optimisticListsDelete.size === 0) return;
    const existingIds = new Set(lists.map((l) => l.id));
    // Keep only IDs that still exist (in case delete failed or was reverted)
    const next = new Set(Array.from(optimisticListsDelete).filter((id) => existingIds.has(id)));
    if (next.size !== optimisticListsDelete.size) setOptimisticListsDelete(next);
  }, [lists, optimisticListsDelete]);

  // Reconcile list creates: remove optimistic placeholders once server has the real item
  useEffect(() => {
    if (optimisticListsAdd.length === 0) return;
    const clientIds = new Set(lists.map((l) => l.clientId).filter(Boolean) as string[]);
    // Keep only placeholders whose clientId hasn't appeared in server yet
    const remaining = optimisticListsAdd.filter((l) => !l.clientId || !clientIds.has(l.clientId));
    if (remaining.length !== optimisticListsAdd.length) setOptimisticListsAdd(remaining);
  }, [lists, optimisticListsAdd]);

  /**
   * Action handlers with optimistic updates
   * 
   * These handlers follow the optimistic update pattern:
   * 1. Generate a unique clientId for deduplication
   * 2. Add optimistic placeholder to UI immediately
   * 3. Create the item on server
   * 4. Remove placeholder once server confirms (via reconciliation effects)
   */
  
  /** Create a new list with optimistic placeholder */
  const addList = async () => {
    // Generate unique clientId for deduplication during reconciliation
    const clientId = `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const tempId = `temp-list-${Date.now()}`;
    // Create placeholder that matches List type structure
    const placeholder: List = { id: tempId, clientId, title: 'New List', order: displayLists.length };
    // Show placeholder immediately in UI
    setOptimisticListsAdd((prev) => [...prev, placeholder]);
    try {
      // Create on server (hook will handle Firestore operation)
      await createList('New List', clientId);
    } finally {
      // Remove placeholder - reconciliation effect will handle if server hasn't confirmed yet
      setOptimisticListsAdd((prev) => prev.filter((l) => l.clientId !== clientId));
    }
  };

  /** Create a new root-level item in a list with optimistic placeholder */
  const addRootItem = async (listId: string) => {
    // Find siblings to determine insertion order
    const siblings = displayItems.filter((x) => x.listId === listId && x.parentId === null).sort((a, b) => a.order - b.order);
    const clientId = `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const tempId = `temp-item-${Date.now()}`;
    // Root item has parentId=null, path=[], order=siblings.length (append to end)
    const placeholder: Item = { id: tempId, clientId, title: 'New task', completed: false, collapsed: false, listId, parentId: null, path: [], order: siblings.length };
    setOptimisticItemsAdd((prev) => [...prev, placeholder]);
    try {
      await createRootItem(listId, 'New task', clientId);
    } finally {
      setOptimisticItemsAdd((prev) => prev.filter((it) => it.clientId !== clientId));
    }
  };

  /** Create a new child item with optimistic placeholder */
  const addChild = async (parentId: string) => {
    const parent = displayItems.find((x) => x.id === parentId);
    if (!parent) return;
    // Find existing children to determine insertion order
    const children = displayItems.filter((x) => x.listId === parent.listId && x.parentId === parent.id).sort((a, b) => a.order - b.order);
    const clientId = `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const tempId = `temp-item-${Date.now()}`;
    // Child item: parentId=parent.id, path=[...parent.path, parent.id]
    const placeholder: Item = { id: tempId, clientId, title: 'New subtask', completed: false, collapsed: false, listId: parent.listId, parentId: parent.id, path: [...parent.path, parent.id], order: children.length };
    setOptimisticItemsAdd((prev) => [...prev, placeholder]);
    try {
      await createChildItem(parentId, 'New subtask', clientId);
    } finally {
      setOptimisticItemsAdd((prev) => prev.filter((it) => it.clientId !== clientId));
    }
  };

  /** Update item title inline (no optimistic update needed for simple text changes) */
  const changeTitle = (itemId: string, title: string) => { void updateItem(itemId, { title }); };

  /** Delete an item and its entire subtree with optimistic update */
  const deleteItem = (itemId: string) => {
    // Add to optimistic delete set immediately (includes subtree via path check in displayItems)
    setOptimisticItemsDelete((prev) => new Set([...Array.from(prev), itemId]));
    // Service will handle cascade deletion of descendants in Firestore
    void deleteItemSubtree(itemId);
  };

  /**
   * Hierarchy manipulation handlers
   * These allow users to reorder and reparent items via keyboard shortcuts or buttons.
   */
  
  /** Move item up in sibling order (swap with previous sibling) */
  const moveUp = (itemId: string) => {
    const target = items.find((x) => x.id === itemId);
    if (!target) return;
    const siblings = getSiblings(target);
    const idx = siblings.findIndex((s) => s.id === itemId);
    if (idx <= 0) return; // Already at top or not found
    // Swap with previous sibling
    const orderedIds = siblings.map((s) => s.id);
    const tmp = orderedIds[idx - 1];
    orderedIds[idx - 1] = orderedIds[idx];
    orderedIds[idx] = tmp;
    void reorderSiblings(target.listId, target.parentId, orderedIds);
  };

  /** Move item down in sibling order (swap with next sibling) */
  const moveDown = (itemId: string) => {
    const target = items.find((x) => x.id === itemId);
    if (!target) return;
    const siblings = getSiblings(target);
    const idx = siblings.findIndex((s) => s.id === itemId);
    if (idx === -1 || idx >= siblings.length - 1) return; // Already at bottom or not found
    // Swap with next sibling
    const orderedIds = siblings.map((s) => s.id);
    const tmp = orderedIds[idx + 1];
    orderedIds[idx + 1] = orderedIds[idx];
    orderedIds[idx] = tmp;
    void reorderSiblings(target.listId, target.parentId, orderedIds);
  };

  /**
   * Indent item: make it a child of its previous sibling
   * This increases the depth of the item by one level.
   */
  const indent = (itemId: string) => {
    const target = items.find((x) => x.id === itemId);
    if (!target) return;
    const siblings = getSiblings(target);
    const idx = siblings.findIndex((s) => s.id === itemId);
    if (idx <= 0) return; // Need a previous sibling to become parent
    const newParent = siblings[idx - 1];
    // Calculate new depth: parent's depth + 1
    const newDepth = newParent.path.length + 2; // path.length + 1 = parent depth, +1 for new item
    if (newDepth > maxDepth) return; // Respect maximum depth constraint
    // Move target to be a child of previous sibling (insertIndex undefined = append)
    void reparentSubtree(target.id, target.listId, newParent.id, undefined);
  };

  /**
   * Outdent item: make it a sibling of its parent (move up one level)
   * The item is inserted right after its parent in the grandparent's children.
   */
  const outdent = (itemId: string) => {
    const target = items.find((x) => x.id === itemId);
    if (!target || !target.parentId) return; // Already at root level
    const parent = items.find((x) => x.id === target.parentId)!;
    const grandParentId = parent.parentId;
    // Find where parent appears among grandparent's children (or root items if no grandparent)
    const newSiblings = (grandParentId 
      ? getChildren(grandParentId, target.listId) 
      : items.filter((x) => x.listId === target.listId && x.parentId === null)
    ).sort((a, b) => a.order - b.order);
    // Insert target right after parent
    const parentIndex = newSiblings.findIndex((s) => s.id === parent.id);
    const insertIndex = parentIndex >= 0 ? parentIndex + 1 : newSiblings.length;
    // Move target to be a sibling of its parent
    void reparentSubtree(target.id, target.listId, grandParentId ?? null, insertIndex);
  };

  /**
   * Drag-and-drop event handlers
   * 
   * These handlers orchestrate drag operations for both lists and items.
   * They determine what type of operation to perform (reorder vs reparent) based on
   * where the item is dropped, and apply optimistic updates immediately.
   */
  
  /** Called when drag starts: track which element is being dragged for overlay display */
  const onDragStart = (event: any) => {
    const { active } = event;
    // Store active element ID and type for drag overlay rendering
    setActiveId(String(active.id));
    const type = active?.data?.current?.type as 'list' | 'item' | undefined;
    setActiveType(type ?? null);
    // DragOverlay component will render preview based on activeId and activeType
  };

  /**
   * Called when drag ends: determine operation type and apply changes
   * 
   * This handler processes different drop scenarios:
   * - List reordering: horizontal movement between lists
   * - Item reordering: movement within same sibling group
   * - Item reparenting: movement between containers (different parents/lists)
   */
  const onDragEnd = (event: any) => {
    const { active, over } = event;
    // If dropped outside valid drop target, cancel drag
    if (!over) {
      setActiveId(null);
      setActiveType(null);
      return;
    }

    const type = active?.data?.current?.type as 'list' | 'item' | undefined;
    
    // Handle list reordering (horizontal movement)
    if (type === 'list') {
      const ordered = displayLists; // Use display order which includes optimistic updates
      const oldIndex = ordered.findIndex((l) => l.id === active.id);
      const overData = over.data?.current;
      
      // If dropped on a drop slot between lists
      if (overData?.type === 'list-slot') {
        const slotIndex = overData.index as number;
        if (oldIndex !== -1) {
          // Calculate target index (adjust if dragging from left to right)
          const toIndex = oldIndex < slotIndex ? slotIndex - 1 : slotIndex;
          if (toIndex !== oldIndex) {
            // Compute new order using arrayMove utility
            const movedIds = arrayMove(ordered.map((l) => l.id), oldIndex, toIndex);
            setOptimisticListOrder(movedIds); // Apply optimistic update immediately
            void reorderLists(movedIds); // Update server
          }
        }
      } else {
        // If dropped on another list, use that list's index
        const newIndex = ordered.findIndex((l) => l.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const movedIds = arrayMove(ordered.map((l) => l.id), oldIndex, newIndex);
          setOptimisticListOrder(movedIds);
          void reorderLists(movedIds);
        }
      }
    }
    // Handle item operations (reorder or reparent)
    if (type === 'item') {
      const activeData = active.data.current;
      const overData = over.data.current;
      
      // Scenario 1: Dropped over a container drop zone (empty area in list/parent)
      // This reparents the item to that container
      if (overData?.type === 'container') {
        const targetListId = overData.listId as string;
        const targetParentId = (overData.parentId as string | null) ?? null;
        // Append to end of container (insertIndex undefined)
        setOptimisticItemChange({ type: 'reparent', itemId: String(active.id), targetListId, targetParentId, insertIndex: undefined });
        void moveItemToContainer(String(active.id), targetListId, targetParentId, undefined);
      } 
      // Scenario 2: Dropped on a visible drop slot between items
      // This reparents to the slot's container at a specific index
      else if (overData?.type === 'slot') {
        const targetListId = overData.listId as string;
        const targetParentId = (overData.parentId as string | null) ?? null;
        const index = overData.index as number;
        setOptimisticItemChange({ type: 'reparent', itemId: String(active.id), targetListId, targetParentId, insertIndex: index });
        void moveItemToContainer(String(active.id), targetListId, targetParentId, index);
      } 
      // Scenario 3: Dropped over another item
      // Determine if this is reordering (same parent) or reparenting (different parent)
      else {
        const activeParent = (activeData?.parentId as string | null) ?? null;
        const targetParent = (overData?.parentId as string | null) ?? null;
        const listId = activeData?.listId as string | undefined;
        if (!listId) {
          setActiveId(null);
          return;
        }
        
        // If both items have the same parent, this is a reorder operation
        if (activeParent === targetParent) {
          // Find siblings and swap positions
          const siblings = displayItems
            .filter((x) => x.listId === listId && x.parentId === activeParent)
            .sort((a, b) => a.order - b.order);
          const oldIndex = siblings.findIndex((s) => s.id === active.id);
          const newIndex = siblings.findIndex((s) => s.id === over.id);
          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            const orderedIds = arrayMove(siblings, oldIndex, newIndex).map((s) => s.id);
            setOptimisticItemChange({ type: 'reorder', listId, parentId: activeParent, orderedIds });
            void reorderSiblings(listId, activeParent, orderedIds);
          }
        } 
        // Different parents: reparent the item to target's parent
        // Insert at the position where the target item appears
        else {
          const targetSiblings = displayItems
            .filter((x) => x.listId === listId && x.parentId === targetParent)
            .sort((a, b) => a.order - b.order);
          const insertIndex = targetSiblings.findIndex((s) => s.id === over.id);
          const idx = insertIndex < 0 ? undefined : insertIndex;
          setOptimisticItemChange({ type: 'reparent', itemId: String(active.id), targetListId: listId, targetParentId: targetParent, insertIndex: idx });
          void moveItemToContainer(String(active.id), listId, targetParent, idx);
        }
      }
    }

    setActiveId(null);
    setActiveType(null);
  };

  return (
    <div className="flex flex-col min-h-screen w-full">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-900">
      <div>
          <h1 className="m-0 text-[18px]">Hierarchical Todos</h1>
          <p className="m-0 text-sm text-slate-400 mt-1">Drag tasks and lists around to reorder and reorganize them</p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 text-sm text-slate-300" title="Maximum depth for nesting">
              <span>Max depth</span>
              <input
                type="number"
                min={1}
                max={12}
                value={maxDepth}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) setMaxDepth(Math.max(1, Math.min(12, v)));
                }}
                className="input w-[72px] px-2 py-1"
                aria-describedby="max-depth-help"
              />
            </label>
            <span id="max-depth-help" className="text-xs text-slate-500">
              existing tasks above the maximum depth will not be deleted
            </span>
          </div>
          <button className="btn" onClick={addList}>+ New List</button>
          <button className="btn" onClick={() => void signOut()}>Sign out</button>
      </div>
      </header>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} autoScroll>
        {listsLoading || itemsLoading ? (
          <div className="flex min-h-[calc(100vh-56px)] items-center justify-center">
            <Loading label="Loading your board…" />
      </div>
        ) : (
          <>
            <Board>
              <SortableContext items={displayLists.map((l) => l.id)} strategy={horizontalListSortingStrategy}>
                <ListDropSlot key="slot-0" index={0} />
                {displayLists.map((list, i) => (
                  <React.Fragment key={`list-wrap-${list.id}`}>
                    <SortableListColumn
                      list={list}
                      items={displayItems}
                      allLists={displayLists}
                      maxDepth={maxDepth}
                      onAddRootItem={addRootItem}
                      onAddChild={addChild}
                      onToggleComplete={toggleComplete}
                      onToggleCollapse={toggleCollapse}
                      onChangeTitle={changeTitle}
                      onDeleteItem={deleteItem}
                      onMoveUp={moveUp}
                      onMoveDown={moveDown}
                      onIndent={indent}
                      onOutdent={outdent}
                      onRenameList={renameList}
                      onDeleteList={deleteList}
                    />
                    <ListDropSlot key={`slot-${i + 1}`} index={i + 1} />
                  </React.Fragment>
                ))}
              </SortableContext>
            </Board>
          </>
        )}
        <DragOverlay>
          {activeId && activeType === 'list' ? (
            (() => {
              const list = lists.find((l) => l.id === activeId);
              if (!list) return null;
              const listItems = items.filter((it) => it.listId === list.id);
              return <ListOverlay list={list} items={listItems} allLists={lists} maxDepth={maxDepth} />;
            })()
          ) : activeId && activeType === 'item' ? (
            (() => {
              const item = items.find((it) => it.id === activeId);
              if (!item) return null;
              const listItems = items.filter((x) => x.listId === item.listId);
              return <ItemSubtreeOverlay root={item} items={listItems} />;
            })()
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

export default App;
