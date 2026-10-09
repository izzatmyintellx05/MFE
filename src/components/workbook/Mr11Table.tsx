import React from 'react';
import { DesignDatePart, designDateColor, monthColumnKind, todayInMalaysia } from '../../utils/designDates';
import { formatCellNumber } from '../../utils/formatNumber';

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

const STREAM_MERGE_COLUMNS = [
  'Shell Plan Status - Pending Consultant Drawings',
  'Shell Plan Approved Date',
  'Formwork Design Status',
  'Actual Formwork Order Completion Date',
  'Total Quantity Ordered m2',
];

const isStreamMergeColumn = (colHeader: string) => {
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
export const Mr11Table: React.FC<Mr11TableProps> = ({ records, headers, headerGroups = [], numberFormats = {}, highlightColumns = {}, zoom }) => {
  // A value as shown in a cell: numbers get comma separators (and a formatted column its fixed
  // decimals); identifier columns such as Project No keep their digits
  const cellText = (h: string, v: any): string => {
    if (v === null || v === undefined || v === '') return '—';
    return formatCellNumber(v, h, numberFormats[h]);
  };
  const today = todayInMalaysia();
  const groupOf = (h: string) => headerGroups.find((g) => g.columns.some((c) => c.key === h));
  const subLabelOf = (h: string) => groupOf(h)?.columns.find((c) => c.key === h)?.label ?? h;
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
                    >
                      {h}
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
                  >
                    {subLabelOf(h)}
                  </th>
                ) : null
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 text-stone-800">
            {records.map((row, rIdx) => {
              const fontColor = row?._fontColor || '#000000';
              const isStreamLead = row?._isStreamLead !== false;
              const streamSpan = row?._streamSpan || 1;
              const rowBg = row?._fillColor || undefined;

              return (
                <tr
                  key={rIdx}
                  className="hover:bg-stone-50/70 transition-colors"
                  style={{ backgroundColor: rowBg }}
                >
                  {/* Sticky Index Column */}
                  <td className="p-2 border-r border-stone-200 text-center text-stone-400 font-mono text-[11px] sticky left-0 z-10 bg-white font-medium">
                    {rIdx + 1}
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

                    return (
                      <td
                        key={cIdx}
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
