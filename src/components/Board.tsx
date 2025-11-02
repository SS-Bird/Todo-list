import type { ReactNode } from 'react';

/**
 * Board container component.
 * Provides a horizontally scrollable layout for list columns (Kanban-style board).
 */
type BoardProps = {
  children: ReactNode;
};

export function Board({ children }: BoardProps) {
  return (
    <div className="flex gap-4 p-4 overflow-x-auto items-start">
      {children}
    </div>
  );
}


