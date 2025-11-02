import type { Item, List } from '../types';
import { ListColumn } from './ListColumn';

type ListOverlayProps = {
  list: List;
  items: Item[];
  allLists: List[];
};

export function ListOverlay({ list, items, allLists }: ListOverlayProps) {
  // Render a read-only ListColumn clone for the drag preview
  return (
    <div className="w-[400px]">
      <ListColumn
        list={list}
        items={items}
        allLists={allLists}
        onAddRootItem={() => {}}
        onAddChild={() => {}}
        onToggleComplete={() => {}}
        onToggleCollapse={() => {}}
        onChangeTitle={() => {}}
        onDeleteItem={() => {}}
        onMoveUp={() => {}}
        onMoveDown={() => {}}
        onIndent={() => {}}
        onOutdent={() => {}}
        onRenameList={() => {}}
        onDeleteList={() => {}}
      />
    </div>
  );
}

type ItemOverlayProps = {
  item: Item;
  depth: number;
};

export function ItemOverlay({ item, depth }: ItemOverlayProps) {
  // Kept for potential single-row previews (unused now)
  return (
    <div className="mb-1.5">
      <div className="card w-full">
        <div className="flex items-center gap-2 flex-1 min-w-0 pl-[var(--indent)]" style={{ '--indent': `${depth * 16}px` } as React.CSSProperties}>
          <button disabled className="icon-btn w-[22px]">{'·'}</button>
          <input type="checkbox" checked={item.completed} readOnly />
          <input value={item.title} readOnly className="input flex-1 min-w-0" />
        </div>
      </div>
    </div>
  );
}

type ItemSubtreeOverlayProps = {
  root: Item;
  items: Item[]; // items from the same list as root
};

export function ItemSubtreeOverlay({ root, items }: ItemSubtreeOverlayProps) {
  // Build children map for the root's list
  const listId = root.listId;
  const listItems = items.filter((i) => i.listId === listId);
  const childrenByParent = new Map<string | null, Item[]>();
  for (const it of listItems) {
    const k = it.parentId;
    const arr = childrenByParent.get(k) ?? [];
    arr.push(it);
    childrenByParent.set(k, arr);
  }
  for (const [k, arr] of childrenByParent) {
    arr.sort((a, b) => a.order - b.order);
    childrenByParent.set(k, arr);
  }

  const absoluteDepth = (it: Item) => (it.path?.length ?? 0) + 1;
  const hasChildren = (it: Item) => (childrenByParent.get(it.id) ?? []).length > 0;

  const Row = ({ it }: { it: Item }) => (
    <div className="mb-1.5">
      <div className="card w-full">
        <div
          className="flex items-center gap-2 flex-1 min-w-0 pl-[var(--indent)]"
          style={{ '--indent': `${absoluteDepth(it) * 16}px` } as React.CSSProperties}
        >
          <button disabled className="icon-btn w-[22px]">{hasChildren(it) ? (it.collapsed ? '▸' : '▾') : '·'}</button>
          <input type="checkbox" checked={it.completed} readOnly />
          <input value={it.title} readOnly className="input flex-1 min-w-0" />
        </div>
      </div>
    </div>
  );

  const renderSubtree = (it: Item, acc: JSX.Element[] = []) => {
    acc.push(<Row key={it.id} it={it} />);
    if (it.collapsed) return acc;
    const children = childrenByParent.get(it.id) ?? [];
    for (const child of children) {
      renderSubtree(child, acc);
    }
    return acc;
  };

  return (
    <div className="w-[400px]">
      {renderSubtree(root)}
    </div>
  );
}


