import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, Columns3, Eye, EyeOff, Filter, Highlighter, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { ColumnGroup, ColumnGroupsList } from './ColumnGroupsMenu';
import { DepartmentLegend } from './DepartmentHighlight';
import { FILTER_FIELDS, FilterField, valueCounts, activeFilterCount } from '../../utils/mr11Filters';
import { usePersistentState } from '../../utils/usePersistentState';

interface Mr11SidePanelProps {
  // View
  groups: ColumnGroup[];
  hiddenGroups: string[];
  onHiddenGroupsChange: (hidden: string[]) => void;
  // Highlight
  departmentColors: Record<string, string>;
  highlighted: string[];
  onToggleHighlight: (dept: string) => void;
  // Filters
  records: Record<string, any>[];
  filters: Record<string, string[]>;
  onFiltersChange: (filters: Record<string, string[]>) => void;
  onClose: () => void;
}

// A titled section of the panel that folds open and shut (remembered per section)
const Section: React.FC<{
  id: string;
  title: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ id, title, icon, badge, action, children }) => {
  const [open, setOpen] = usePersistentState<boolean>(`mr11.panel.${id}`, true);
  return (
    <section className="border-b border-stone-100 last:border-b-0">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex-1 flex items-center gap-2 text-left cursor-pointer group"
        >
          <span className="text-stone-400 group-hover:text-stone-700 transition">{icon}</span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600 group-hover:text-stone-900">{title}</span>
          {badge}
          <ChevronDown className={`w-3.5 h-3.5 ml-auto text-stone-400 transition-transform ${open ? '' : '-rotate-90'}`} />
        </button>
        {action}
      </div>
      {open && <div className="px-3 pb-3">{children}</div>}
    </section>
  );
};

