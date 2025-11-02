import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Item } from '../types';
import {
  subscribeItems,
  createRootItem as svcCreateRoot,
  createChildItem as svcCreateChild,
  updateItem as svcUpdate,
  toggleComplete as svcToggleComplete,
  toggleCollapse as svcToggleCollapse,
  deleteItemSubtree as svcDeleteSubtree,
  reorderSiblings as svcReorderSiblings,
  reparentSubtree as svcReparentSubtree,
} from '../services/items';

/**
 * Custom hook for managing items data and operations.
 * 
 * This hook:
 * - Subscribes to Firestore real-time updates for items
 * - Provides CRUD operations for items
 * - Manages loading state
 * - Memoizes callbacks for performance
 * 
 * The hook uses Firestore onSnapshot for real-time synchronization,
 * automatically updating the items array when data changes on the server.
 */
export function useItems(uid: string | undefined, maxDepth: number) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState<boolean>(!!uid);

  // Subscribe to Firestore real-time updates
  useEffect(() => {
    if (!uid) return; // No subscription if user not authenticated
    setLoading(true);
    // Subscribe to all items for this user
    const unsub = subscribeItems(uid, (its) => {
      setItems(its);
      setLoading(false);
    });
    // Cleanup: unsubscribe when component unmounts or uid changes
    return () => unsub();
  }, [uid]);

  /**
   * CRUD operation callbacks
   * All callbacks are memoized with useCallback to prevent unnecessary re-renders
   * and to ensure stable references for components that depend on them.
   */

  /** Create a root-level item (top-level in a list) */
  const createRootItem = useCallback(async (listId: string, title: string, clientId?: string) => {
    if (!uid) return;
    await svcCreateRoot(uid, listId, title, clientId);
  }, [uid]);

  /** Create a child item (subtask) under a parent */
  const createChildItem = useCallback(async (parentId: string, title: string, clientId?: string) => {
    if (!uid) return;
    await svcCreateChild(uid, parentId, title, clientId, maxDepth);
  }, [uid, maxDepth]);

  /** Update item properties (partial update) */
  const updateItem = useCallback(async (itemId: string, patch: Partial<Omit<Item, 'id'>>) => {
    if (!uid) return;
    await svcUpdate(uid, itemId, patch);
  }, [uid]);

  /** Toggle item completion status */
  const toggleComplete = useCallback(async (itemId: string) => {
    if (!uid) return;
    await svcToggleComplete(uid, itemId);
  }, [uid]);

  /** Toggle item collapsed state (hide/show children) */
  const toggleCollapse = useCallback(async (itemId: string) => {
    if (!uid) return;
    await svcToggleCollapse(uid, itemId);
  }, [uid]);

  /** Delete an item and its entire subtree (cascade delete) */
  const deleteItemSubtree = useCallback(async (itemId: string) => {
    if (!uid) return;
    await svcDeleteSubtree(uid, itemId);
  }, [uid]);

  /** Reorder siblings within a container */
  const reorderSiblings = useCallback(async (listId: string, parentId: string | null, orderedIds: string[]) => {
    if (!uid) return;
    await svcReorderSiblings(uid, listId, parentId, orderedIds);
  }, [uid]);

  /** Move an item (and subtree) to a different container (reparenting) */
  const reparentSubtree = useCallback(async (itemId: string, targetListId: string, targetParentId: string | null, insertIndex?: number) => {
    if (!uid) return;
    await svcReparentSubtree(uid, itemId, targetListId, targetParentId, insertIndex, maxDepth);
  }, [uid, maxDepth]);

  // Memoize return value to prevent unnecessary re-renders in consuming components
  return useMemo(() => ({
    items,
    loading,
    createRootItem,
    createChildItem,
    updateItem,
    toggleComplete,
    toggleCollapse,
    deleteItemSubtree,
    reorderSiblings,
    reparentSubtree,
  }), [items, loading, createRootItem, createChildItem, updateItem, toggleComplete, toggleCollapse, deleteItemSubtree, reorderSiblings, reparentSubtree]);
}


