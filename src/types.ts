export type List = {
  id: string;
  title: string;
  order: number; // ordering among lists
  clientId?: string; // for optimistic creation dedupe
};

export type Item = {
  id: string;
  title: string;
  completed: boolean;
  collapsed: boolean;
  listId: string; // owning list id
  parentId: string | null; // null for top-level items in a list
  path: string[]; // ordered ancestor item ids, excludes self (e.g., [rootId, parentId])
  order: number; // ordering among siblings (simple integer for placeholder data)
  clientId?: string; // for optimistic creation dedupe
};

export const MAX_DEPTH = 4; // list -> item (1), sub-item (2), sub-sub-item (3)


