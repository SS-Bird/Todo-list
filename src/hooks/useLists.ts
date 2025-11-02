import { useEffect, useMemo, useState, useCallback } from 'react';
import type { List } from '../types';
import { subscribeLists, createList as svcCreate, renameList as svcRename, deleteList as svcDelete, reorderLists as svcReorder } from '../services/lists';

/**
 * Custom hook for managing lists data and operations.
 * 
 * This hook:
 * - Subscribes to Firestore real-time updates for lists
 * - Provides CRUD operations for lists
 * - Manages loading state
 * - Automatically sorts lists by order field
 */
export function useLists(uid: string | undefined) {
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState<boolean>(!!uid);

  // Subscribe to Firestore real-time updates
  useEffect(() => {
    if (!uid) return; // No subscription if user not authenticated
    setLoading(true);
    // Subscribe to all lists for this user, sorted by order
    const unsub = subscribeLists(uid, (ls) => {
      setLists(ls.sort((a, b) => a.order - b.order));
      setLoading(false);
    });
    // Cleanup: unsubscribe when component unmounts or uid changes
    return () => unsub();
  }, [uid]);

  /**
   * CRUD operation callbacks
   * All callbacks are memoized with useCallback to prevent unnecessary re-renders.
   */

  /** Create a new list with order based on existing lists */
  const createList = useCallback(async (title: string, clientId?: string): Promise<string | undefined> => {
    if (!uid) return;
    // Calculate order: append to end (max order + 1, or 0 if no lists)
    const order = lists.length > 0 ? Math.max(...lists.map((l) => l.order)) + 1 : 0;
    return await svcCreate(uid, title, order, clientId);
  }, [uid, lists]);

  /** Rename a list */
  const renameList = useCallback(async (listId: string, title: string) => {
    if (!uid) return;
    await svcRename(uid, listId, title);
  }, [uid]);

  /** Delete a list (cascade deletes all items in the list) */
  const deleteList = useCallback(async (listId: string) => {
    if (!uid) return;
    await svcDelete(uid, listId);
  }, [uid]);

  /** Reorder lists according to the provided order */
  const reorderLists = useCallback(async (orderedIds: string[]) => {
    if (!uid) return;
    await svcReorder(uid, orderedIds);
  }, [uid]);

  // Memoize return value to prevent unnecessary re-renders
  return useMemo(() => ({ lists, loading, createList, renameList, deleteList, reorderLists }), [lists, loading, createList, renameList, deleteList, reorderLists]);
}


