import { writeBatch, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, where, type Unsubscribe } from 'firebase/firestore';
import type { List, Item } from '../types';
import { db } from '../lib/firebase';
import { userSubcollectionRef } from './db';

export function subscribeLists(uid: string, cb: (lists: List[]) => void): Unsubscribe {
  const q = query(userSubcollectionRef<List>(uid, 'lists'), orderBy('order', 'asc'));
  return onSnapshot(q, (snap) => {
    const lists: List[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<List, 'id'>) }));
    cb(lists);
  });
}

export async function createList(uid: string, title: string, order: number, clientId?: string): Promise<string> {
  const col = userSubcollectionRef<Omit<List, 'id'>>(uid, 'lists');
  const docRef = await addDoc(col, { title, order, ...(clientId ? { clientId } : {}) });
  return docRef.id;
}

export async function renameList(uid: string, listId: string, title: string): Promise<void> {
  await updateDoc(doc(userSubcollectionRef(uid, 'lists'), listId), { title });
}

export async function deleteList(uid: string, listId: string): Promise<void> {
  const batch = writeBatch(db);
  // delete list document
  batch.delete(doc(userSubcollectionRef(uid, 'lists'), listId));
  // cascade delete items belonging to the list
  const itemsSnap = await getDocs(query(userSubcollectionRef<Item>(uid, 'items'), where('listId', '==', listId)));
  itemsSnap.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

export async function reorderLists(uid: string, orderedIds: string[]): Promise<void> {
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => {
    batch.update(doc(userSubcollectionRef(uid, 'lists'), id), { order: index });
  });
  await batch.commit();
}


