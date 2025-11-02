import type { Item, List } from '../types';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { MdAdd, MdKeyboardArrowRight, MdKeyboardArrowDown, MdDelete } from 'react-icons/md';
import { RxDragHandleDots2 } from 'react-icons/rx';
import { DropSlot } from './DropSlot';
import type React from 'react';
import { Checkbox } from './Checkbox';

/**
 * Recursive tree item component for hierarchical task display.
 * 
 * This component:
 * - Renders a single item with its properties (title, completion, collapse state)
 * - Recursively renders its children by calling itself
 * - Integrates with @dnd-kit for drag-and-drop functionality
 * - Provides visual indentation based on depth
 * - Handles drop zones for reparenting operations
 * 
 * The recursive structure mirrors the data structure: each item knows its children
 * via the childrenByParent map, and renders them at depth + 1.
 */
type TreeItemProps = {
  item: Item; // The item to render
  depth: number; // Current depth in hierarchy (1 = root level)
  maxDepth: number; // Maximum allowed depth
  childrenByParent: Map<string | null, Item[]>; // Map of parentId -> children for efficient lookups
  allLists: List[]; // All lists (for cross-list operations)
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
  // Configure drag-and-drop for this item
  // The item is sortable and includes metadata (parentId, listId) for drag operations
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: item.id, 
    data: { type: 'item', parentId: item.parentId, listId: item.listId } 
  });
  
  // Apply drag transform styles: move item visually during drag
  // Hide item when dragging (drag overlay shows preview instead)
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    visibility: isDragging ? 'hidden' as const : undefined,
  } as React.CSSProperties;

  // Get children of this item from the pre-computed map
  const children = childrenByParent.get(item.id) ?? [];
  const hasChildren = children.length > 0;
  const canAddChild = depth < maxDepth; // Can't add children if at max depth
  const isTopLevel = depth === 1; // Top level items are at depth 1

  // Create drop zone for children container
  // Dropping an item here reparents it to be a child of this item
  const { setNodeRef: setChildrenDropRef, isOver: isChildrenOver } = useDroppable({ 
    id: `container:${item.listId}:${item.id}`, 
    data: { type: 'container', listId: item.listId, parentId: item.id } 
  });

  return (
    <div ref={setNodeRef} className="mb-1" style={style}>
      <div className="card flex flex-col overflow-hidden">
        {/* Main item row: controls, title, actions */}
        <div
          className="flex items-center gap-2 min-w-0 pl-[var(--indent)] pr-2"
          // Indent increases by 10px per depth level (depth 1 = 6px, depth 2 = 16px, etc.)
          style={{ '--indent': `${(depth - 1) * 10 + 6}px` } as React.CSSProperties}
        >
          <span
            onClick={() => hasChildren && onToggleCollapse(item.id)}
            title={hasChildren ? (item.collapsed ? 'Expand' : 'Collapse') : 'No children'}
            className={`w-[28px] h-[28px] flex items-center justify-center select-none ${hasChildren ? 'cursor-pointer' : 'opacity-40 cursor-default'}`}
          >
            {hasChildren ? (
              item.collapsed ? (
                <MdKeyboardArrowRight className="w-6 h-6 text-slate-300" />
              ) : (
                <MdKeyboardArrowDown className="w-6 h-6 text-slate-300" />
              )
            ) : (
              <div className="w-1 h-1 bg-slate-500 rounded-full" />
            )}
          </span>

          <span
            className="opacity-50 hover:opacity-70 cursor-grab flex items-center justify-center"
            {...attributes}
            {...listeners}
            title="Drag"
          >
            <RxDragHandleDots2 className="w-5 h-5" />
          </span>

          <Checkbox
            checked={item.completed}
            onChange={() => onToggleComplete(item.id)}
            title="Mark complete"
          />

          <input
            value={item.title}
            onChange={(e) => onChangeTitle(item.id, e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            className={`input flex-none w-auto ${item.completed ? 'line-through opacity-70' : ''}`}
          />

          {canAddChild && (
            <button
              className="icon-btn"
              title="Add subtask"
              onClick={(e) => { e.stopPropagation(); onAddChild(item.id); }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <MdAdd className="w-5 h-5" />
            </button>
          )}

          <button
            className="icon-btn"
            title="Delete"
            onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id); }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <MdDelete className="w-5 h-5" />
          </button>
        </div>
        {/* Children container: only rendered if item is expanded and has children */}
        {!item.collapsed && hasChildren && (
          <div
            ref={setChildrenDropRef}
            // Highlight drop zone when dragging over
            className={`mt-1 rounded-md transition-colors duration-150 ${isChildrenOver ? 'bg-blue-500/20' : 'bg-transparent'} max-w-full pr-2`}
            style={{ paddingLeft: 16 }}
          >
            {/* Make children sortable: can reorder within this container */}
            <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {/* Drop slot at start of children list */}
              <DropSlot listId={item.listId} parentId={item.id} index={0} />
              {/* Recursively render each child at depth + 1 */}
              {children.map((child, i) => (
                <TreeItem
                  key={child.id}
                  item={child}
                  depth={depth + 1} // Increment depth for children
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
              {/* Drop slot at end of children list */}
              <DropSlot listId={item.listId} parentId={item.id} index={children.length} />
            </SortableContext>
          </div>
        )}
      </div>
    </div>
  );
}


