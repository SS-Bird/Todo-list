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

function App() {
  const { user, signOut } = useAuth();
  const { lists, createList, renameList, deleteList, reorderLists, loading: listsLoading } = useLists(user?.uid);
  const [maxDepth, setMaxDepth] = useState<number>(MAX_DEPTH);
  const { items, createRootItem, createChildItem, updateItem, toggleComplete, toggleCollapse, deleteItemSubtree, reorderSiblings, reparentSubtree, loading: itemsLoading } = useItems(user?.uid, maxDepth);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'list' | 'item' | null>(null);

  // Optimistic overlays
  const [optimisticListOrder, setOptimisticListOrder] = useState<string[] | null>(null);
  const [optimisticListsAdd, setOptimisticListsAdd] = useState<List[]>([]);
  const [optimisticListsDelete, setOptimisticListsDelete] = useState<Set<string>>(new Set());
  type OptimisticItemChange =
    | { type: 'reorder'; listId: string; parentId: string | null; orderedIds: string[] }
    | { type: 'reparent'; itemId: string; targetListId: string; targetParentId: string | null; insertIndex?: number };
  const [optimisticItemChange, setOptimisticItemChange] = useState<OptimisticItemChange | null>(null);
  const [optimisticItemsAdd, setOptimisticItemsAdd] = useState<Item[]>([]);
  const [optimisticItemsDelete, setOptimisticItemsDelete] = useState<Set<string>>(new Set());

  // helper: siblings and descendants

  const getSiblings = (it: Item, pool: Item[] = items) => {
    return pool.filter((x) => x.listId === it.listId && x.parentId === it.parentId).sort((a, b) => a.order - b.order);
  };

  const getChildren = (parentId: string, listId: string, pool: Item[] = items) => {
    return pool.filter((x) => x.listId === listId && x.parentId === parentId).sort((a, b) => a.order - b.order);
  };

  const getItemById = (id: string) => items.find((x) => x.id === id);

  // depth and subtree calculations handled server-side in services

  const moveItemToContainer = async (itemId: string, targetListId: string, targetParentId: string | null, insertIndex?: number) => {
    const item = getItemById(itemId);
    if (!item) return;
    await reparentSubtree(item.id, targetListId, targetParentId, insertIndex);
  };

  // Derive display lists with optimistic overlay
  const displayLists = useMemo(() => {
    const sorted = [...lists].filter((l) => !optimisticListsDelete.has(l.id)).sort((a, b) => a.order - b.order);
    const withAdds = [...sorted, ...optimisticListsAdd];
    const ids = optimisticListOrder ?? withAdds.map((l) => l.id);
    const map = new Map(withAdds.map((l) => [l.id, l] as const));
    return ids.map((id) => map.get(id)!).filter(Boolean);
  }, [lists, optimisticListOrder, optimisticListsAdd, optimisticListsDelete]);

  // Apply optimistic item change to build display items
  const displayItems: Item[] = useMemo(() => {
    // Start with snapshot, apply optimistic deletes/adds
    let base = items.filter((it) => !optimisticItemsDelete.has(it.id) && !it.path.some((p) => optimisticItemsDelete.has(p)));
    // avoid duplicate by clientId
    const baseClientIds = new Set(base.map((it) => it.clientId).filter(Boolean) as string[]);
    const optimisticAdds = optimisticItemsAdd.filter((it) => !it.clientId || !baseClientIds.has(it.clientId));
    base = [...base, ...optimisticAdds];
    if (!optimisticItemChange) return base;
    if (optimisticItemChange.type === 'reorder') {
      const { listId, parentId, orderedIds } = optimisticItemChange;
      const next = base.slice();
      const sibs = next
        .filter((x) => x.listId === listId && x.parentId === parentId)
        .sort((a, b) => a.order - b.order);
      const byId = new Map(sibs.map((s) => [s.id, s] as const));
      orderedIds.forEach((id, idx) => {
        const it = byId.get(id);
        if (it) it.order = idx;
      });
      return next;
    }
    if (optimisticItemChange.type === 'reparent') {
      const { itemId, targetListId, targetParentId, insertIndex } = optimisticItemChange;
      const source = base.find((x) => x.id === itemId);
      if (!source) return base;
      const next = base.map((it) => ({ ...it }));
      const getLocal = (id: string) => next.find((x) => x.id === id);
      const descendants = next.filter((x) => x.listId === source.listId && x.path.includes(source.id));
      // prevent cycles visually not required here; assume already validated
      const parent = targetParentId ? getLocal(targetParentId) : null;
      const newPath = parent ? [...parent.path, parent.id] : [];
      // new siblings
      const targetSibs = next
        .filter((x) => x.listId === targetListId && x.parentId === targetParentId && x.id !== source.id)
        .sort((a, b) => a.order - b.order);
      const idx = insertIndex === undefined ? targetSibs.length : Math.min(Math.max(insertIndex, 0), targetSibs.length);
      // old siblings
      const oldSibs = next
        .filter((x) => x.listId === source.listId && x.parentId === source.parentId && x.id !== source.id)
        .sort((a, b) => a.order - b.order);

      // update root
      const root = getLocal(source.id)!;
      root.listId = targetListId;
      root.parentId = targetParentId;
      root.path = newPath;
      root.order = idx;

      // update descendants
      const newPrefix = [...newPath, root.id];
      for (const d of descendants) {
        const local = getLocal(d.id)!;
        const idIdx = local.path.indexOf(root.id);
        const suffix = idIdx >= 0 ? local.path.slice(idIdx + 1) : [];
        local.listId = targetListId;
        local.path = [...newPrefix, ...suffix];
      }

      // reindex target container
      const withInserted = [
        ...targetSibs.slice(0, idx),
        root,
        ...targetSibs.slice(idx),
      ];
      withInserted.forEach((s, i) => { const local = getLocal(s.id)!; local.order = i; });

      // reindex source container
      oldSibs.forEach((s, i) => { const local = getLocal(s.id)!; local.order = i; });

      return next;
    }
    return base;
  }, [items, optimisticItemChange, optimisticItemsAdd, optimisticItemsDelete]);

  // Reconcile optimistic overlays when snapshots reflect changes
  useEffect(() => {
    if (optimisticListOrder) {
      const currentIds = [...lists].sort((a, b) => a.order - b.order).map((l) => l.id);
      if (JSON.stringify(currentIds) === JSON.stringify(optimisticListOrder)) {
        setOptimisticListOrder(null);
      }
    }
  }, [lists, optimisticListOrder]);

  useEffect(() => {
    if (!optimisticItemChange) return;
    if (optimisticItemChange.type === 'reorder') {
      const { listId, parentId, orderedIds } = optimisticItemChange;
      const currentIds = items
        .filter((x) => x.listId === listId && x.parentId === parentId)
        .sort((a, b) => a.order - b.order)
        .map((x) => x.id);
      if (JSON.stringify(currentIds) === JSON.stringify(orderedIds)) {
        setOptimisticItemChange(null);
      }
    } else if (optimisticItemChange.type === 'reparent') {
      const { itemId, targetListId, targetParentId } = optimisticItemChange;
      const it = items.find((x) => x.id === itemId);
      if (it && it.listId === targetListId && it.parentId === targetParentId) {
        setOptimisticItemChange(null);
      }
    }
  }, [items, optimisticItemChange]);

  // Reconcile optimistic list deletes once snapshot reflects
  useEffect(() => {
    if (optimisticListsDelete.size === 0) return;
    const existingIds = new Set(lists.map((l) => l.id));
    const next = new Set(Array.from(optimisticListsDelete).filter((id) => existingIds.has(id)));
    if (next.size !== optimisticListsDelete.size) setOptimisticListsDelete(next);
  }, [lists, optimisticListsDelete]);

  // Reconcile optimistic list creates once snapshot with clientId exists
  useEffect(() => {
    if (optimisticListsAdd.length === 0) return;
    const clientIds = new Set(lists.map((l) => l.clientId).filter(Boolean) as string[]);
    const remaining = optimisticListsAdd.filter((l) => !l.clientId || !clientIds.has(l.clientId));
    if (remaining.length !== optimisticListsAdd.length) setOptimisticListsAdd(remaining);
  }, [lists, optimisticListsAdd]);

  const addList = async () => {
    const clientId = `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const tempId = `temp-list-${Date.now()}`;
    const placeholder: List = { id: tempId, clientId, title: 'New List', order: displayLists.length };
    setOptimisticListsAdd((prev) => [...prev, placeholder]);
    try {
      await createList('New List', clientId);
    } finally {
      setOptimisticListsAdd((prev) => prev.filter((l) => l.clientId !== clientId));
    }
  };

  // rename/delete wired directly via props below

  const addRootItem = async (listId: string) => {
    const siblings = displayItems.filter((x) => x.listId === listId && x.parentId === null).sort((a, b) => a.order - b.order);
    const clientId = `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const tempId = `temp-item-${Date.now()}`;
    const placeholder: Item = { id: tempId, clientId, title: 'New task', completed: false, collapsed: false, listId, parentId: null, path: [], order: siblings.length };
    setOptimisticItemsAdd((prev) => [...prev, placeholder]);
    try {
      await createRootItem(listId, 'New task', clientId);
    } finally {
      setOptimisticItemsAdd((prev) => prev.filter((it) => it.clientId !== clientId));
    }
  };

  const addChild = async (parentId: string) => {
    const parent = displayItems.find((x) => x.id === parentId);
    if (!parent) return;
    const children = displayItems.filter((x) => x.listId === parent.listId && x.parentId === parent.id).sort((a, b) => a.order - b.order);
    const clientId = `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const tempId = `temp-item-${Date.now()}`;
    const placeholder: Item = { id: tempId, clientId, title: 'New subtask', completed: false, collapsed: false, listId: parent.listId, parentId: parent.id, path: [...parent.path, parent.id], order: children.length };
    setOptimisticItemsAdd((prev) => [...prev, placeholder]);
    try {
      await createChildItem(parentId, 'New subtask', clientId);
    } finally {
      setOptimisticItemsAdd((prev) => prev.filter((it) => it.clientId !== clientId));
    }
  };

  const changeTitle = (itemId: string, title: string) => { void updateItem(itemId, { title }); };

  // toggle handlers wired directly via props below

  const deleteItem = (itemId: string) => {
    setOptimisticItemsDelete((prev) => new Set([...Array.from(prev), itemId]));
    void deleteItemSubtree(itemId);
  };

  const moveUp = (itemId: string) => {
    const target = items.find((x) => x.id === itemId);
    if (!target) return;
    const siblings = getSiblings(target);
    const idx = siblings.findIndex((s) => s.id === itemId);
    if (idx <= 0) return;
    const orderedIds = siblings.map((s) => s.id);
    const tmp = orderedIds[idx - 1];
    orderedIds[idx - 1] = orderedIds[idx];
    orderedIds[idx] = tmp;
    void reorderSiblings(target.listId, target.parentId, orderedIds);
  };

  const moveDown = (itemId: string) => {
    const target = items.find((x) => x.id === itemId);
    if (!target) return;
    const siblings = getSiblings(target);
    const idx = siblings.findIndex((s) => s.id === itemId);
    if (idx === -1 || idx >= siblings.length - 1) return;
    const orderedIds = siblings.map((s) => s.id);
    const tmp = orderedIds[idx + 1];
    orderedIds[idx + 1] = orderedIds[idx];
    orderedIds[idx] = tmp;
    void reorderSiblings(target.listId, target.parentId, orderedIds);
  };

  const indent = (itemId: string) => {
    const target = items.find((x) => x.id === itemId);
    if (!target) return;
    const siblings = getSiblings(target);
    const idx = siblings.findIndex((s) => s.id === itemId);
    if (idx <= 0) return; // need a previous sibling to become parent
    const newParent = siblings[idx - 1];
    const newDepth = newParent.path.length + 2; // parent depth + 1
    if (newDepth > maxDepth) return;
    void reparentSubtree(target.id, target.listId, newParent.id, undefined);
  };

  const outdent = (itemId: string) => {
    const target = items.find((x) => x.id === itemId);
    if (!target || !target.parentId) return;
    const parent = items.find((x) => x.id === target.parentId)!;
    const grandParentId = parent.parentId;
    // Insert right after parent among grandparent's children
    const newSiblings = (grandParentId ? getChildren(grandParentId, target.listId) : items.filter((x) => x.listId === target.listId && x.parentId === null)).sort((a, b) => a.order - b.order);
    const parentIndex = newSiblings.findIndex((s) => s.id === parent.id);
    const insertIndex = parentIndex >= 0 ? parentIndex + 1 : newSiblings.length;
    void reparentSubtree(target.id, target.listId, grandParentId ?? null, insertIndex);
  };

  // Cross-list move via DnD will be implemented later
  const onDragStart = (event: any) => {
    const { active } = event;
    setActiveId(String(active.id));
    const type = active?.data?.current?.type as 'list' | 'item' | undefined;
    setActiveType(type ?? null);
    // overlay content is rendered directly from state
  };

  const onDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over) {
      setActiveId(null);
      setActiveType(null);
      return;
    }

    const type = active?.data?.current?.type as 'list' | 'item' | undefined;
    if (type === 'list') {
      const ordered = displayLists; // current display order
      const oldIndex = ordered.findIndex((l) => l.id === active.id);
      const overData = over.data?.current;
      if (overData?.type === 'list-slot') {
        const slotIndex = overData.index as number;
        if (oldIndex !== -1) {
          const toIndex = oldIndex < slotIndex ? slotIndex - 1 : slotIndex;
          if (toIndex !== oldIndex) {
            const movedIds = arrayMove(ordered.map((l) => l.id), oldIndex, toIndex);
            setOptimisticListOrder(movedIds);
            void reorderLists(movedIds);
          }
        }
      } else {
        const newIndex = ordered.findIndex((l) => l.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const movedIds = arrayMove(ordered.map((l) => l.id), oldIndex, newIndex);
          setOptimisticListOrder(movedIds);
          void reorderLists(movedIds);
        }
      }
    }
    if (type === 'item') {
      const activeData = active.data.current;
      const overData = over.data.current;
      // Dropped over a container zone -> reparent to that container (possibly cross-list)
      if (overData?.type === 'container') {
        const targetListId = overData.listId as string;
        const targetParentId = (overData.parentId as string | null) ?? null;
        setOptimisticItemChange({ type: 'reparent', itemId: String(active.id), targetListId, targetParentId, insertIndex: undefined });
        void moveItemToContainer(String(active.id), targetListId, targetParentId, undefined);
      } else if (overData?.type === 'slot') {
        // Visible drop slot between siblings
        const targetListId = overData.listId as string;
        const targetParentId = (overData.parentId as string | null) ?? null;
        const index = overData.index as number;
        setOptimisticItemChange({ type: 'reparent', itemId: String(active.id), targetListId, targetParentId, insertIndex: index });
        void moveItemToContainer(String(active.id), targetListId, targetParentId, index);
      } else {
        // Dropped over another item
        const activeParent = (activeData?.parentId as string | null) ?? null;
        const targetParent = (overData?.parentId as string | null) ?? null;
        const listId = activeData?.listId as string | undefined;
        if (!listId) {
          setActiveId(null);
          return;
        }
        if (activeParent === targetParent) {
          // Reorder within the same sibling group
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
        } else {
          // Reparent to target parent; insert at the index of the 'over' item in its sibling group
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
