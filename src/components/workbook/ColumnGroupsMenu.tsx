import React from 'react';
import { Check } from 'lucide-react';

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

interface ColumnGroupsListProps {
  groups: ColumnGroup[];
  hidden: string[];
  onChange: (hidden: string[]) => void;
}

// Tick list of column groups: ticked groups are shown in the MR11 table
export const ColumnGroupsList: React.FC<ColumnGroupsListProps> = ({ groups, hidden, onChange }) => {
  const toggle = (key: string) => onChange(hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key]);
  return (
    <ul className="space-y-0.5">
      {groups.map((g) => {
        const shown = !hidden.includes(g.key);
        return (
          <li key={g.key}>
            <button
              type="button"
              onClick={() => toggle(g.key)}
              className="w-full flex items-center gap-2.5 px-2 py-1 rounded-md text-left text-xs hover:bg-stone-100/80 cursor-pointer transition"
            >
              <span
                className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 transition ${
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
  );
};
