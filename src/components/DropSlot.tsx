import { useDroppable, useDndContext } from '@dnd-kit/core';

/**
 * Visual drop slot indicator between items.
 * Shows where items can be dropped during drag operations.
 * Only visible when dragging an item or when dragged over.
 */
export function DropSlot({ listId, parentId, index }: { listId: string; parentId: string | null; index: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${listId}:${parentId ?? 'null'}:${index}`, data: { type: 'slot', listId, parentId, index } });
  const { active } = useDndContext();
  const isItemDrag = active?.data?.current?.type === 'item';
  const visible = isOver || isItemDrag; // Show when dragging item or over this slot
  const heightClass = visible ? 'h-1 my-0.5' : 'h-0 m-0';
  return (
    <div ref={setNodeRef} className={`${heightClass} rounded transition-colors duration-150 ${isOver ? 'bg-blue-500/40' : 'bg-transparent'}`} />
  );
}


