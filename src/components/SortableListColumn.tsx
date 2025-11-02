import type { List, Item } from '../types';
import { useSortable } from '@dnd-kit/sortable';
import { useDndContext } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ListColumn } from './ListColumn';

/**
 * Wrapper component that adds drag-and-drop functionality to ListColumn.
 * 
 * This component follows the composition pattern: it wraps ListColumn and adds
 * sortable behavior without modifying the presentation component.
 * 
 * The separation of concerns:
 * - SortableListColumn: handles drag-and-drop logic
 * - ListColumn: handles presentation and item management
 */
type SortableListColumnProps = {
  list: List;
  items: Item[];
  allLists: List[];
  maxDepth: number;
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

export function SortableListColumn(props: SortableListColumnProps) {
  const { list } = props;
  
  // Configure sortable behavior for this list
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: list.id, 
    data: { type: 'list' } 
  });
  
  // Check if this list is being dragged over (for highlighting)
  const { active, over } = useDndContext();
  const isListDrag = active?.data?.current?.type === 'list';
  const isOverThis = isListDrag && over?.id === list.id;
  
  // Apply drag transform styles: move list visually during drag
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    visibility: isDragging ? 'hidden' as const : undefined, // Hide when dragging (overlay shows preview)
  } as React.CSSProperties;

  return (
    <div ref={setNodeRef} style={style}>
      {/* Pass drag handle props to ListColumn so header can be dragged */}
      <ListColumn
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
        highlight={isOverThis} // Highlight when another list is dragged over this one
      />
    </div>
  );
}


