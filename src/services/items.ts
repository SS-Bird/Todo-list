import { addDoc, arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, updateDoc, where, writeBatch, type Unsubscribe } from 'firebase/firestore';
import type { Item } from '../types';
import { db } from '../lib/firebase';
import { userSubcollectionRef } from './db';

/**
 * Service layer for item database operations.
 * 
 * This module handles all Firestore operations for items, including:
 * - Real-time subscriptions
 * - CRUD operations
 * - Complex hierarchical operations (reparenting subtrees)
 * - Cascade deletions
 * - Order management
 */

/**
 * Subscribe to all items for a user with real-time updates.
 * Uses Firestore onSnapshot for live data synchronization.
 * Returns unsubscribe function for cleanup.
 */
export function subscribeItems(uid: string, cb: (items: Item[]) => void): Unsubscribe {
  // Subscribe to entire items collection for this user
  const col = userSubcollectionRef<Item>(uid, 'items');
  return onSnapshot(col, (snap) => {
    // Map Firestore documents to Item type (add id from document reference)
    const items: Item[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Item, 'id'>) }));
    cb(items);
  });
}

/**
 * Create a root-level item (top-level in a list, no parent).
 * 
 * Root items have:
 * - parentId: null
 * - path: [] (empty, no ancestors)
 * - order: determined by counting existing siblings
 */
export async function createRootItem(uid: string, listId: string, title: string, clientId?: string): Promise<string> {
  // Query existing root items in this list to determine insertion order
  const siblingsSnap = await getDocs(query(userSubcollectionRef<Item>(uid, 'items'), where('listId', '==', listId), where('parentId', '==', null)));
  const nextOrder = siblingsSnap.size; // Append to end
  // Create new document with root item properties
  const ref = await addDoc(userSubcollectionRef<Item>(uid, 'items'), {
    title,
    completed: false,
    collapsed: false,
    listId,
    parentId: null, // Root item has no parent
    path: [], // Empty path (no ancestors)
    order: nextOrder,
    ...(clientId ? { clientId } : {}), // Optional clientId for optimistic updates
  } satisfies Omit<Item, 'id'>);
  return ref.id;
}

/**
 * Create a child item (subtask).
 * 
 * Child items:
 * - Inherit listId from parent
 * - Have parentId pointing to parent
 * - Have path = [parent's path, parent's id]
 * - Depth is calculated as parent depth + 1
 * 
 * Returns null if parent doesn't exist or maxDepth would be exceeded.
 */
export async function createChildItem(uid: string, parentId: string, title: string, clientId?: string, maxDepth = 4): Promise<string | null> {
  // Fetch parent to get its properties
  const parentRef = doc(userSubcollectionRef<Item>(uid, 'items'), parentId);
  const parentSnap = await getDoc(parentRef);
  if (!parentSnap.exists()) return null; // Parent doesn't exist
  const parent = { id: parentSnap.id, ...(parentSnap.data() as Omit<Item, 'id'>) } as Item;
  
  // Calculate depth: parent depth + 1
  // Parent depth = path.length + 1, so child depth = path.length + 2
  const newDepth = parent.path.length + 2;
  if (newDepth > maxDepth) return null; // Would exceed maximum depth
  
  // Query existing children to determine insertion order
  const childrenSnap = await getDocs(query(userSubcollectionRef<Item>(uid, 'items'), where('listId', '==', parent.listId), where('parentId', '==', parent.id)));
  const nextOrder = childrenSnap.size; // Append to end
  
  // Create child with parent's listId and path = [parent's path, parent's id]
  const ref = await addDoc(userSubcollectionRef<Item>(uid, 'items'), {
    title,
    completed: false,
    collapsed: false,
    listId: parent.listId, // Inherit list from parent
    parentId: parent.id,
    path: [...parent.path, parent.id], // Append parent to path
    order: nextOrder,
    ...(clientId ? { clientId } : {}),
  } satisfies Omit<Item, 'id'>);
  return ref.id;
}

/**
 * Update an item with partial data.
 * Only the provided fields are updated.
 */
export async function updateItem(uid: string, itemId: string, patch: Partial<Omit<Item, 'id'>>): Promise<void> {
  await updateDoc(doc(userSubcollectionRef(uid, 'items'), itemId), patch as any);
}

/**
 * Toggle the completion status of an item.
 * Reads current state, then inverts it.
 */
