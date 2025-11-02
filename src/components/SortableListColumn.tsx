import type { List, Item } from '../types';
import { useSortable } from '@dnd-kit/sortable';
import { useDndContext } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ListColumn } from './ListColumn';

type SortableListColumnProps = {
  list: List;
  items: Item[];
  allLists: List[];
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: list.id, data: { type: 'list' } });
  const { active, over } = useDndContext();
  const isListDrag = active?.data?.current?.type === 'list';
  const isOverThis = isListDrag && over?.id === list.id;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    visibility: isDragging ? 'hidden' as const : undefined,
  } as React.CSSProperties;

  return (
    <div ref={setNodeRef} style={style}>
      <ListColumn
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
        highlight={isOverThis}
      />
    </div>
  );
}


