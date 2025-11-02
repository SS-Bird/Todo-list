import { addDoc, arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, updateDoc, where, writeBatch, type Unsubscribe } from 'firebase/firestore';
import type { Item } from '../types';
import { db } from '../lib/firebase';
import { userSubcollectionRef } from './db';

export function subscribeItems(uid: string, cb: (items: Item[]) => void): Unsubscribe {
  // user-wide subscription to all items
  const col = userSubcollectionRef<Item>(uid, 'items');
  return onSnapshot(col, (snap) => {
    const items: Item[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Item, 'id'>) }));
    cb(items);
  });
}

export async function createRootItem(uid: string, listId: string, title: string, clientId?: string): Promise<string> {
  const siblingsSnap = await getDocs(query(userSubcollectionRef<Item>(uid, 'items'), where('listId', '==', listId), where('parentId', '==', null)));
  const nextOrder = siblingsSnap.size;
  const ref = await addDoc(userSubcollectionRef<Item>(uid, 'items'), {
    title,
    completed: false,
    collapsed: false,
    listId,
    parentId: null,
    path: [],
    order: nextOrder,
    ...(clientId ? { clientId } : {}),
  } satisfies Omit<Item, 'id'>);
  return ref.id;
}

export async function createChildItem(uid: string, parentId: string, title: string, clientId?: string, maxDepth = 4): Promise<string | null> {
  const parentRef = doc(userSubcollectionRef<Item>(uid, 'items'), parentId);
  const parentSnap = await getDoc(parentRef);
  if (!parentSnap.exists()) return null;
  const parent = { id: parentSnap.id, ...(parentSnap.data() as Omit<Item, 'id'>) } as Item;
  const newDepth = parent.path.length + 2; // parent depth + 1
  if (newDepth > maxDepth) return null;
  const childrenSnap = await getDocs(query(userSubcollectionRef<Item>(uid, 'items'), where('listId', '==', parent.listId), where('parentId', '==', parent.id)));
  const nextOrder = childrenSnap.size;
  const ref = await addDoc(userSubcollectionRef<Item>(uid, 'items'), {
    title,
    completed: false,
    collapsed: false,
    listId: parent.listId,
    parentId: parent.id,
    path: [...parent.path, parent.id],
    order: nextOrder,
    ...(clientId ? { clientId } : {}),
  } satisfies Omit<Item, 'id'>);
  return ref.id;
}

export async function updateItem(uid: string, itemId: string, patch: Partial<Omit<Item, 'id'>>): Promise<void> {
  await updateDoc(doc(userSubcollectionRef(uid, 'items'), itemId), patch as any);
}

