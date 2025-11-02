import { useDroppable, useDndContext } from '@dnd-kit/core';
import clsx from 'clsx';

type ListDropSlotProps = {
  index: number; // position between lists, 0..N
};

export function ListDropSlot({ index }: ListDropSlotProps) {
  const { active } = useDndContext();
  const isDraggingList = active?.data?.current?.type === 'list';

  const { setNodeRef, isOver } = useDroppable({
    id: `list-slot-${index}`,
    data: { type: 'list-slot', index },
    disabled: !isDraggingList,
  });

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'self-stretch transition-all duration-150 rounded',
        // width and margin expand only when a list is being dragged
        isDraggingList ? 'w-2 mx-1' : 'w-0 mx-0',
        // base appearance while dragging vs highlight when over
        isOver && isDraggingList ? 'bg-blue-500/60' : isDraggingList ? 'bg-slate-500/30' : 'bg-transparent'
      )}
    />
  );
}


