import ExcelJS from 'exceljs';

export interface FortuneCell {
  r: number;
  c: number;
  v: {
    v?: any;
    m?: string;
    f?: string;
    bg?: string;
    fc?: string;
    bl?: number;
    it?: number;
    ht?: number;
    vt?: number;
    tb?: number;
    rowspan?: number;
    colspan?: number;
  };
}

export interface FortuneSheet {
  name: string;
  index: number;
  status: number;
  order: number;
  celldata: FortuneCell[];
  config: {
    merge: Record<string, { r: number; c: number; rs: number; cs: number }>;
    rowlen?: Record<string, number>;
    columnlen?: Record<string, number>;
  };
}

function extractRawValue(val: any): any {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object') {
    if (Array.isArray(val.richText)) {
      return val.richText.map((t: any) => t.text || '').join('');
    }
    if ('result' in val) {
      return extractRawValue(val.result);
    }
    // Formula saved without a calculated result: there is no value to show
    if ('formula' in val || 'sharedFormula' in val) {
      return null;
    }
    if (val instanceof Date) {
      return val.toISOString().split('T')[0];
    }
    if ('text' in val) {
      return val.text;
    }
    if ('error' in val) {
      return val.error;
    }
  }
  return val;
}

// ExcelJS's cell.value drops a formula result of 0 (or false / ""); cell.result keeps it
function cellValue(cell: ExcelJS.Cell): any {
  if (cell.type === ExcelJS.ValueType.Formula) {
    const result = cell.result;
    return result === undefined ? null : { result };
  }
  return cell.value;
}

function safeString(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (val instanceof Date) return val.toISOString().split('T')[0];
  try {
    return String(val);
  } catch {
    return '';
  }
}

// Workbook theme colours by Excel's theme index (0 lt1, 1 dk1, 2 lt2, 3 dk2, 4-9 accent1-6,
// 10 hlink, 11 folHlink). Cells coloured from the theme (e.g. "Blue, Accent 4") store only
// that index, not a hex value.
function readThemeColors(workbook: ExcelJS.Workbook): string[] {
  const xml: string = (workbook as any)._themes?.theme1 || '';
  const scheme = xml.match(/<a:clrScheme[\s\S]*?<\/a:clrScheme>/)?.[0] || '';
  const hexOf = (tag: string) => {
    const block = scheme.match(new RegExp(`<a:${tag}>([\\s\\S]*?)</a:${tag}>`))?.[1] || '';
    const hex = block.match(/srgbClr val="([0-9A-Fa-f]{6})"/)?.[1] || block.match(/lastClr="([0-9A-Fa-f]{6})"/)?.[1];
    return hex ? `#${hex.toUpperCase()}` : '';
  };
  return ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'].map(hexOf);
}

// Excel tint: negative darkens, positive lightens
function applyTint(hex: string, tint: number): string {
  if (!tint) return hex;
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const tinted = channels.map((v) => Math.round(tint < 0 ? v * (1 + tint) : v + (255 - v) * tint));
  return `#${tinted.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

// A cell colour as hex, whether stored as ARGB or as a theme colour
function colorHex(color: any, theme: string[]): string | undefined {
  if (!color) return undefined;
  if (typeof color.argb === 'string') return `#${color.argb.slice(-6).toUpperCase()}`;
  if (typeof color.theme === 'number' && theme[color.theme]) return applyTint(theme[color.theme], Number(color.tint) || 0);
  return undefined;
}

export async function parseAndNormalizeWorkbook(input: string | Buffer): Promise<FortuneSheet[]> {
  const workbook = new ExcelJS.Workbook();
  if (Buffer.isBuffer(input)) {
    await workbook.xlsx.load(input as any);
  } else {
    await workbook.xlsx.readFile(input);
  }

  const sheets: FortuneSheet[] = [];
  const theme = readThemeColors(workbook);

  workbook.eachSheet((worksheet, sheetId) => {
    const celldata: FortuneCell[] = [];
    const mergeConfig: Record<string, { r: number; c: number; rs: number; cs: number }> = {};
    const columnlen: Record<string, number> = {};
    const rowlen: Record<string, number> = {};

    worksheet.columns.forEach((col, idx) => {
      if (col && col.width) {
        columnlen[String(idx)] = Math.round(col.width * 8);
      }
    });

    const model: any = worksheet.model || {};
    const mergeMap = new Map<string, { r: number; c: number; rs: number; cs: number }>();

    if (Array.isArray(model.merges)) {
      model.merges.forEach((mergeRangeStr: string) => {
        try {
          const [start, end] = mergeRangeStr.split(':');
          const startCell = worksheet.getCell(start);
          const endCell = worksheet.getCell(end || start);
          const r = Number(startCell.row) - 1;
          const c = Number(startCell.col) - 1;
          const rs = Number(endCell.row) - Number(startCell.row) + 1;
          const cs = Number(endCell.col) - Number(startCell.col) + 1;
          const info = { r, c, rs, cs };
          mergeConfig[`${r}_${c}`] = info;

          for (let ri = r; ri < r + rs; ri++) {
            for (let ci = c; ci < c + cs; ci++) {
              mergeMap.set(`${ri}_${ci}`, info);
            }
          }
        } catch {
          // ignore unparseable merge range
        }
      });
    }

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const r = rowNumber - 1;
      if (row && row.height) {
        rowlen[String(r)] = Math.round(row.height * 1.33);
      }

      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const c = colNumber - 1;
        let bgHex: string | undefined;

        if (cell.fill && cell.fill.type === 'pattern') {
          bgHex = colorHex((cell.fill as any).fgColor, theme);
        }

        let fontColor: string | undefined;
        fontColor = colorHex(cell.font?.color, theme);

        let rawVal = extractRawValue(cellValue(cell));

        const parentMerge = mergeMap.get(`${r}_${c}`);
        if (parentMerge && (rawVal === null || rawVal === undefined || rawVal === '')) {
          try {
            const parentCell = worksheet.getCell(parentMerge.r + 1, parentMerge.c + 1);
            rawVal = extractRawValue(cellValue(parentCell));
          } catch {
            // keep null
          }
        }

        const textStr = safeString(rawVal);
        const rootMerge = mergeConfig[`${r}_${c}`];

        celldata.push({
          r,
          c,
          v: {
            v: rawVal,
            m: textStr,
            f: cell.formula ? `=${cell.formula}` : undefined,
            bg: bgHex,
            fc: fontColor,
            bl: cell.font?.bold ? 1 : 0,
            it: cell.font?.italic ? 1 : 0,
            ht: cell.alignment?.horizontal === 'center' ? 0 : cell.alignment?.horizontal === 'right' ? 2 : 1,
            vt: cell.alignment?.vertical === 'middle' ? 0 : cell.alignment?.vertical === 'top' ? 1 : 2,
            tb: cell.alignment?.wrapText ? 2 : 0,
            rowspan: rootMerge ? rootMerge.rs : undefined,
            colspan: rootMerge ? rootMerge.cs : undefined,
          },
        });
      });
    });

    sheets.push({
      name: worksheet.name || `Sheet${sheetId}`,
      index: sheetId - 1,
      status: sheetId === 1 ? 1 : 0,
      order: sheetId - 1,
      celldata,
      config: { merge: mergeConfig, columnlen, rowlen },
    });
  });

  return sheets;
}