import React from 'react';
import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpDown, ArrowUpToLine, ChevronLeft, ChevronRight, EyeOff, Trash2 } from 'lucide-react';
import { DesignDatePart, designDateColor, monthColumnKind, todayInMalaysia } from '../../utils/designDates';
import { formatCellNumber } from '../../utils/formatNumber';
import { ColumnSort, FrozenAt, nextSort } from '../../utils/mr11Filters';

const DESIGN_DATE_COLUMN = 'Actual Formwork Order Completion Date';

// Completion dates coloured by status: dark green done, yellow done but ahead, red not done
const DesignDates: React.FC<{ parts: DesignDatePart[]; today: string }> = ({ parts, today }) => (
  <>
    {parts.map((p, i) => (
      <React.Fragment key={i}>
        {i > 0 && ', '}
        {p.level && <span className="font-normal text-stone-500">{p.level}: </span>}
        <span style={{ color: designDateColor(p, today) }} className="font-bold">
          {p.date}
        </span>
      </React.Fragment>
    ))}
  </>
);

// A button in the row actions shown over a row's number on hover
const RowAction: React.FC<{
  onClick: () => void;
  title: string;
  active?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}> = ({ onClick, title, active, danger, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    aria-pressed={active}
    className={`inline-flex items-center justify-center w-5 h-5 rounded cursor-pointer ${
      danger
        ? 'text-rose-500 hover:text-white hover:bg-rose-600'
        : active
        ? 'bg-amber-500 text-white hover:bg-amber-600'
        : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
    }`}
  >
    {children}
  </button>
);

const STREAM_MERGE_COLUMNS = [
  'Shell Plan Status - Pending Consultant Drawings',
  'Shell Plan Approved Date',
  'Formwork Design Status',
  'Actual Formwork Order Completion Date',
  'Total Quantity Ordered m2',
];

export const isStreamMergeColumn = (colHeader: string) => {
  return STREAM_MERGE_COLUMNS.some(
    (c) => c === colHeader || colHeader.toLowerCase().startsWith(c.toLowerCase())
  );
};

const isAtdColumn = (colHeader: string) => {
  const clean = String(colHeader || '').toLowerCase().trim();
  return clean === 'atd' || clean.includes('atd') || clean.includes('actual time of departure');
};

// Columns shown under a shared top header (e.g. Payment terms), as in the BD workbook
export interface HeaderGroup {
  label: string;
  columns: { key: string; label: string }[];
}

interface Mr11TableProps {
  records: any[];
  headers: string[];
  headerGroups?: HeaderGroup[];
  /** Decimal places per column, e.g. { "LME Rate (USD)": 3 } */
  numberFormats?: Record<string, number>;
  /** Columns to outline with a glow, mapped to the colour (e.g. the logged-in department's columns) */
  highlightColumns?: Record<string, string>;
  zoom: number;
  /** Administrators: a delete button on each row */
  onDeleteRow?: (row: any) => void;
  /** The column the rows are sorted by; with onSortChange, each header sorts on click */
  sort?: ColumnSort | null;
  onSortChange?: (sort: ColumnSort | null) => void;
  /** Rows frozen at the top or bottom, by _rowKey; with onFreezeRow, each row gets freeze buttons */
  frozenRows?: Record<string, FrozenAt>;
  /** Freeze a row at the top or bottom, or unfreeze it (null) */
  onFreezeRow?: (row: any, at: FrozenAt | null) => void;
  /** A hide button on each row */
  onHideRow?: (row: any) => void;
  /** Years whose month columns are open; with onToggleYear, each "Total 2026 m2" header opens or closes its year */
  expandedYears?: number[];
  onToggleYear?: (year: number) => void;
}

// Glowing outline for a highlighted header cell, and side lines plus a light tint down its column
const headerGlow = (color: string): React.CSSProperties => ({
  boxShadow: `inset 0 0 0 2px ${color}, 0 0 10px 1px ${color}99`,
  backgroundColor: `${color}1F`,
  color,
  position: 'relative',
  zIndex: 1,
});
const columnGlow = (color: string, last: boolean): React.CSSProperties => ({
  boxShadow: `inset 2px 0 0 ${color}, inset -2px 0 0 ${color}, inset 0 0 8px ${color}55${
    last ? `, inset 0 -2px 0 ${color}` : ''
  }`,
  backgroundColor: `${color}12`,
});

// MR11 master ledger grid, shared by the MR11 page and the CEO dashboard's raw data view
export const Mr11Table: React.FC<Mr11TableProps> = ({
  records,
  headers,
  headerGroups = [],
  numberFormats = {},
  highlightColumns = {},
  zoom,
  onDeleteRow,
  sort = null,
  onSortChange,
  frozenRows = {},
  onFreezeRow,
  onHideRow,
  expandedYears = [],
  onToggleYear,
}) => {
  // A value as shown in a cell: numbers get comma separators (and a formatted column its fixed
  // decimals); identifier columns such as Project No keep their digits
  const cellText = (h: string, v: any): string => {
    if (v === null || v === undefined || v === '') return '—';
    const text = formatCellNumber(v, h, numberFormats[h]);
    // Payment terms amounts are dollar values, not percentages
    return /^payment terms - amount/i.test(h) && /^-?[\d,.]+$/.test(text) ? `$${text}` : text;
  };
  const today = todayInMalaysia();
  const groupOf = (h: string) => headerGroups.find((g) => g.columns.some((c) => c.key === h));
  const subLabelOf = (h: string) => groupOf(h)?.columns.find((c) => c.key === h)?.label ?? h;
  // A header's label, with a click to sort by it: ascending, descending, then the MR11 order
  const sortLabel = (h: string, label: string) => {
    if (!onSortChange) return label;
    const direction = sort?.column === h ? sort.direction : null;
    const Icon = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ArrowUpDown;
    return (
      <button
        type="button"
        onClick={() => onSortChange(nextSort(sort, h))}
        title={
          direction === 'asc'
            ? `Sorted ascending by ${label}: click to sort descending`
            : direction === 'desc'
            ? `Sorted descending by ${label}: click for the MR11 order`
            : `Sort by ${label}`
        }
        className="group/sort inline-flex items-center gap-1 uppercase font-extrabold tracking-wider cursor-pointer hover:text-stone-900"
      >
        {label}
        <Icon
          className={`w-3 h-3 flex-shrink-0 ${
            direction ? 'text-amber-600' : 'text-stone-300 group-hover/sort:text-stone-500'
          }`}
        />
      </button>
    );
  };
  // A year's Total header: a button that shows or hides that year's month columns
  const yearToggle = (h: string) => {
    const m = /^Total (\d{4}) m2$/.exec(h);
    if (!m || !onToggleYear) return null;
    const year = parseInt(m[1], 10);
    const open = expandedYears.includes(year);
    const Icon = open ? ChevronRight : ChevronLeft;
    return (
      <button
        type="button"
        onClick={() => onToggleYear(year)}
        aria-expanded={open}
        title={open ? `Hide the ${year} months` : `Show the ${year} months`}
        className="mt-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-stone-200 bg-white text-[9px] font-mono font-bold normal-case tracking-normal text-stone-500 hover:text-stone-900 hover:border-stone-400 cursor-pointer"
      >
        <Icon className="w-3 h-3" />
        {open ? 'Hide months' : 'Show months'}
      </button>
    );
  };
  const ariaSort = (h: string) =>
    !onSortChange ? undefined : sort?.column !== h ? 'none' : sort.direction === 'asc' ? 'ascending' : 'descending';
  const groupSpan = (idx: number) => {
    const group = groupOf(headers[idx]);
    let span = 1;
    while (group && idx + span < headers.length && groupOf(headers[idx + span]) === group) span++;
    return span;
  };

  return (
    <div className="overflow-auto flex-1 h-full select-text">
      <div
        style={{
          zoom: `${zoom}%`,
          transformOrigin: 'top left',
          transition: 'zoom 0.15s ease',
        }}
        className="inline-block min-w-full align-middle"
      >
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-[#FAF9F6] text-stone-600 font-extrabold uppercase sticky top-0 z-20 text-[10px] tracking-wider border-b border-stone-200">
            <tr>
              <th
                rowSpan={2}
                className="p-2.5 border-r border-stone-200 text-center w-10 bg-[#FAF9F6] sticky left-0 z-30 font-mono"
              >
                #
              </th>
              {headers.map((h, idx) => {
                const group = groupOf(h);
                if (!group) {
                  return (
                    <th
                      key={idx}
                      rowSpan={2}
                      className="p-2.5 border-r border-stone-200 whitespace-nowrap bg-[#FAF9F6]"
                      style={highlightColumns[h] ? headerGlow(highlightColumns[h]) : undefined}
                      aria-sort={ariaSort(h)}
                    >
                      {sortLabel(h, h)}
                      {yearToggle(h)}
                      {/* Month columns: ACTUAL once the month has ended, F'CAST until then */}
                      {monthColumnKind(h, today) && (
                        <div
                          className={`mt-0.5 text-[9px] font-mono ${
                            monthColumnKind(h, today) === 'ACTUAL' ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {monthColumnKind(h, today)}
                        </div>
                      )}
                    </th>
                  );
                }
                // Grouped column: only the first column of the group draws the shared header
                if (idx > 0 && groupOf(headers[idx - 1]) === group) return null;
                const groupColor = group.columns.map((c) => highlightColumns[c.key]).find(Boolean);
                return (
                  <th
                    key={idx}
                    colSpan={groupSpan(idx)}
                    className="p-2.5 border-r border-b border-stone-200 whitespace-nowrap text-center bg-[#FAF9F6]"
                    style={groupColor ? headerGlow(groupColor) : undefined}
                  >
                    {group.label}
                  </th>
                );
              })}
            </tr>
            <tr>
              {headers.map((h, idx) =>
                groupOf(h) ? (
                  <th
                    key={idx}
                    className="p-2.5 border-r border-stone-200 whitespace-nowrap bg-[#FAF9F6]"
                    style={highlightColumns[h] ? headerGlow(highlightColumns[h]) : undefined}
                    aria-sort={ariaSort(h)}
                  >
                    {sortLabel(h, subLabelOf(h))}
                  </th>
                ) : null
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 text-stone-800">
            {records.map((row, rIdx) => {
              const frozen: FrozenAt | undefined = frozenRows[row?._rowKey];
              // A line separates the rows frozen at the top, and those at the bottom, from the rest
              const lineBelow = frozen === 'top' && frozenRows[records[rIdx + 1]?._rowKey] !== 'top';
              const lineAbove = frozen === 'bottom' && frozenRows[records[rIdx - 1]?._rowKey] !== 'bottom';
              const rowActions = row?._rowKey && (onFreezeRow || onHideRow || onDeleteRow);
              const FrozenIcon = frozen === 'top' ? ArrowUpToLine : ArrowDownToLine;
              const fontColor = row?._fontColor || '#000000';
              const isStreamLead = row?._isStreamLead !== false;
              const streamSpan = row?._streamSpan || 1;
              const rowBg = row?._fillColor || undefined;

              return (
                <tr
                  key={rIdx}
                  className="group hover:bg-stone-50/70 transition-colors"
                  style={{
                    backgroundColor: rowBg,
                    ...(lineBelow ? { borderBottom: '2px solid #F59E0B' } : {}),
                    ...(lineAbove ? { borderTop: '2px solid #F59E0B' } : {}),
                  }}
                >
                  {/* Sticky Index Column (freeze and hide buttons, and delete for administrators) */}
                  <td
                    className={`p-2 border-r border-stone-200 text-center font-mono text-[11px] sticky left-0 z-10 font-medium whitespace-nowrap ${
                      frozen ? 'bg-amber-50 text-amber-700' : 'bg-white text-stone-400'
                    }`}
                  >
                    {rowActions ? (
                      <>
                        <span className="inline-flex items-center gap-0.5">
                          {frozen && (
                            <FrozenIcon className="w-3 h-3" aria-label={frozen === 'top' ? 'Frozen at the top' : 'Frozen at the bottom'} />
                          )}
                          {rIdx + 1}
                        </span>
                        {/* Row actions float over the row on hover, so the column keeps its width */}
                        <span className="hidden group-hover:inline-flex absolute left-1 top-1/2 -translate-y-1/2 z-20 items-center gap-0.5 p-0.5 rounded-md bg-white border border-stone-200 shadow-md">
                          {onFreezeRow && (
                            <>
                              <RowAction
                                onClick={() => onFreezeRow(row, frozen === 'top' ? null : 'top')}
                                active={frozen === 'top'}
                                title={frozen === 'top' ? 'Unfreeze this row' : 'Freeze this row at the top (sorting will not move it)'}
                              >
                                <ArrowUpToLine className="w-3.5 h-3.5" />
                              </RowAction>
                              <RowAction
                                onClick={() => onFreezeRow(row, frozen === 'bottom' ? null : 'bottom')}
                                active={frozen === 'bottom'}
                                title={frozen === 'bottom' ? 'Unfreeze this row' : 'Freeze this row at the bottom (sorting will not move it)'}
                              >
                                <ArrowDownToLine className="w-3.5 h-3.5" />
                              </RowAction>
                            </>
                          )}
                          {onHideRow && (
                            <RowAction onClick={() => onHideRow(row)} title="Hide this row (bring it back from Hidden rows)">
                              <EyeOff className="w-3.5 h-3.5" />
                            </RowAction>
                          )}
                          {onDeleteRow && (
                            <RowAction onClick={() => onDeleteRow(row)} title="Delete this row from MR11" danger>
                              <Trash2 className="w-3.5 h-3.5" />
                            </RowAction>
                          )}
                        </span>
                      </>
                    ) : (
                      rIdx + 1
                    )}
                  </td>

                  {/* Cell Data */}
                  {headers.map((h, cIdx) => {
                    const isMergeTarget = isStreamMergeColumn(h);
                    const glowColor = highlightColumns[h];

                    // Stream merged columns (Shellplan & Design)
                    if (isMergeTarget) {
                      if (!isStreamLead) return null;
                      return (
                        <td
                          key={cIdx}
                          rowSpan={streamSpan}
                          // A filled row's own cell shows the row's full fill colour; merged cells stay light grey
                          className={`p-2 border-r border-stone-200 align-middle font-bold text-stone-900 ${
                            String(row?.[h] ?? '').includes('\n') ? 'whitespace-pre text-left text-[11px]' : 'whitespace-nowrap text-center'
                          } ${rowBg ? '' : 'bg-stone-50/80'}`}
                          style={{
                            ...(glowColor ? columnGlow(glowColor, rIdx + streamSpan >= records.length) : {}),
                            // An unmerged cell keeps its BD row's font colour
                            ...(streamSpan === 1 && fontColor !== '#000000' ? { color: fontColor } : {}),
                          }}
                        >
                          {h === DESIGN_DATE_COLUMN && Array.isArray(row?._designDateParts) && row._designDateParts.length > 0 ? (
                            <DesignDates parts={row._designDateParts} today={today} />
                          ) : (
                            cellText(h, row?.[h])
                          )}
                        </td>
                      );
                    }

                    // ATD Highlight check
                    const cellBgColor =
                      row?._cellColors?.[h] ||
                      (isAtdColumn(h) ? row?._atdColor : undefined);

                    const isYellowAtd = cellBgColor === '#FFFF00';

                    // A BD price in a currency MR11 can't convert: marked on Selling Price (USD)
                    const priceNote = h === 'Selling Price (USD)' ? row?._priceNote : null;

                    return (
                      <td
                        key={cIdx}
                        title={priceNote || undefined}
                        // A value on several lines (e.g. ETD/ATD) keeps its line breaks
                        className={`p-2 border-r border-stone-200 ${
                          String(row?.[h] ?? '').includes('\n') ? 'whitespace-pre align-top' : 'whitespace-nowrap'
                        } transition-colors ${
                          isYellowAtd
                            ? 'bg-[#FEF08A] font-extrabold text-amber-950 ring-1 ring-amber-300'
                            : ''
                        }`}
                        style={{
                          ...(glowColor ? columnGlow(glowColor, rIdx === records.length - 1) : {}),
                          // keep the yellow ATD fill visible under the outline
                          ...(glowColor && isYellowAtd ? { backgroundColor: undefined } : {}),
                          // The BD row's font colour runs across the whole row, as in the BD file
                          color: isYellowAtd ? '#78350F' : fontColor !== '#000000' ? fontColor : undefined,
                          fontWeight: fontColor !== '#000000' && cIdx < 4 ? 'bold' : 'normal',
                        }}
                      >
                        {cellText(h, row?.[h])}
                        {priceNote && <span className="ml-1 text-[10px] font-bold text-rose-600">⚠ currency</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Mr11Table;
