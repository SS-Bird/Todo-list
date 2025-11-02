import type { List, Item } from '../types';

export const seedLists: List[] = [
  { id: 'l1', title: 'Work', order: 0 },
  { id: 'l2', title: 'Personal', order: 1 },
];

export const seedItems: Item[] = [
  // Work list
  { id: 'i1', title: 'Plan project', completed: false, collapsed: false, listId: 'l1', parentId: null, path: [], order: 0 },
  { id: 'i1a', title: 'Define scope', completed: false, collapsed: false, listId: 'l1', parentId: 'i1', path: ['i1'], order: 0 },
  { id: 'i1b', title: 'Discuss dependencies', completed: false, collapsed: false, listId: 'l1', parentId: 'i1', path: ['i1'], order: 1 },
  { id: 'i1b1', title: 'Pick DnD library', completed: false, collapsed: false, listId: 'l1', parentId: 'i1b', path: ['i1', 'i1b'], order: 0 },
  { id: 'i2', title: 'Write weekly update', completed: false, collapsed: false, listId: 'l1', parentId: null, path: [], order: 1 },

  // Personal list
  { id: 'i3', title: 'Groceries', completed: false, collapsed: false, listId: 'l2', parentId: null, path: [], order: 0 },
  { id: 'i3a', title: 'Vegetables', completed: false, collapsed: false, listId: 'l2', parentId: 'i3', path: ['i3'], order: 0 },
];


