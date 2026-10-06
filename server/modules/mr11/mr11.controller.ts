import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import { executeMr11Pipeline } from './mr11.engine';
import { getLatestMr11Run, hydrateActiveVersionsFromDb } from '../../db/supabase';
import * as mr11ConfigModule from '../../config/mr11.config';
import {
  MR11_HEADER_GROUPS,
  MR11_NUMBER_FORMATS,
  MR11_COLUMN_DEPARTMENTS,
  MR11_DEPARTMENT_COLORS,
} from '../../config/mr11.config';
import { getUsdToMyrRate } from '../../utils/fx';
import { getLmeAluminiumPrice } from '../../utils/lme';

const prisma = new PrismaClient();

const ORDERED_HEADER_LIST: string[] =
  (mr11ConfigModule as any).ORDERED_HEADER_LIST ||
  ((mr11ConfigModule as any).MR11_ORDERED_COLUMNS || []).map((col: any) => col.target || col.header || String(col));

export async function getLatestMr11(req: Request, res: Response) {
  try {
    // Supabase first: this instance's memory may be stale if another instance handled an upload
    const latestRun: any = await getLatestMr11Run(prisma);

    const config = await prisma.mr11Config.findUnique({ where: { id: 'singleton' } });

    // Today's USD -> MYR rate and LME aluminium price, shown above the ledger
    const [fx, lmePrice] = await Promise.all([getUsdToMyrRate(), getLmeAluminiumPrice()]);
    const run = latestRun;

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

    const records = latestRun.records as Record<string, any>[];
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
    worksheet.addRow(headers.map((h) => groupOf(h)?.label ?? h));
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

      if (row['_fontColor']) {
        const hex = String(row['_fontColor']).replace('#', '');
        const projCell = addedRow.getCell(1);
        projCell.font = {
          color: { argb: `FF${hex}` },
          bold: true,
        };
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

    // Merged ONLY for ShellPlan and Design across the [Project, Stream] span
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