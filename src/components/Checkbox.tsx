import type { ChangeEvent } from 'react';

type CheckboxProps = {
  checked: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  title?: string;
  disabled?: boolean;
};

export function Checkbox({ checked, onChange, title, disabled = false }: CheckboxProps) {
  return (
    <label className="relative inline-flex items-center cursor-pointer" title={title}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="sr-only"
      />
      <div className={`
        w-4 h-4 rounded border-2 transition-all duration-150 flex items-center justify-center
        ${checked 
          ? 'bg-blue-600 border-blue-600' 
          : 'bg-transparent border-slate-600 hover:border-slate-500'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}>
        {checked && (
          <svg
            className="w-3 h-3 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
      </div>
    </label>
  );
}
