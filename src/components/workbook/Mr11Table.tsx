import React from 'react';

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

interface Mr11TableProps {
  records: any[];
  headers: string[];
  zoom: number;
}

// MR11 master ledger grid, shared by the MR11 page and the CEO dashboard's raw data view
export const Mr11Table: React.FC<Mr11TableProps> = ({ records, headers, zoom }) => {
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
              <th className="p-2.5 border-r border-stone-200 text-center w-10 bg-[#FAF9F6] sticky left-0 z-30 font-mono">
                #
              </th>
              {headers.map((h, idx) => (
                <th
                  key={idx}
                  className="p-2.5 border-r border-stone-200 whitespace-nowrap bg-[#FAF9F6]"
                >
                  {h}
                </th>
              ))}
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

                    // Stream merged columns (Shellplan & Design)
                    if (isMergeTarget) {
                      if (!isStreamLead) return null;
                      return (
                        <td
                          key={cIdx}
                          rowSpan={streamSpan}
                          className="p-2 border-r border-stone-200 whitespace-nowrap text-center align-middle font-bold text-stone-900 bg-stone-50/80"
                        >
                          {row?.[h] !== null && row?.[h] !== undefined && row?.[h] !== ''
                            ? String(row[h])
                            : '—'}
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
                        className={`p-2 border-r border-stone-200 whitespace-nowrap transition-colors ${
                          isYellowAtd
                            ? 'bg-[#FEF08A] font-extrabold text-amber-950 ring-1 ring-amber-300'
                            : ''
                        }`}
                        style={{
                          color: isYellowAtd
                            ? '#78350F'
                            : fontColor !== '#000000' && cIdx < 4
                            ? fontColor
                            : undefined,
                          fontWeight: fontColor !== '#000000' && cIdx < 4 ? 'bold' : 'normal',
                        }}
                      >
                        {row?.[h] !== null && row?.[h] !== undefined && row?.[h] !== ''
                          ? String(row[h])
                          : '—'}
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
