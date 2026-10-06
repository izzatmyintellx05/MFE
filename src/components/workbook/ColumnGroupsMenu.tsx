import React, { useEffect, useRef, useState } from 'react';
import { Columns3, Check, Eye, EyeOff } from 'lucide-react';

export interface ColumnGroup {
  key: string;
  label: string;
  color: string;
}

// The project identity columns stay on screen whatever is hidden
const ALWAYS_SHOWN = new Set(['Customer & Project Name', 'Project No', 'Short Name', 'Stream']);

const BD_COLOR = '#2563EB';

/**
 * The show / hide group of an MR11 column: BD splits into project info, payment terms,
 * pricing & LME and the monthly actual / forecast; other columns go by their department.
 */
export function columnGroupOf(header: string, columnDepartments: Record<string, string>): string | null {
  if (ALWAYS_SHOWN.has(header)) return null;
  if (/^[A-Z][a-z]{2}-\d{2}$/.test(header) || /^Total 20\d\d m2$/.test(header)) return 'MONTHLY';
  const dept = columnDepartments[header];
  if (dept === 'BD') {
    if (/^payment terms/i.test(header)) return 'BD_PAYMENT';
    if (/price|lme|incoterms|props|aluminium|freight/i.test(header)) return 'BD_PRICING';
    return 'BD_INFO';
  }
  return dept || null;
}

export function columnGroups(departmentColors: Record<string, string>): ColumnGroup[] {
  const color = (dept: string) => departmentColors[dept] || (dept === 'BD' ? BD_COLOR : '#78716C');
  return [
    { key: 'BD_INFO', label: 'BD: project details', color: color('BD') },
    { key: 'BD_PAYMENT', label: 'BD: payment terms', color: color('BD') },
    { key: 'BD_PRICING', label: 'BD: pricing & LME', color: color('BD') },
    { key: 'FINANCE', label: 'Finance', color: color('FINANCE') },
    { key: 'SHELLPLAN', label: 'Shell Plan', color: color('SHELLPLAN') },
    { key: 'DESIGN', label: 'Design', color: color('DESIGN') },
    { key: 'PLANNING', label: 'Planning', color: color('PLANNING') },
    { key: 'PRODUCTION', label: 'Production', color: color('PRODUCTION') },
    { key: 'DISPATCH', label: 'Dispatch', color: color('DISPATCH') },
    { key: 'MONTHLY', label: 'Monthly actual / forecast', color: '#57534E' },
  ];
}

interface ColumnGroupsMenuProps {
  groups: ColumnGroup[];
  hidden: string[];
  onChange: (hidden: string[]) => void;
}

// "Columns" button with a checklist of column groups to show or hide
export const ColumnGroupsMenu: React.FC<ColumnGroupsMenuProps> = ({ groups, hidden, onChange }) => {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = (key: string) => onChange(hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key]);

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer ${
          open ? 'bg-stone-900 text-white border-stone-900' : 'bg-white hover:bg-stone-50 text-stone-700 border-stone-200'
        }`}
        title="Show or hide column groups"
      >
        <Columns3 className={`w-3.5 h-3.5 ${open ? 'text-amber-200' : 'text-stone-500'}`} />
        <span>Columns</span>
        {hidden.length > 0 && (
          <span className={`px-1.5 rounded-full text-[10px] font-bold ${open ? 'bg-amber-200 text-stone-900' : 'bg-amber-100 text-amber-800'}`}>
            {hidden.length} hidden
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-stone-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-stone-100 bg-stone-50/70">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Column groups</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onChange([])}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-stone-600 hover:bg-white hover:text-stone-900 cursor-pointer"
              >
                <Eye className="w-3 h-3" /> All
              </button>
              <button
                type="button"
                onClick={() => onChange(groups.map((g) => g.key))}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-stone-600 hover:bg-white hover:text-stone-900 cursor-pointer"
              >
                <EyeOff className="w-3 h-3" /> None
              </button>
            </div>
          </div>
          <ul className="py-1 max-h-80 overflow-y-auto">
            {groups.map((g) => {
              const shown = !hidden.includes(g.key);
              return (
                <li key={g.key}>
                  <button
                    type="button"
                    onClick={() => toggle(g.key)}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs hover:bg-stone-50 cursor-pointer"
                  >
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                        shown ? 'border-transparent text-white' : 'border-stone-300 bg-white'
                      }`}
                      style={shown ? { backgroundColor: g.color } : undefined}
                    >
                      {shown && <Check className="w-3 h-3" strokeWidth={3} />}
                    </span>
                    <span className={shown ? 'text-stone-800 font-medium' : 'text-stone-400'}>{g.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="px-3 py-2 border-t border-stone-100 text-[10px] text-stone-400">
            Project name, number, short name and stream always stay visible.
          </div>
        </div>
      )}
    </div>
  );
};
