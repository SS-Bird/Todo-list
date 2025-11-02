import { writeBatch, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, where, type Unsubscribe } from 'firebase/firestore';
import type { List, Item } from '../types';
import { db } from '../lib/firebase';
import { userSubcollectionRef } from './db';

/**
 * Service layer for list database operations.
 * Handles CRUD operations and real-time subscriptions for lists.
 */

/** Subscribe to lists with real-time updates, sorted by order */
export function subscribeLists(uid: string, cb: (lists: List[]) => void): Unsubscribe {
  const q = query(userSubcollectionRef<List>(uid, 'lists'), orderBy('order', 'asc'));
  return onSnapshot(q, (snap) => {
    const lists: List[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<List, 'id'>) }));
    cb(lists);
  });
}

/** Create a new list with specified order */
export async function createList(uid: string, title: string, order: number, clientId?: string): Promise<string> {
  const col = userSubcollectionRef<Omit<List, 'id'>>(uid, 'lists');
  const docRef = await addDoc(col, { title, order, ...(clientId ? { clientId } : {}) });
  return docRef.id;
}

/** Rename a list */
export async function renameList(uid: string, listId: string, title: string): Promise<void> {
  await updateDoc(doc(userSubcollectionRef(uid, 'lists'), listId), { title });
}

/** Delete a list and cascade delete all its items */
export async function deleteList(uid: string, listId: string): Promise<void> {
  const batch = writeBatch(db);
  // Delete list document
  batch.delete(doc(userSubcollectionRef(uid, 'lists'), listId));
  // Cascade delete items belonging to the list
  const itemsSnap = await getDocs(query(userSubcollectionRef<Item>(uid, 'items'), where('listId', '==', listId)));
  itemsSnap.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

/** Reorder lists by updating order field for each list */
export async function reorderLists(uid: string, orderedIds: string[]): Promise<void> {
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => {
    batch.update(doc(userSubcollectionRef(uid, 'lists'), id), { order: index });
  });
  await batch.commit();
}


