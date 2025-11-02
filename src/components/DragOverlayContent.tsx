import type { Item, List } from '../types';
import { ListColumn } from './ListColumn';
import { Checkbox } from './Checkbox';
import { MdKeyboardArrowRight, MdKeyboardArrowDown } from 'react-icons/md';
import { RxDragHandleDots2 } from 'react-icons/rx';

type ListOverlayProps = {
  list: List;
  items: Item[];
  allLists: List[];
  maxDepth: number;
};

export function ListOverlay({ list, items, allLists, maxDepth }: ListOverlayProps) {
  // Render a read-only ListColumn clone for the drag preview
  return (
    <div className="w-fit">
      <ListColumn
        list={list}
        items={items}
        allLists={allLists}
        maxDepth={maxDepth}
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
  // Single row clone matching TreeItem header styles
  const indent = (depth - 1) * 10 + 6;
  return (
    <div className="mb-1">
      <div className="card flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 min-w-0 pr-2" style={{ paddingLeft: indent }}>
          <span className={`w-[28px] h-[28px] flex items-center justify-center select-none opacity-40`}>
            <div className="w-1 h-1 bg-slate-500 rounded-full" />
          </span>
          <span className="opacity-50 flex items-center justify-center">
            <RxDragHandleDots2 className="w-5 h-5" />
          </span>
          <Checkbox checked={item.completed} onChange={() => {}} disabled />
          <input value={item.title} readOnly className={`input flex-none w-auto ${item.completed ? 'line-through opacity-70' : ''}`} />
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

  const hasChildren = (it: Item) => (childrenByParent.get(it.id) ?? []).length > 0;

  const renderNode = (it: Item, depth: number): JSX.Element => {
    const indent = (depth - 1) * 10 + 6;
    const children = childrenByParent.get(it.id) ?? [];
    return (
      <div key={it.id} className="mb-1">
        <div className="card flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 min-w-0 pr-2" style={{ paddingLeft: indent }}>
            <span className={`w-[28px] h-[28px] flex items-center justify-center select-none ${hasChildren(it) ? '' : 'opacity-40'}`}>
              {hasChildren(it) ? (
                it.collapsed ? (
                  <MdKeyboardArrowRight className="w-6 h-6 text-slate-300" />
                ) : (
                  <MdKeyboardArrowDown className="w-6 h-6 text-slate-300" />
                )
              ) : (
                <div className="w-1 h-1 bg-slate-500 rounded-full" />
              )}
            </span>
            <span className="opacity-50 flex items-center justify-center">
              <RxDragHandleDots2 className="w-5 h-5" />
            </span>
            <Checkbox checked={it.completed} onChange={() => {}} disabled />
            <input value={it.title} readOnly className={`input flex-none w-auto ${it.completed ? 'line-through opacity-70' : ''}`} />
          </div>
          {!it.collapsed && children.length > 0 && (
            <div className="mt-1 max-w-full pr-2" style={{ paddingLeft: 16 }}>
              {children.map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const startDepth = (root.path?.length ?? 0) + 1;
  return <div className="w-fit">{renderNode(root, startDepth)}</div>;
}


