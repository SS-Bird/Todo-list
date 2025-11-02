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

export function useItems(uid: string | undefined) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState<boolean>(!!uid);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    const unsub = subscribeItems(uid, (its) => {
      setItems(its);
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  const createRootItem = useCallback(async (listId: string, title: string) => {
    if (!uid) return;
    await svcCreateRoot(uid, listId, title);
  }, [uid]);

  const createChildItem = useCallback(async (parentId: string, title: string) => {
    if (!uid) return;
    await svcCreateChild(uid, parentId, title);
  }, [uid]);

  const updateItem = useCallback(async (itemId: string, patch: Partial<Omit<Item, 'id'>>) => {
    if (!uid) return;
    await svcUpdate(uid, itemId, patch);
  }, [uid]);

  const toggleComplete = useCallback(async (itemId: string) => {
    if (!uid) return;
    await svcToggleComplete(uid, itemId);
  }, [uid]);

  const toggleCollapse = useCallback(async (itemId: string) => {
    if (!uid) return;
    await svcToggleCollapse(uid, itemId);
  }, [uid]);

  const deleteItemSubtree = useCallback(async (itemId: string) => {
    if (!uid) return;
    await svcDeleteSubtree(uid, itemId);
  }, [uid]);

  const reorderSiblings = useCallback(async (listId: string, parentId: string | null, orderedIds: string[]) => {
    if (!uid) return;
    await svcReorderSiblings(uid, listId, parentId, orderedIds);
  }, [uid]);

  const reparentSubtree = useCallback(async (itemId: string, targetListId: string, targetParentId: string | null, insertIndex?: number) => {
    if (!uid) return;
    await svcReparentSubtree(uid, itemId, targetListId, targetParentId, insertIndex);
  }, [uid]);

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