// One filter: its values with how many rows have each, ticked values filter the table
const FilterGroup: React.FC<{
  field: FilterField;
  records: Record<string, any>[];
  selected: string[];
  onChange: (values: string[]) => void;
}> = ({ field, records, selected, onChange }) => {
  const [open, setOpen] = useState(selected.length > 0);
  const [query, setQuery] = useState('');
  const values = useMemo(() => valueCounts(field, records), [field, records]);
  const shownValues = query.trim() ? values.filter((v) => v.value.toLowerCase().includes(query.trim().toLowerCase())) : values;

  if (values.length === 0) return null;

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  return (
    <div className={`rounded-lg transition ${open ? 'bg-stone-50/80' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs hover:bg-stone-100/80 cursor-pointer"
      >
        <ChevronDown className={`w-3 h-3 text-stone-400 transition-transform ${open ? '' : '-rotate-90'}`} />
        <span className={`font-semibold ${selected.length ? 'text-stone-900' : 'text-stone-600'}`}>{field.label}</span>
        {selected.length > 0 && (
          <span className="ml-auto px-1.5 rounded-full text-[10px] font-bold bg-stone-900 text-amber-200">{selected.length}</span>
        )}
      </button>

      {!open && selected.length > 0 && (
        <div className="px-7 pb-1.5 text-[10px] text-stone-500 truncate" title={selected.join(', ')}>
          {selected.join(', ')}
        </div>
      )}

      {open && (
        <div className="px-2 pb-2">
          {values.length > 8 && (
            <div className="relative mb-1.5">
              <Search className="w-3 h-3 text-stone-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Find ${field.label.toLowerCase()}...`}
                className="w-full pl-6 pr-2 py-1 text-[11px] bg-white border border-stone-200 rounded-md focus:outline-none focus:border-stone-500"
              />
            </div>
          )}
          <ul className="max-h-48 overflow-y-auto space-y-0.5">
            {shownValues.map(({ value, count }) => {
              const on = selected.includes(value);
              return (
                <li key={value}>
                  <button
                    type="button"
                    onClick={() => toggle(value)}
                    className={`w-full flex items-center gap-2 px-1.5 py-1 rounded-md text-left text-[11px] cursor-pointer transition ${
                      on ? 'bg-white shadow-sm' : 'hover:bg-white'
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded flex items-center justify-center border flex-shrink-0 ${
                        on ? 'bg-stone-900 border-stone-900 text-amber-200' : 'bg-white border-stone-300'
                      }`}
                    >
                      {on && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                    </span>
                    <span className={`truncate ${on ? 'text-stone-900 font-semibold' : 'text-stone-700'}`} title={value}>
                      {value}
                    </span>
                    <span className="ml-auto text-[10px] font-mono text-stone-400">{count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

// Right-hand panel of the MR11 page: what to show, which columns to highlight, and filters
export const Mr11SidePanel: React.FC<Mr11SidePanelProps> = ({
  groups,
  hiddenGroups,
  onHiddenGroupsChange,
  departmentColors,
  highlighted,
  onToggleHighlight,
  records,
  filters,
  onFiltersChange,
  onClose,
}) => {
  const filterCount = activeFilterCount(filters);

  return (
    <aside className="w-72 h-full flex flex-col bg-white border border-stone-200/80 rounded-xl shadow-sm overflow-hidden select-none">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-100 bg-stone-50/60 flex-shrink-0">
        <SlidersHorizontal className="w-4 h-4 text-stone-500" />
        <span className="text-xs font-extrabold uppercase tracking-wider text-stone-800">Options</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto p-1 rounded-md text-stone-400 hover:text-stone-900 hover:bg-white cursor-pointer"
          title="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
      <Section
        id="view"
        title="View"
        icon={<Columns3 className="w-3.5 h-3.5" />}
        badge={
          hiddenGroups.length > 0 ? (
            <span className="px-1.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">{hiddenGroups.length} hidden</span>
          ) : undefined
        }
      >
        <div className="flex items-center justify-between px-2 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Column groups</span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onHiddenGroupsChange([])}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-stone-500 hover:bg-stone-100 hover:text-stone-900 cursor-pointer"
              title="Show every column group"
            >
              <Eye className="w-3 h-3" /> All
            </button>
            <button
              type="button"
              onClick={() => onHiddenGroupsChange(groups.map((g) => g.key))}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-stone-500 hover:bg-stone-100 hover:text-stone-900 cursor-pointer"
              title="Hide every column group (project columns stay)"
            >
              <EyeOff className="w-3 h-3" /> None
            </button>
          </div>
        </div>
        <ColumnGroupsList groups={groups} hidden={hiddenGroups} onChange={onHiddenGroupsChange} />
        <p className="px-2 mt-1.5 text-[10px] leading-snug text-stone-400">
          Project name, number, short name and stream always stay visible.
        </p>
      </Section>

      <Section id="highlight" title="Highlight columns" icon={<Highlighter className="w-3.5 h-3.5" />}>
        <div className="px-1">
          <DepartmentLegend departmentColors={departmentColors} active={highlighted} onToggle={onToggleHighlight} hideLabel />
          <p className="mt-2 text-[10px] leading-snug text-stone-400">Outlines each department's columns in its colour.</p>
        </div>
      </Section>

      <Section
        id="filters"
        title="Filters"
        icon={<Filter className="w-3.5 h-3.5" />}
        badge={
          filterCount > 0 ? (
            <span className="px-1.5 rounded-full text-[10px] font-bold bg-stone-900 text-amber-200">{filterCount}</span>
          ) : undefined
        }
        action={
          filterCount > 0 ? (
            <button
              type="button"
              onClick={() => onFiltersChange({})}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer"
              title="Clear all filters"
            >
              <RotateCcw className="w-3 h-3" /> Clear
            </button>
          ) : undefined
        }
      >
        <div className="space-y-0.5">
          {FILTER_FIELDS.map((field) => (
            <FilterGroup
              key={field.key}
              field={field}
              records={records}
              selected={filters[field.key] || []}
              onChange={(values) => onFiltersChange({ ...filters, [field.key]: values })}
            />
          ))}
        </div>
      </Section>
      </div>
    </aside>
  );
};
