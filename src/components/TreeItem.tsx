import type { Item, List } from '../types';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import type React from 'react';

type TreeItemProps = {
  item: Item;
  depth: number;
  maxDepth: number;
  childrenByParent: Map<string | null, Item[]>;
  allLists: List[];
  onAddChild: (parentId: string) => void;
  onToggleComplete: (itemId: string) => void;
  onToggleCollapse: (itemId: string) => void;
  onChangeTitle: (itemId: string, title: string) => void;
  onDeleteItem: (itemId: string) => void;
  onMoveUp: (itemId: string) => void;
  onMoveDown: (itemId: string) => void;
  onIndent: (itemId: string) => void;
  onOutdent: (itemId: string) => void;
  onMoveTopLevelToList: (itemId: string, targetListId: string) => void;
};

export function TreeItem({
  item,
  depth,
  maxDepth,
  childrenByParent,
  allLists,
  onAddChild,
  onToggleComplete,
  onToggleCollapse,
  onChangeTitle,
  onDeleteItem,
  onMoveUp,
  onMoveDown,
  onIndent,
  onOutdent,
  onMoveTopLevelToList,
}: TreeItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, data: { type: 'item', parentId: item.parentId, listId: item.listId } });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    visibility: isDragging ? 'hidden' as const : undefined,
  } as React.CSSProperties;

  const children = childrenByParent.get(item.id) ?? [];
  const hasChildren = children.length > 0;
  const canAddChild = depth < maxDepth;
  const isTopLevel = depth === 1;

  // Children container drop zone (drop here to reparent under this item)
  const { setNodeRef: setChildrenDropRef, isOver: isChildrenOver } = useDroppable({ id: `container:${item.listId}:${item.id}`, data: { type: 'container', listId: item.listId, parentId: item.id } });

  return (
    <div ref={setNodeRef} className="mb-1.5" style={style}>
      <div className="card cursor-grab w-full" {...attributes} {...listeners}>
        <div
          className="flex items-center gap-2 flex-1 min-w-0 pl-[var(--indent)]"
          style={{ '--indent': `${depth * 16}px` } as React.CSSProperties}
        >
          <button
            onClick={() => hasChildren && onToggleCollapse(item.id)}
            disabled={!hasChildren}
            title={hasChildren ? (item.collapsed ? 'Expand' : 'Collapse') : 'No children'}
            className="icon-btn w-[22px]"
          >
            {hasChildren ? (item.collapsed ? '▸' : '▾') : '·'}
          </button>

          <input
            type="checkbox"
            checked={item.completed}
            onChange={() => onToggleComplete(item.id)}
            title="Mark complete"
          />

          <input
            value={item.title}
            onChange={(e) => onChangeTitle(item.id, e.target.value)}
            className={`input flex-1 min-w-0 ${item.completed ? 'line-through opacity-70' : ''}`}
          />

          {canAddChild && (
            <button
              className="icon-btn"
              title="Add subtask"
              onClick={(e) => { e.stopPropagation(); onAddChild(item.id); }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              ＋
            </button>
          )}
        </div>
      </div>

      {!item.collapsed && hasChildren && (
        <div ref={setChildrenDropRef} className={`rounded-md transition-colors duration-150 ${isChildrenOver ? 'bg-blue-500/20' : 'bg-transparent'}`}>
          <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {children.map((child) => (
              <TreeItem
                key={child.id}
                item={child}
                depth={depth + 1}
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
                onMoveTopLevelToList={onMoveTopLevelToList}
              />
            ))}
          </SortableContext>
        </div>
      )}
    </div>
  );
}


