import { db } from '../lib/firebase';
import { collection, doc, type CollectionReference, type DocumentReference } from 'firebase/firestore';

/**
 * Database reference helpers.
 * Provides convenient functions for accessing user-specific Firestore collections.
 * 
 * Firestore structure: users/{userId}/lists/{listId}
 *                     users/{userId}/items/{itemId}
 */

/** Get reference to a user document */
export function userDocRef(uid: string): DocumentReference {
  return doc(db, 'users', uid);
}

/**
 * Get reference to a user's subcollection (e.g., 'lists' or 'items').
 * Used for all user-specific data storage.
 */
export function userSubcollectionRef<T = unknown>(uid: string, subcollection: string): CollectionReference<T> {
  return collection(userDocRef(uid), subcollection) as CollectionReference<T>;
}

export { db };


