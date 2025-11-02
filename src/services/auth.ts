import { auth } from '../lib/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  fetchSignInMethodsForEmail,
  type UserCredential,
} from 'firebase/auth';

/**
 * Service layer for authentication operations.
 * Wraps Firebase Auth methods for consistent API.
 */

/** Create a new user account with email and password */
export async function signUpWithEmail(email: string, password: string): Promise<UserCredential> {
  return await createUserWithEmailAndPassword(auth, email, password);
}

/** Sign in existing user with email and password */
export async function signInWithEmail(email: string, password: string): Promise<UserCredential> {
  return await signInWithEmailAndPassword(auth, email, password);
}

/** Sign out current user */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/** Get available sign-in methods for an email (used for error handling) */
export async function getSignInMethods(email: string): Promise<string[]> {
  return await fetchSignInMethodsForEmail(auth, email);
}


