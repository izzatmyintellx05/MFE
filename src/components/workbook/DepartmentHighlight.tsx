import React, { useMemo, useState } from 'react';
import { useAuthStore } from '../../store/auth.store';

const DEPARTMENT_LABELS: Record<string, string> = {
  BD: 'BD',
  FINANCE: 'Finance',
  SHELLPLAN: 'Shell Plan',
  DESIGN: 'Design',
  PLANNING: 'Planning',
  PRODUCTION: 'Production',
  DISPATCH: 'Dispatch',
};

/**
 * Which MR11 columns to outline: a department user starts with their own department's
 * columns highlighted; anyone can switch departments on or off from the legend.
 */
export function useDepartmentHighlight(
  columnDepartments: Record<string, string>,
  departmentColors: Record<string, string>
) {
  const user = useAuthStore((s) => s.user);
  const [active, setActive] = useState<string[]>(() => {
    const roles: string[] = ((user?.roles as string[]) || []).concat(user?.departmentRole ? [user.departmentRole] : []);
    // Admin and CEO accounts see every department, so nothing is highlighted until they pick one
    if (roles.includes('ADMIN') || roles.includes('CEO')) return [];
    return roles.filter((r) => r in DEPARTMENT_LABELS);
  });

  const toggle = (dept: string) =>
    setActive((prev) => (prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]));

  const highlightColumns = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [column, dept] of Object.entries(columnDepartments)) {
      if (active.includes(dept) && departmentColors[dept]) map[column] = departmentColors[dept];
    }
    return map;
  }, [active, columnDepartments, departmentColors]);

  return { active, toggle, highlightColumns };
}

interface DepartmentLegendProps {
  departmentColors: Record<string, string>;
  active: string[];
  onToggle: (dept: string) => void;
}

// Colour key for the department outlines; click a department to show or hide its columns
export const DepartmentLegend: React.FC<DepartmentLegendProps> = ({ departmentColors, active, onToggle }) => {
  const depts = Object.keys(departmentColors);
  if (depts.length === 0) return null;
  return (
    <div className="flex items-center flex-wrap gap-1.5">
      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mr-1">Highlight columns:</span>
      {depts.map((dept) => {
        const color = departmentColors[dept];
        const on = active.includes(dept);
        return (
          <button
            key={dept}
            onClick={() => onToggle(dept)}
            title={`${on ? 'Hide' : 'Show'} ${DEPARTMENT_LABELS[dept] || dept} columns`}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition cursor-pointer"
            style={
              on
                ? { borderColor: color, color, backgroundColor: `${color}14`, boxShadow: `0 0 6px ${color}88` }
                : { borderColor: '#E7E5E4', color: '#78716C', backgroundColor: '#FFFFFF' }
            }
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            {DEPARTMENT_LABELS[dept] || dept}
          </button>
        );
      })}
    </div>
  );
};
