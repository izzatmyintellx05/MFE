import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import { executeMr11Pipeline, ApprovalHistoryGroup } from './mr11.engine';
import { getLatestMr11Run, hydrateActiveVersionsFromDb } from '../../db/supabase';
import * as mr11ConfigModule from '../../config/mr11.config';
import {
  MR11_HEADER_GROUPS,
  MR11_NUMBER_FORMATS,
  MR11_COLUMN_DEPARTMENTS,
  MR11_DEPARTMENT_COLORS,
} from '../../config/mr11.config';
import { getUsdToMyrRate, getUsdRates } from '../../utils/fx';
import { applyLivePricing } from './mr11.pricing';
import { getLmeAluminiumPrice } from '../../utils/lme';

const prisma = new PrismaClient();

// Identifier columns (not amounts): no thousands separators
const ID_COLUMN = /project\s*no|^po$|^nca$|nca\s*no|stream|series|revision|^rev\b|code|year|phone|^tel|^no\.?$|^#$/i;

const ORDERED_HEADER_LIST: string[] =
  (mr11ConfigModule as any).ORDERED_HEADER_LIST ||
  ((mr11ConfigModule as any).MR11_ORDERED_COLUMNS || []).map((col: any) => col.target || col.header || String(col));

export async function getLatestMr11(req: Request, res: Response) {
  try {
    // Supabase first: this instance's memory may be stale if another instance handled an upload
    const latestRun: any = await getLatestMr11Run(prisma);

    const config = await prisma.mr11Config.findUnique({ where: { id: 'singleton' } });

    // Today's USD -> MYR rate and LME aluminium price, shown above the ledger
    const [fx, lmePrice, usdRates] = await Promise.all([getUsdToMyrRate(), getLmeAluminiumPrice(), getUsdRates()]);
    // Selling Price (USD), LME Adjusted and Final Selling Price for today's LME price and rates
    const run =
      latestRun && Array.isArray(latestRun.records)
        ? { ...latestRun, records: applyLivePricing(latestRun.records, lmePrice?.cash ?? null, usdRates) }
        : latestRun;

    return res.json({
      success: true,
      data: {
        run,
        fxRate: fx,
        lmePrice,
        visibleColumns: (config?.visibleColumns as string[]) || [],
        orderedHeaders: ORDERED_HEADER_LIST,
        headerGroups: MR11_HEADER_GROUPS,
        numberFormats: MR11_NUMBER_FORMATS,
        // Lets a department user's own columns be highlighted in their department colour
        columnDepartments: MR11_COLUMN_DEPARTMENTS,
        departmentColors: MR11_DEPARTMENT_COLORS,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
}

export async function triggerMr11Regenerate(req: Request, res: Response) {
  try {
    await hydrateActiveVersionsFromDb(prisma);
    const runId = await executeMr11Pipeline(prisma);
    return res.json({ success: true, message: 'MR11 regenerated', runId });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
}

// Shell Plan approval history (every Approved / Reapprove with its revision), one row per
// approval, newest first; kept with each MR11 and shown on the Shell Plan & Design page
export async function getShellplanApprovalHistory(req: Request, res: Response) {
  try {
    const latestRun: any = await getLatestMr11Run(prisma);
    const groups: Record<string, ApprovalHistoryGroup> = latestRun?.sourceSnapshot?.shellplanApprovalHistory || {};
    const rows = Object.values(groups).flatMap((g) =>
      (g.entries || []).map((e) => ({
        projectNo: g.projectNo,
        shortName: g.shortName,
        projectName: g.projectName,
        stream: g.stream,
        fillColor: g.fillColor,
        status: e.status,
        revision: e.revision,
        approvedDate: e.approvedDate,
        submittedDate: e.submittedDate,
        recordedOn: e.recordedOn,
      }))
    );
    rows.sort(
      (a, b) =>
        String(b.recordedOn).localeCompare(String(a.recordedOn)) ||
        String(b.approvedDate ?? '').localeCompare(String(a.approvedDate ?? '')) ||
        String(a.shortName ?? '').localeCompare(String(b.shortName ?? '')) ||
        String(a.stream).localeCompare(String(b.stream), undefined, { numeric: true })
    );
    return res.json({ success: true, data: rows });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
}

// m2 dispatched in each month, one row per MR11 row that has any (Dispatch page). Local rows
// come from the Local file's daily columns; Overseas rows from how much Total Dispatch went up
// between the last uploads of a month and of the month before (the current month so far).
export async function getDispatchMonthly(req: Request, res: Response) {
  try {
    const latestRun: any = await getLatestMr11Run(prisma);
    const records: Record<string, any>[] = Array.isArray(latestRun?.records) ? latestRun.records : [];
    const rows = records
      .filter((r) => Object.values(r._dispatchedByMonth || {}).some((v: any) => Number(v) > 0))
      .map((r) => ({
        shortName: r['Short Name'] ?? null,
        projectNo: r['Project No.'] ?? r['Project No'] ?? null,
        stream: String(r['Stream'] ?? ''),
        productType: r['Products type'] ?? null,
        file: r._dispatchFile ?? null,
        fontColor: r._fontColor ?? null,
        fillColor: r._fillColor ?? null,
        totalDispatch: r['Total Dispatch'] ?? null,
        months: r._dispatchedByMonth as Record<string, number>,
      }));
    return res.json({ success: true, data: rows });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
}

export async function getPlanningSeriesHistory(req: Request, res: Response) {
  try {
    const data = await prisma.planningSeriesHistory.findMany({
      orderBy: [
        { projectNo: 'asc' },
        { stream: 'asc' },
        { seriesNumber: 'asc' },
      ],
    });
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
}

export async function getProductionSeriesHistory(req: Request, res: Response) {
  try {
    const data = await prisma.productionSeriesHistory.findMany({
      orderBy: [
        { projectShortname: 'asc' },
        { stream: 'asc' },
        { seriesNumber: 'asc' },
      ],
    });
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
}

export async function exportMr11ToExcel(req: Request, res: Response) {
  try {
    const latestRun = await getLatestMr11Run(prisma);

    if (!latestRun || !Array.isArray(latestRun.records) || latestRun.records.length === 0) {
      return res.status(400).json({ success: false, error: { message: 'No MR11 records to export' } });
    }

    const [lmePrice, usdRates] = await Promise.all([getLmeAluminiumPrice(), getUsdRates()]);
    const records = applyLivePricing(latestRun.records as Record<string, any>[], lmePrice?.cash ?? null, usdRates);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('MR11 Master');

    const headers = ORDERED_HEADER_LIST;
    worksheet.columns = headers.map((header) => ({
      key: header,
      width: Math.max(header.length + 4, 16),
      ...(MR11_NUMBER_FORMATS[header] !== undefined
        ? { style: { numFmt: `0.${'0'.repeat(MR11_NUMBER_FORMATS[header])}` } }
        : {}),
    }));

    // Two header rows: grouped columns (e.g. Payment terms) share a merged top cell with
    // their sub-labels below; every other column is merged across both rows.
    const groupOf = (h: string) => MR11_HEADER_GROUPS.find((g) => g.columns.some((c) => c.key === h));
    const subLabel = (h: string) => groupOf(h)?.columns.find((c) => c.key === h)?.label ?? h;
    // Month columns say whether they hold actuals (month ended) or the forecast
    const currentMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date()).slice(0, 7);
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const headerText = (h: string) => {
      const m = /^([A-Z][a-z]{2})-(\d{2})$/.exec(h);
      if (!m || !MONTHS.includes(m[1])) return h;
      const key = `20${m[2]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, '0')}`;
      return `${h}\n${key < currentMonth ? 'ACTUAL' : "F'CAST"}`;
    };
    worksheet.addRow(headers.map((h) => groupOf(h)?.label ?? headerText(h)));
    worksheet.addRow(headers.map((h) => (groupOf(h) ? subLabel(h) : h)));

    for (let c = 1; c <= headers.length; ) {
      const group = groupOf(headers[c - 1]);
      let span = 1;
      while (group && c + span <= headers.length && groupOf(headers[c + span - 1]) === group) span++;
      if (group && span > 1) worksheet.mergeCells(1, c, 1, c + span - 1);
      if (!group) worksheet.mergeCells(1, c, 2, c);
      c += span;
    }

    [1, 2].forEach((r) => {
      const headerRow = worksheet.getRow(r);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      headerRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      });
    });

    records.forEach((row) => {
      const orderedRowData: Record<string, any> = {};
      headers.forEach((h) => {
        // Columns with fixed decimals are written as numbers so Excel can apply the format
        const places = MR11_NUMBER_FORMATS[h];
        const n = Number(row[h]);
        orderedRowData[h] = places !== undefined && row[h] !== null && row[h] !== '' && !isNaN(n) ? n : row[h] ?? '';
      });
      const addedRow = worksheet.addRow(orderedRowData);
      // Amounts show comma separators in Excel too; identifier columns (Project No ...) keep their digits
      headers.forEach((h, i) => {
        const v = orderedRowData[h];
        if (typeof v !== 'number' || MR11_NUMBER_FORMATS[h] !== undefined || ID_COLUMN.test(h)) return;
        addedRow.getCell(i + 1).numFmt = Number.isInteger(v) ? '#,##0' : '#,##0.000';
      });
      // Values on several lines (e.g. ETD/ATD) are shown wrapped, one line each
      headers.forEach((h, i) => {
        if (String(row[h] ?? '').includes('\n')) addedRow.getCell(i + 1).alignment = { wrapText: true, vertical: 'top' };
      });

      if (row['_fontColor']) {
        // The BD row's font colour runs across the whole row (project columns in bold)
        const hex = String(row['_fontColor']).replace('#', '');
        addedRow.eachCell({ includeEmpty: true }, (cell, col) => {
          cell.font = { color: { argb: `FF${hex}` }, bold: col <= 4 && hex !== '000000' };
        });
      }

      if (row['_fillColor']) {
        const hex = String(row['_fillColor']).replace('#', '');
        addedRow.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: `FF${hex}` },
          };
        });
      }
    });

    // Completion dates coloured by status (dark green done, yellow done but ahead, red not done)
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date());
    const designDateCol = headers.indexOf('Actual Formwork Order Completion Date') + 1;
    if (designDateCol > 0) {
      records.forEach((row, i) => {
        const parts: { level: string | null; date: string; completed: boolean }[] = row['_designDateParts'] || [];
        if (parts.length === 0) return;
        const color = (p: { date: string; completed: boolean }) =>
          !p.completed ? 'FFDC2626' : p.date <= today ? 'FF166534' : 'FFA16207';
        const cell = worksheet.getCell(i + 3, designDateCol);
        cell.value = {
          richText: parts.flatMap((p, j) => [
            ...(j > 0 ? [{ text: ', ' }] : []),
            ...(p.level ? [{ text: `${p.level}: `, font: { color: { argb: 'FF57534E' } } }] : []),
            { text: p.date, font: { bold: true, color: { argb: color(p) } } },
          ]),
        };
      });
    }

    // Merged ONLY for ShellPlan and Design across the [Project, Stream] span
    // Fixed-decimal columns keep their decimals, with separators
    headers.forEach((h, i) => {
      const places = MR11_NUMBER_FORMATS[h];
      if (places !== undefined) worksheet.getColumn(i + 1).numFmt = `#,##0.${'0'.repeat(places)}`;
    });

    const STREAM_MERGE_COLS = [
      'Shell Plan Status - Pending Consultant Drawings', // Col AJ
      'Shell Plan Approved Date',                         // Col AK
      'Formwork Design Status',                          // Col AL
      'Actual Formwork Order Completion Date',           // Col AM
      'Total Quantity Ordered m2',                       // Col AN
    ];

    STREAM_MERGE_COLS.forEach((colName) => {
      const colIdx = headers.findIndex(
        (h) => h === colName || h.toLowerCase().trim() === colName.toLowerCase().trim()
      ) + 1;

      if (colIdx > 0) {
        let r = 3; // Data starts at row 3 (rows 1-2 are the header)
        for (let i = 0; i < records.length; ) {
          const span = records[i]['_streamSpan'] || 1;
          if (span > 1) {
            worksheet.mergeCells(r, colIdx, r + span - 1, colIdx);
            const mergedCell = worksheet.getCell(r, colIdx);
            mergedCell.alignment = { vertical: 'middle', horizontal: 'center' };
          }
          r += span;
          i += span;
        }
      }
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=MR11_Master_Order_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err.message || 'Export failed' } });
  }
}