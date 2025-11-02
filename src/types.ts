/**
 * Core data structures for the hierarchical todo application.
 * These types represent the domain model for lists and items in a tree structure.
 */

/**
 * Represents a task list (column in the Kanban-style board).
 * Lists are ordered horizontally and contain hierarchical items.
 */
export type List = {
  id: string; // Unique identifier (Firestore document ID)
  title: string; // Display name of the list
  order: number; // Position in horizontal order among all lists
  clientId?: string; // Temporary ID for optimistic UI updates before server confirmation
};

/**
 * Represents a task item in the hierarchical tree structure.
 * Items can have subtasks (children) and belong to a parent item or list.
 * 
 * The hierarchy is maintained through:
 * - parentId: Direct parent reference (null for root items)
 * - path: Array of all ancestor IDs for efficient subtree queries
 * 
 * This design enables:
 * - Efficient querying of subtrees using Firestore array-contains on path
 * - Cycle prevention during reparenting operations
 * - Depth calculations for maximum depth enforcement
 */
export type Item = {
  id: string; // Unique identifier (Firestore document ID)
  title: string; // Task title (editable)
  completed: boolean; // Completion status
  collapsed: boolean; // Whether subtasks are hidden
  listId: string; // The list this item belongs to
  parentId: string | null; // Parent item ID (null for top-level items in a list)
  path: string[]; // Ordered array of ancestor IDs (excludes self, e.g., [grandparentId, parentId])
  order: number; // Position among siblings (0-indexed)
  clientId?: string; // Temporary ID for optimistic UI updates before server confirmation
};

/**
 * Maximum depth allowed in the hierarchy (inclusive).
 * Depth 1 = top-level items in a list
 * Depth 2 = first-level subtasks
 * Depth 3 = second-level subtasks, etc.
 */
export const MAX_DEPTH = 4;


