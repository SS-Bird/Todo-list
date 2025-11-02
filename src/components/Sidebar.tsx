import type { List } from '../types';
import { useState } from 'react';
import { MdDelete, MdEdit, MdAdd } from 'react-icons/md';

/**
 * Sidebar component for list navigation and management.
 * Provides an alternative view for managing lists (currently not used in main app).
 */
type SidebarProps = {
  lists: List[];
  selectedListId: string | null;
  onSelectList: (listId: string) => void;
  onAddList: () => void;
  onRenameList: (listId: string, title: string) => void;
  onDeleteList: (listId: string) => void;
};

export function Sidebar({ lists, selectedListId, onSelectList, onAddList, onRenameList, onDeleteList }: SidebarProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null); // ID of list being renamed
  const [tempTitle, setTempTitle] = useState<string>(''); // Temporary title during rename

  const startRename = (list: List) => {
    setRenamingId(list.id);
    setTempTitle(list.title);
  };

  const commitRename = (listId: string) => {
    const title = tempTitle.trim();
    if (title.length > 0) onRenameList(listId, title);
    setRenamingId(null);
    setTempTitle('');
  };

  return (
    <aside className="w-[280px] border-r border-slate-700 p-4 box-border">
      <div className="flex items-center justify-between mb-3">
        <h2 className="m-0 text-[18px]">Lists</h2>
        <button className="icon-btn" onClick={onAddList} title="Add list"><MdAdd className="w-5 h-5" /></button>
      </div>
      <div>
        {[...lists].sort((a, b) => a.order - b.order).map((list) => {
          const isActive = list.id === selectedListId;
          return (
            <div key={list.id} className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded ${isActive ? 'bg-slate-700' : ''}`}>
              <button
                onClick={() => onSelectList(list.id)}
                className="flex-1 text-left bg-transparent border-0 p-1.5 cursor-pointer"
              >
                {renamingId === list.id ? (
                  <input
                    autoFocus
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    onBlur={() => commitRename(list.id)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') commitRename(list.id);
                      if (e.key === 'Escape') {
                        setRenamingId(null);
                        setTempTitle('');
                      }
                    }}
                    className="w-full input"
                  />
                ) : (
                  <span>{list.title}</span>
                )}
              </button>
              {renamingId !== list.id && (
                <div className="flex gap-1.5">
                  <button className="icon-btn" title="Rename" onClick={() => startRename(list)}><MdEdit className="w-5 h-5" /></button>
                  <button className="icon-btn" title="Delete" onClick={() => onDeleteList(list.id)}><MdDelete className="w-5 h-5" /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}


