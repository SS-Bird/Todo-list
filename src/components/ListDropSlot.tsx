import { useDroppable, useDndContext } from '@dnd-kit/core';
import clsx from 'clsx';

/**
 * Visual drop slot indicator between lists for horizontal reordering.
 * Only appears when a list is being dragged, showing where it can be dropped.
 */
type ListDropSlotProps = {
  index: number; // Position between lists (0 = before first list, N = after last list)
};

export function ListDropSlot({ index }: ListDropSlotProps) {
  const { active } = useDndContext();
  const isDraggingList = active?.data?.current?.type === 'list';

  // Configure drop zone - only active when dragging a list
  const { setNodeRef, isOver } = useDroppable({
    id: `list-slot-${index}`,
    data: { type: 'list-slot', index },
    disabled: !isDraggingList, // Disable if not dragging a list
  });

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'self-stretch transition-all duration-150 rounded',
        // Expand width/margin only when dragging a list
        isDraggingList ? 'w-2 mx-1' : 'w-0 mx-0',
        // Highlight when dragged over, subtle appearance otherwise
        isOver && isDraggingList ? 'bg-blue-500/60' : isDraggingList ? 'bg-slate-500/30' : 'bg-transparent'
      )}
    />
  );
}


