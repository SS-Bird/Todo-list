import { useEffect, useMemo, useState, useCallback } from 'react';
import type { List } from '../types';
import { subscribeLists, createList as svcCreate, renameList as svcRename, deleteList as svcDelete, reorderLists as svcReorder } from '../services/lists';

export function useLists(uid: string | undefined) {
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState<boolean>(!!uid);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    const unsub = subscribeLists(uid, (ls) => {
      setLists(ls.sort((a, b) => a.order - b.order));
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  const createList = useCallback(async (title: string, clientId?: string): Promise<string | undefined> => {
    if (!uid) return;
    const order = lists.length > 0 ? Math.max(...lists.map((l) => l.order)) + 1 : 0;
    return await svcCreate(uid, title, order, clientId);
  }, [uid, lists]);

  const renameList = useCallback(async (listId: string, title: string) => {
    if (!uid) return;
    await svcRename(uid, listId, title);
  }, [uid]);

  const deleteList = useCallback(async (listId: string) => {
    if (!uid) return;
    await svcDelete(uid, listId);
  }, [uid]);

  const reorderLists = useCallback(async (orderedIds: string[]) => {
    if (!uid) return;
    await svcReorder(uid, orderedIds);
  }, [uid]);

  return useMemo(() => ({ lists, loading, createList, renameList, deleteList, reorderLists }), [lists, loading, createList, renameList, deleteList, reorderLists]);
}


