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

export async function parseAndNormalizeWorkbook(input: string | Buffer): Promise<FortuneSheet[]> {
  const workbook = new ExcelJS.Workbook();
  if (Buffer.isBuffer(input)) {
    await workbook.xlsx.load(input as any);
  } else {
    await workbook.xlsx.readFile(input);
  }

  const sheets: FortuneSheet[] = [];

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
          const colorObj = (cell.fill as any).fgColor;
          if (colorObj?.argb && typeof colorObj.argb === 'string') {
            bgHex = `#${colorObj.argb.slice(-6).toUpperCase()}`;
          }
        }

        let fontColor: string | undefined;
        if (cell.font?.color?.argb && typeof cell.font.color.argb === 'string') {
          fontColor = `#${cell.font.color.argb.slice(-6).toUpperCase()}`;
        }

        let rawVal = extractRawValue(cell.value);

        const parentMerge = mergeMap.get(`${r}_${c}`);
        if (parentMerge && (rawVal === null || rawVal === undefined || rawVal === '')) {
          try {
            const parentCell = worksheet.getCell(parentMerge.r + 1, parentMerge.c + 1);
            rawVal = extractRawValue(parentCell.value);
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