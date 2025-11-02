import type { ReactNode } from 'react';

type BoardProps = {
  children: ReactNode;
};

// Horizontally scrollable container for list columns
export function Board({ children }: BoardProps) {
  return (
    <div className="flex gap-4 p-4 overflow-x-auto items-start">
      {children}
    </div>
  );
}