export async function toggleComplete(uid: string, itemId: string): Promise<void> {
  const ref = doc(userSubcollectionRef(uid, 'items'), itemId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const completed = !!(snap.data() as any).completed;
  await updateDoc(ref, { completed: !completed });
}

export async function toggleCollapse(uid: string, itemId: string): Promise<void> {
  const ref = doc(userSubcollectionRef(uid, 'items'), itemId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const collapsed = !!(snap.data() as any).collapsed;
  await updateDoc(ref, { collapsed: !collapsed });
}

export async function deleteItemSubtree(uid: string, itemId: string): Promise<void> {
  const batch = writeBatch(db);
  const rootRef = doc(userSubcollectionRef(uid, 'items'), itemId);
  const rootSnap = await getDoc(rootRef);
  if (!rootSnap.exists()) return;
  const root = { id: rootSnap.id, ...(rootSnap.data() as any) } as Item;

  // Collect descendants
  const descSnap = await getDocs(query(userSubcollectionRef<Item>(uid, 'items'), where('path', 'array-contains', itemId)));
  descSnap.forEach((d) => batch.delete(d.ref));
  // Delete root
  batch.delete(rootRef);

  // Reindex old siblings of the removed root
  const oldSibsSnap = await getDocs(query(userSubcollectionRef<Item>(uid, 'items'), where('listId', '==', root.listId), where('parentId', '==', root.parentId)));
  const sibs = oldSibsSnap.docs
    .filter((d) => d.id !== root.id)
    .map((d) => ({ id: d.id, ...(d.data() as any) as Omit<Item, 'id'> }))
    .sort((a, b) => a.order - b.order)
    .map((s, i) => ({ ...s, order: i }));
  sibs.forEach((s) => batch.update(doc(userSubcollectionRef(uid, 'items'), s.id), { order: s.order }));

  await batch.commit();
}

export async function reorderSiblings(uid: string, listId: string, parentId: string | null, orderedIds: string[]): Promise<void> {
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => {
    batch.update(doc(userSubcollectionRef(uid, 'items'), id), { order: index });
  });
  await batch.commit();
}

export async function reparentSubtree(
  uid: string,
  itemId: string,
  targetListId: string,
  targetParentId: string | null,
  insertIndex?: number,
  maxDepth = 4,
): Promise<void> {
  const rootRef = doc(userSubcollectionRef<Item>(uid, 'items'), itemId);
  const rootSnap = await getDoc(rootRef);
  if (!rootSnap.exists()) return;
  const root = { id: rootSnap.id, ...(rootSnap.data() as Omit<Item, 'id'>) } as Item;

  // Prevent cycles
  if (targetParentId) {
    if (targetParentId === root.id) return;
    const targetParentSnap = await getDoc(doc(userSubcollectionRef<Item>(uid, 'items'), targetParentId));
    if (!targetParentSnap.exists()) return;
    const targetParent = { id: targetParentSnap.id, ...(targetParentSnap.data() as Omit<Item, 'id'>) } as Item;
    // Depth guard
    const subtreeHeight = await computeSubtreeHeight(uid, root.id, root.listId);
    const newRootDepth = (targetParent.path.length + 1) + 1; // parent depth + 1
    if (newRootDepth + (subtreeHeight - 1) > maxDepth) return;
  }

  const batch = writeBatch(db);
  const oldParentId = root.parentId;
  const oldListId = root.listId;

  const parentPath = targetParentId
    ? [
        ...(((await getDoc(doc(userSubcollectionRef<Item>(uid, 'items'), targetParentId))).data() as Item).path || []),
        targetParentId,
      ]
    : [];

  // Determine insert index in new siblings
  const targetSibsSnap = await getDocs(query(userSubcollectionRef<Item>(uid, 'items'), where('listId', '==', targetListId), where('parentId', '==', targetParentId)));
  const targetSibs = targetSibsSnap.docs
    .filter((d) => d.id !== root.id)
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Item, 'id'>) } as Item))
    .sort((a, b) => a.order - b.order);
  const targetIndex = insertIndex === undefined ? targetSibs.length : Math.min(Math.max(insertIndex, 0), targetSibs.length);

  // Update root
  batch.update(rootRef, { listId: targetListId, parentId: targetParentId, path: parentPath, order: targetIndex });

  // Update descendants (listId + path prefix rewrite)
  const descSnap = await getDocs(query(userSubcollectionRef<Item>(uid, 'items'), where('path', 'array-contains', root.id)));
  const newPrefix = [...parentPath, root.id];
  descSnap.forEach((d) => {
    const data = d.data() as Item;
    const idx = data.path.indexOf(root.id);
    const suffix = idx >= 0 ? data.path.slice(idx + 1) : [];
    batch.update(d.ref, { listId: targetListId, path: [...newPrefix, ...suffix] });
  });

  // Reindex new siblings including root
  const withInserted = [
    ...targetSibs.slice(0, targetIndex),
    { ...root, order: targetIndex },
    ...targetSibs.slice(targetIndex),
  ].map((s, i) => ({ ...s, order: i }));
  withInserted.forEach((s) => batch.update(doc(userSubcollectionRef(uid, 'items'), s.id), { order: s.order }));

  // Reindex old siblings in source container
  const oldSibsSnap = await getDocs(query(userSubcollectionRef<Item>(uid, 'items'), where('listId', '==', oldListId), where('parentId', '==', oldParentId)));
  const oldSibs = oldSibsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Item, 'id'>) } as Item)).sort((a, b) => a.order - b.order);
  oldSibs.forEach((s, i) => batch.update(doc(userSubcollectionRef(uid, 'items'), s.id), { order: i }));

  await batch.commit();
}

async function computeSubtreeHeight(uid: string, rootId: string, listId: string): Promise<number> {
  const descSnap = await getDocs(query(userSubcollectionRef<Item>(uid, 'items'), where('listId', '==', listId), where('path', 'array-contains', rootId)));
  if (descSnap.empty) return 1;
  let maxSuffix = 0;
  descSnap.forEach((d) => {
    const data = d.data() as Item;
    const idx = data.path.indexOf(rootId);
    const suffixLen = idx >= 0 ? data.path.length - (idx + 1) : 0;
    if (suffixLen > maxSuffix) maxSuffix = suffixLen;
  });
  return 1 + maxSuffix;
}