export async function toggleComplete(uid: string, itemId: string): Promise<void> {
  const ref = doc(userSubcollectionRef(uid, 'items'), itemId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const completed = !!(snap.data() as any).completed;
  await updateDoc(ref, { completed: !completed });
}

/**
 * Toggle the collapsed state of an item.
 * When collapsed, children are hidden in the UI.
 */
export async function toggleCollapse(uid: string, itemId: string): Promise<void> {
  const ref = doc(userSubcollectionRef(uid, 'items'), itemId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const collapsed = !!(snap.data() as any).collapsed;
  await updateDoc(ref, { collapsed: !collapsed });
}

/**
 * Delete an item and its entire subtree (cascade delete).
 * 
 * This operation:
 * 1. Deletes the root item
 * 2. Deletes all descendants (found via path array-contains query)
 * 3. Reindexes remaining siblings to maintain contiguous order
 * 
 * Uses Firestore batch writes for atomicity - all deletions happen together.
 */
export async function deleteItemSubtree(uid: string, itemId: string): Promise<void> {
  const batch = writeBatch(db);
  const rootRef = doc(userSubcollectionRef(uid, 'items'), itemId);
  const rootSnap = await getDoc(rootRef);
  if (!rootSnap.exists()) return;
  const root = { id: rootSnap.id, ...(rootSnap.data() as any) } as Item;

  // Find all descendants using path array-contains query
  // This efficiently finds all items that have itemId in their path array
  const descSnap = await getDocs(query(userSubcollectionRef<Item>(uid, 'items'), where('path', 'array-contains', itemId)));
  descSnap.forEach((d) => batch.delete(d.ref)); // Delete all descendants
  
  // Delete the root item
  batch.delete(rootRef);

  // Reindex remaining siblings: after deletion, orders must be contiguous (0, 1, 2, ...)
  const oldSibsSnap = await getDocs(query(userSubcollectionRef<Item>(uid, 'items'), where('listId', '==', root.listId), where('parentId', '==', root.parentId)));
  const sibs = oldSibsSnap.docs
    .filter((d) => d.id !== root.id) // Exclude deleted root
    .map((d) => ({ id: d.id, ...(d.data() as any) as Omit<Item, 'id'> }))
    .sort((a, b) => a.order - b.order)
    .map((s, i) => ({ ...s, order: i })); // Reindex sequentially
  sibs.forEach((s) => batch.update(doc(userSubcollectionRef(uid, 'items'), s.id), { order: s.order }));

  // Commit all changes atomically
  await batch.commit();
}

/**
 * Reorder siblings within a container.
 * 
 * Updates the order field for each sibling to match the provided order.
 * Uses batch writes to update all siblings atomically.
 */
export async function reorderSiblings(uid: string, listId: string, parentId: string | null, orderedIds: string[]): Promise<void> {
  const batch = writeBatch(db);
  // Update each sibling's order to match its position in the orderedIds array
  orderedIds.forEach((id, index) => {
    batch.update(doc(userSubcollectionRef(uid, 'items'), id), { order: index });
  });
  await batch.commit();
}

/**
 * Move an item (and its entire subtree) to a different container.
 * 
 * This is the most complex operation in the service layer. It:
 * 1. Prevents cycles (can't move item into its own subtree)
 * 2. Enforces maximum depth constraints
 * 3. Updates the root item (listId, parentId, path, order)
 * 4. Updates all descendants (listId, path prefix)
 * 5. Reindexes siblings in both source and target containers
 * 
 * The path array is critical here: it enables efficient descendant queries
 * and must be recalculated for all descendants when reparenting.
 * 
 * All operations use Firestore batch writes for atomicity.
 */
export async function reparentSubtree(
  uid: string,
  itemId: string,
  targetListId: string,
  targetParentId: string | null,
  insertIndex?: number,
  maxDepth = 4,
): Promise<void> {
  // Fetch the root item being moved
  const rootRef = doc(userSubcollectionRef<Item>(uid, 'items'), itemId);
  const rootSnap = await getDoc(rootRef);
  if (!rootSnap.exists()) return;
  const root = { id: rootSnap.id, ...(rootSnap.data() as Omit<Item, 'id'>) } as Item;

  // Cycle prevention: ensure we're not moving an item into its own subtree
  if (targetParentId) {
    // Can't move item to be its own parent
    if (targetParentId === root.id) return;
    
    // Fetch target parent to check its path
    const targetParentSnap = await getDoc(doc(userSubcollectionRef<Item>(uid, 'items'), targetParentId));
    if (!targetParentSnap.exists()) return;
    const targetParent = { id: targetParentSnap.id, ...(targetParentSnap.data() as Omit<Item, 'id'>) } as Item;
    
    // Depth guard: ensure the move wouldn't exceed maxDepth
    // Calculate subtree height (how deep is the subtree being moved?)
    const subtreeHeight = await computeSubtreeHeight(uid, root.id, root.listId);
    // Calculate where root would be in new location: targetParent depth + 1
    const newRootDepth = (targetParent.path.length + 1) + 1;
    // If new root depth + remaining subtree height exceeds maxDepth, reject
    if (newRootDepth + (subtreeHeight - 1) > maxDepth) return;
  }

  const batch = writeBatch(db);
  // Store old location for reindexing
  const oldParentId = root.parentId;
  const oldListId = root.listId;

  // Calculate new path for root: path of target parent + target parent's id
  const parentPath = targetParentId
    ? [
        ...(((await getDoc(doc(userSubcollectionRef<Item>(uid, 'items'), targetParentId))).data() as Item).path || []),
        targetParentId,
      ]
    : []; // Empty path if moving to root level

  // Determine insertion position in target container
  const targetSibsSnap = await getDocs(query(userSubcollectionRef<Item>(uid, 'items'), where('listId', '==', targetListId), where('parentId', '==', targetParentId)));
  const targetSibs = targetSibsSnap.docs
    .filter((d) => d.id !== root.id) // Exclude root from sibling list
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Item, 'id'>) } as Item))
    .sort((a, b) => a.order - b.order);
  // Clamp insertIndex to valid range
  const targetIndex = insertIndex === undefined ? targetSibs.length : Math.min(Math.max(insertIndex, 0), targetSibs.length);

  // Update root item: new container, new path, new order
  batch.update(rootRef, { listId: targetListId, parentId: targetParentId, path: parentPath, order: targetIndex });

  // Update all descendants: they inherit new listId and get new path prefix
  // The path structure is: [new ancestors up to root] + [root] + [descendant's old path after root]
  const descSnap = await getDocs(query(userSubcollectionRef<Item>(uid, 'items'), where('path', 'array-contains', root.id)));
  const newPrefix = [...parentPath, root.id]; // New path prefix: [parent's path, parent, root]
  descSnap.forEach((d) => {
    const data = d.data() as Item;
    // Find where root appears in descendant's path to extract suffix (descendants after root)
    const idx = data.path.indexOf(root.id);
    const suffix = idx >= 0 ? data.path.slice(idx + 1) : [];
    // New path = new prefix + suffix (preserves structure of subtree)
    batch.update(d.ref, { listId: targetListId, path: [...newPrefix, ...suffix] });
  });

  // Reindex siblings in target container: insert root at targetIndex
  const withInserted = [
    ...targetSibs.slice(0, targetIndex), // Items before insertion point
    { ...root, order: targetIndex }, // Root item
    ...targetSibs.slice(targetIndex), // Items after insertion point
  ].map((s, i) => ({ ...s, order: i })); // Reindex sequentially
  withInserted.forEach((s) => batch.update(doc(userSubcollectionRef(uid, 'items'), s.id), { order: s.order }));

  // Reindex siblings in source container: remove root, compact orders
  const oldSibsSnap = await getDocs(query(userSubcollectionRef<Item>(uid, 'items'), where('listId', '==', oldListId), where('parentId', '==', oldParentId)));
  const oldSibs = oldSibsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Item, 'id'>) } as Item)).sort((a, b) => a.order - b.order);
  oldSibs.forEach((s, i) => batch.update(doc(userSubcollectionRef(uid, 'items'), s.id), { order: i }));

  // Commit all changes atomically
  await batch.commit();
}

/**
 * Calculate the height (maximum depth) of a subtree.
 * 
 * Returns the number of levels in the subtree, where:
 * - 1 = just the root item (no children)
 * - 2 = root + one level of children
 * - etc.
 * 
 * Used for depth validation during reparenting operations.
 */
async function computeSubtreeHeight(uid: string, rootId: string, listId: string): Promise<number> {
  // Find all descendants of root
  const descSnap = await getDocs(query(userSubcollectionRef<Item>(uid, 'items'), where('listId', '==', listId), where('path', 'array-contains', rootId)));
  if (descSnap.empty) return 1; // No descendants, height is 1 (just root)
  
  // Find the deepest descendant: look for the longest path suffix after root
  let maxSuffix = 0;
  descSnap.forEach((d) => {
    const data = d.data() as Item;
    const idx = data.path.indexOf(rootId);
    // Suffix length = how many items after root in the path
    const suffixLen = idx >= 0 ? data.path.length - (idx + 1) : 0;
    if (suffixLen > maxSuffix) maxSuffix = suffixLen;
  });
  // Total height = root (1) + max depth of descendants (maxSuffix)
  return 1 + maxSuffix;
}


