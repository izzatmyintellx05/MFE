import React, { useState } from 'react';

// Excel column letters for a 0-based index: A..Z, then AA..AZ, BA..BZ, ...
export function columnLetter(index: number): string {
  let n = index + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

interface HighFidelityViewerProps {
  data: any[];
}

export const HighFidelityViewer: React.FC<HighFidelityViewerProps> = ({ data }) => {
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        No workbook sheets parsed.
      </div>
    );
  }

  const activeSheet = data[activeSheetIdx] || data[0];
  const celldata = activeSheet.celldata || [];
  const merges = activeSheet.config?.merge || {};

  let maxR = 0;
  let maxC = 0;
  const gridMap: Record<string, any> = {};
  const coveredCells = new Set<string>();

  Object.values(merges).forEach((m: any) => {
    for (let r = m.r; r < m.r + m.rs; r++) {
      for (let c = m.c; c < m.c + m.cs; c++) {
        if (r !== m.r || c !== m.c) {
          coveredCells.add(`${r}_${c}`);
        }
      }
    }
  });

  celldata.forEach((cell: any) => {
    if (cell.r > maxR) maxR = cell.r;
    if (cell.c > maxC) maxC = cell.c;
    gridMap[`${cell.r}_${cell.c}`] = cell.v;
  });

  const rowIndices = Array.from({ length: Math.min(maxR + 1, 300) }, (_, i) => i);
  const colIndices = Array.from({ length: Math.min(maxC + 1, 60) }, (_, i) => i);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-slate-300 overflow-hidden shadow-inner">
      <div className="flex-1 overflow-auto bg-slate-100">
        <table className="border-collapse bg-white text-xs select-none">
          <thead>
            <tr className="bg-slate-200 sticky top-0 z-20">
              <th className="w-12 min-w-[48px] p-1.5 border border-slate-300 text-center font-bold text-slate-500 bg-slate-200">
                #
              </th>
              {colIndices.map((colIdx) => {
                const colLetter = columnLetter(colIdx);
                return (
                  <th
                    key={colIdx}
                    className="min-w-[120px] px-2 py-1.5 border border-slate-300 text-center font-semibold text-slate-600 uppercase"
                  >
                    {colLetter}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rowIndices.map((rowIdx) => (
              <tr key={rowIdx} className="hover:bg-blue-50/20">
                <td className="w-12 min-w-[48px] p-1 border border-slate-300 text-center font-mono text-[11px] text-slate-400 bg-slate-100 sticky left-0 z-10">
                  {rowIdx + 1}
                </td>
                {colIndices.map((colIdx) => {
                  const coordKey = `${rowIdx}_${colIdx}`;

                  if (coveredCells.has(coordKey)) {
                    return null;
                  }

                  const cell = gridMap[coordKey];
                  const mergeInfo = merges[coordKey];
                  const value = cell?.m || cell?.v;
                  const bg = cell?.bg;
                  const fc = cell?.fc;
                  const isBold = cell?.bl === 1;

                  return (
                    <td
                      key={colIdx}
                      rowSpan={mergeInfo?.rs || 1}
                      colSpan={mergeInfo?.cs || 1}
                      style={{
                        backgroundColor: bg || undefined,
                        color: fc || undefined,
                      }}
                      className={`p-1.5 border border-slate-300 whitespace-nowrap text-slate-800 ${
                        isBold ? 'font-bold' : ''
                      } ${mergeInfo ? 'bg-slate-50/60 font-semibold' : ''}`}
                    >
                      {value !== undefined && value !== null ? String(value) : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 border-t border-slate-300 overflow-x-auto select-none">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-2">
          Sheets:
        </span>
        {data.map((sheet, idx) => (
          <button
            key={sheet.name || idx}
            onClick={() => setActiveSheetIdx(idx)}
            className={`px-4 py-1.5 rounded-t text-xs font-semibold border-t border-x transition ${
              activeSheetIdx === idx
                ? 'bg-white border-slate-300 text-blue-600 shadow-sm'
                : 'bg-slate-200 border-transparent text-slate-600 hover:bg-slate-300'
            }`}
          >
            {sheet.name || `Sheet${idx + 1}`}
          </button>
        ))}
      </div>
    </div>
  );
};