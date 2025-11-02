import { db } from '../lib/firebase';
import { collection, doc, type CollectionReference, type DocumentReference } from 'firebase/firestore';

export function userDocRef(uid: string): DocumentReference {
  return doc(db, 'users', uid);
}

export function userSubcollectionRef<T = unknown>(uid: string, subcollection: string): CollectionReference<T> {
  return collection(userDocRef(uid), subcollection) as CollectionReference<T>;
}

export { db };


