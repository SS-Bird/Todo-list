import type { Item, List } from '../types';
import { TreeItem } from './TreeItem';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable, useDndContext } from '@dnd-kit/core';
import { DropSlot } from './DropSlot';
import { useState } from 'react';
import { MdDelete, MdEdit, MdAdd } from 'react-icons/md';
import { RxDragHandleDots2 } from 'react-icons/rx';

type ListColumnProps = {
  list: List;
  items: Item[];
  allLists: List[];
  maxDepth: number;
  // spreadable props for making header a drag handle
  dragHandleProps?: Record<string, unknown>;
  highlight?: boolean;
  onAddRootItem: (listId: string) => void;
  onAddChild: (parentId: string) => void;
  onToggleComplete: (itemId: string) => void;
  onToggleCollapse: (itemId: string) => void;
  onChangeTitle: (itemId: string, title: string) => void;
  onDeleteItem: (itemId: string) => void;
  onMoveUp: (itemId: string) => void;
  onMoveDown: (itemId: string) => void;
  onIndent: (itemId: string) => void;
  onOutdent: (itemId: string) => void;
  onRenameList: (listId: string, title: string) => void;
  onDeleteList: (listId: string) => void;
};

export function ListColumn({
  list,
  items,
  allLists,
  maxDepth,
  dragHandleProps,
  highlight = false,
  onAddRootItem,
  onAddChild,
  onToggleComplete,
  onToggleCollapse,
  onChangeTitle,
  onDeleteItem,
  onMoveUp,
  onMoveDown,
  onIndent,
  onOutdent,
  onRenameList,
  onDeleteList,
}: ListColumnProps) {
  const [renaming, setRenaming] = useState(false);
  const [tempTitle, setTempTitle] = useState(list.title);

  const listItems = items.filter((i) => i.listId === list.id);
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
  const topLevel = childrenByParent.get(null) ?? [];
  const topLevelActive = topLevel.filter((t) => !t.completed);
  const topLevelCompleted = topLevel.filter((t) => t.completed);
  const [showCompleted, setShowCompleted] = useState(false);

  const commitRename = () => {
    const next = tempTitle.trim();
    if (next && next !== list.title) onRenameList(list.id, next);
    setRenaming(false);
  };

  // Top-level drop zone (drop here to make item a top-level in this list)
  const { setNodeRef: setRootDropRef, isOver: isRootOver } = useDroppable({ id: `container:${list.id}:null`, data: { type: 'container', listId: list.id, parentId: null } });
  const { active } = useDndContext();
  const isItemDrag = active?.data?.current?.type === 'item';

  return (
    <section className={`column ${highlight ? 'ring-2 ring-blue-500/40' : ''}`}>
      <header className="column-header">
        <div className="flex items-center gap-2 flex-1">
          <span
            className="opacity-50 hover:opacity-70 cursor-grab flex items-center justify-center"
            {...(dragHandleProps || {})}
            title="Drag list"
          >
            <RxDragHandleDots2 className="w-5 h-5" />
          </span>
          {renaming ? (
            <input
              autoFocus
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') {
                  setRenaming(false);
                  setTempTitle(list.title);
                }
              }}
              className="input"
            />
          ) : (
            <h3 className="m-0 text-[16px] whitespace-nowrap overflow-hidden text-ellipsis">{list.title}</h3>
          )}
        </div>
        <div className="flex gap-2">
          {!renaming && <button className="icon-btn" title="Rename" onClick={() => setRenaming(true)}><MdEdit className="w-5 h-5" /></button>}
          <button className="icon-btn" title="Delete list" onClick={() => onDeleteList(list.id)}><MdDelete className="w-5 h-5" /></button>
          <button className="icon-btn" title="Add task" onClick={() => onAddRootItem(list.id)}><MdAdd className="w-5 h-5" /></button>
        </div>
      </header>
      <div ref={setRootDropRef} className={`column-content rounded bg-transparent transition-colors duration-150 ${isRootOver && isItemDrag ? 'bg-blue-500/20' : ''}`}>
        {topLevel.length === 0 ? (
          <p className="opacity-70">No tasks yet.</p>
        ) : (
          <>
          <SortableContext items={topLevelActive.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <DropSlot listId={list.id} parentId={null} index={0} />
            {topLevelActive.map((item, i) => (
              <TreeItem
                key={item.id}
                item={item}
                depth={1}
                maxDepth={maxDepth}
                childrenByParent={childrenByParent}
                allLists={allLists}
                onAddChild={onAddChild}
                onToggleComplete={onToggleComplete}
                onToggleCollapse={onToggleCollapse}
                onChangeTitle={onChangeTitle}
                onDeleteItem={onDeleteItem}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                onIndent={onIndent}
                onOutdent={onOutdent}
                onMoveTopLevelToList={() => { /* removed for now */ }}
              />
            ))}
            <DropSlot listId={list.id} parentId={null} index={topLevelActive.length} />
          </SortableContext>
          <div className="mt-3 border-t border-slate-700 pt-2">
            <button
              className="flex items-center justify-between w-full text-left"
              onClick={() => setShowCompleted((v) => !v)}
              title="Toggle completed section"
            >
              <span className="font-medium">Completed ({topLevelCompleted.length})</span>
              <span>{showCompleted ? '▾' : '▸'}</span>
            </button>
            {showCompleted && (
              <div className="mt-2">
                <SortableContext items={topLevelCompleted.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <DropSlot listId={list.id} parentId={null} index={0} />
                  {topLevelCompleted.map((item, i) => (
                    <TreeItem
                      key={item.id}
                      item={item}
                      depth={1}
                      maxDepth={maxDepth}
                      childrenByParent={childrenByParent}
                      allLists={allLists}
                      onAddChild={onAddChild}
                      onToggleComplete={onToggleComplete}
                      onToggleCollapse={onToggleCollapse}
                      onChangeTitle={onChangeTitle}
                      onDeleteItem={onDeleteItem}
                      onMoveUp={onMoveUp}
                      onMoveDown={onMoveDown}
                      onIndent={onIndent}
                      onOutdent={onOutdent}
                      onMoveTopLevelToList={() => { /* removed for now */ }}
                    />
                  ))}
                  <DropSlot listId={list.id} parentId={null} index={topLevelCompleted.length} />
                </SortableContext>
              </div>
            )}
          </div>
          </>
        )}
      </div>
    </section>
  );
}


