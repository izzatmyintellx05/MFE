import { RoleCode } from '@prisma/client';

export interface ColumnMapping {
  target: string;
  sourceDept: RoleCode;
  sourceColumn: string;
  type: 'string' | 'number' | 'date';
  /** Only read the source column with exactly this name (no prefix matching). */
  exact?: boolean;
  /** Other header names the department may use for the same column (tried in order). */
  aliases?: string[];
}

/**
 * Columns shown under a shared top header (two-row header), matching the department
 * workbook layout. `key` is the MR11 column name; `label` is the text in the second row.
 */
export interface HeaderGroup {
  label: string;
  columns: { key: string; label: string }[];
}

export const MR11_HEADER_GROUPS: HeaderGroup[] = [
  {
    label: 'Payment terms',
    columns: [
      { key: 'Payment terms - Percentage', label: 'Percentage' },
      { key: 'Payment terms - Type', label: 'Type' },
      { key: 'Payment terms - Balance Percentage', label: 'Balance Percentage' },
      { key: 'Payment terms - Type 2', label: 'Type' },
      { key: 'Payment terms - Balance Percentage 2', label: 'Balance Percentage' },
      { key: 'Payment terms - Type 3', label: 'Type' },
    ],
  },
];

/** Decimal places shown for numeric MR11 columns (MR11 page and Excel export). */
export const MR11_NUMBER_FORMATS: Record<string, number> = {
  'LME Rate (USD)': 3,
  'LME Adjusted (USD)': 3,
  'Final Selling Price (USD)': 2,
};

export const MR11_SOURCE_KEY_MAP: Record<RoleCode, string[]> = {
  BD: [
    'Customer & Project Name',
    'Project Name',
    'Project No',
    'Project No.',
    'Short Name',
    'Project Shortname',
  ],
  FINANCE: [
    'Customer & Project Name',
    'Project Name',
    'Project No',
    'Project No.',
    'Short Name',
    'Project Shortname',
  ],
  SHELLPLAN: [
    'Customer & Project Name',
    'Project Name',
    'Project No',
    'Project No.',
    'Short Name',
    'Project Shortname',
    'Building Name',
  ],
  DESIGN: [
    'Project No. (from design column A)',
    'Project No',
    'Project No.',
    'Customer & Project Name',
    'Project Name',
    'Short Name',
    'Project Shortname',
  ],
  PLANNING: [
    'Project No. (from design column A)',
    'Project No',
    'Project No.',
    'Project Shortname (from bd column C)',
    'Project Shortname',
    'Customer & Project Name',
    'Project Name',
  ],
  PRODUCTION: [
    'Project Shortname (from planning column B)',
    'Project Shortname',
    'Short Name',
    'Project No',
    'Project No.',
  ],
  DISPATCH: [
    'Project Shortname (from bd column C)',
    'Project Shortname',
    'Project Short Code',
    'Short Code',
    'Short Name',
    'Customer & Project Name',
    'Project Name',
    'Project No',
    'Project No.',
  ],
  ADMIN: [],
  CEO: [],
};

// Complete ordered list preserving all BD/commercial columns, Shellplan, Design,
// Planning, Production, Dispatch, ATD, and 2026/2027 monthly columns.
// "BU Actual/Forecast" is completely removed.
export const ORDERED_HEADER_LIST = [
  // --- BD & Commercial Columns (Col A to Col AI) ---
  'Customer & Project Name',
  'Project No',
  'Short Name',
  'Stream',
  'Countries',
  'PIC',
  'Status',
  'Products type',
  'Formwork type',
  'Remarks',
  'PO',
  'PO date',
  'NCA',
  'NCA date',
  'Original NCA Qty',
  'Revised NCA Qty',
  'NCA Remarks',
  // Payment terms group (two-row header, same layout as the BD workbook)
  'Payment terms - Percentage',
  'Payment terms - Type',
  'Payment terms - Balance Percentage',
  'Payment terms - Type 2',
  'Payment terms - Balance Percentage 2',
  'Payment terms - Type 3',
  'Selling Price (USD)',
  'LME',
  'LME Rate (USD)',
  'Incoterms',
  'Props, WPB, Waler, Acc (USD)',
  'Aluminium Weight Adjusted (USD)',
  'LME Adjusted (USD)',
  'Freight Adjusted (USD)',
  'Final Selling Price (USD)',
  'Advance Received / Payment Status',
  'Actual Received',
  'Payment Date',

  // --- Shellplan Columns (Col AJ, AK) ---
  'Shell Plan Status - Pending Consultant Drawings',
  'Shell Plan Approved Date',

  // --- Design Columns (Col AL, AM, AN) ---
  'Formwork Design Status',
  'Actual Formwork Order Completion Date',
  'Total Quantity Ordered m2',

  // --- Planning Columns (Col AO, AP) ---
  'Total Processed',
  'Processed Date',

  // --- Production Columns (Col AQ, AR) ---
  'Total Produced',
  'Produced Date',

  // --- Dispatch Columns ---
  'Total Dispatch',
  'Dispatched Date',
  'Formwork Quantity Sailed (m2)',
  'ATD',

  // --- 2026 Monthly Breakdown & Total (BD ACTUAL / F'CAST month columns) ---
  'Jan-26',
  'Feb-26',
  'Mar-26',
  'Apr-26',
  'May-26',
  'Jun-26',
  'Jul-26',
  'Aug-26',
  'Sep-26',
  'Oct-26',
  'Nov-26',
  'Dec-26',
  'Total 2026 m2',

  // --- 2027 Monthly Breakdown & Total ---
  'Jan-27',
  'Feb-27',
  'Mar-27',
  'Apr-27',
  'May-27',
  'Jun-27',
  'Jul-27',
  'Aug-27',
  'Sep-27',
  'Oct-27',
  'Nov-27',
  'Dec-27',
  'Total 2027 m2',
];

export const MR11_ORDERED_COLUMNS: ColumnMapping[] = [
  // BD columns A..AF, by the header names in the BD workbook. Each is matched by its whole
  // name (any letter case); aliases are the names used by earlier versions of the BD file.
  { target: 'Customer & Project Name', sourceDept: RoleCode.BD, sourceColumn: 'Customer & Project Name', type: 'string', exact: true, aliases: ['Project Name'] }, // A
  { target: 'Project No', sourceDept: RoleCode.BD, sourceColumn: 'Project No.', type: 'string', exact: true, aliases: ['Project No'] }, // B
  { target: 'Short Name', sourceDept: RoleCode.BD, sourceColumn: 'Project Shortname', type: 'string', exact: true, aliases: ['Short Name', 'Shortname'] }, // C
  { target: 'Stream', sourceDept: RoleCode.BD, sourceColumn: 'Stream', type: 'string', exact: true }, // D
  { target: 'Countries', sourceDept: RoleCode.BD, sourceColumn: 'Countries', type: 'string', exact: true, aliases: ['Country'] }, // E
  { target: 'PIC', sourceDept: RoleCode.BD, sourceColumn: 'PIC', type: 'string', exact: true }, // F
  { target: 'Status', sourceDept: RoleCode.BD, sourceColumn: 'Status', type: 'string', exact: true }, // G
  { target: 'Products type', sourceDept: RoleCode.BD, sourceColumn: 'Product Type', type: 'string', exact: true, aliases: ['Products type'] }, // H
  { target: 'Formwork type', sourceDept: RoleCode.BD, sourceColumn: 'Formwork Type', type: 'string', exact: true, aliases: ['Formworks type'] }, // I
  { target: 'Remarks', sourceDept: RoleCode.BD, sourceColumn: 'Remarks', type: 'string', exact: true }, // J
  { target: 'PO', sourceDept: RoleCode.BD, sourceColumn: 'PO', type: 'string', exact: true }, // K
  { target: 'PO date', sourceDept: RoleCode.BD, sourceColumn: 'PO date', type: 'date', exact: true }, // L
  { target: 'NCA', sourceDept: RoleCode.BD, sourceColumn: 'NCA', type: 'string', exact: true }, // M
  { target: 'NCA date', sourceDept: RoleCode.BD, sourceColumn: 'NCA date', type: 'date', exact: true }, // N
  { target: 'Original NCA Qty', sourceDept: RoleCode.BD, sourceColumn: 'Original NCA Qty', type: 'number', exact: true }, // O
  { target: 'Revised NCA Qty', sourceDept: RoleCode.BD, sourceColumn: 'Revised NCA Qty', type: 'number', exact: true }, // P
  // BD's second "Remarks" column (right after Revised NCA Qty) is the NCA remark
  { target: 'NCA Remarks', sourceDept: RoleCode.BD, sourceColumn: 'Remarks 2', type: 'string', exact: true }, // Q
  // Payment terms sub-columns under the two-row "Payment terms" header
  { target: 'Payment terms - Percentage', sourceDept: RoleCode.BD, sourceColumn: 'Percentage', type: 'number', exact: true }, // R
  { target: 'Payment terms - Type', sourceDept: RoleCode.BD, sourceColumn: 'Type', type: 'string', exact: true }, // S
  { target: 'Payment terms - Balance Percentage', sourceDept: RoleCode.BD, sourceColumn: 'Balance Percentage', type: 'number', exact: true }, // T
  { target: 'Payment terms - Type 2', sourceDept: RoleCode.BD, sourceColumn: 'Type 2', type: 'string', exact: true }, // U
  { target: 'Payment terms - Balance Percentage 2', sourceDept: RoleCode.BD, sourceColumn: 'Balance Percentage 2', type: 'number', exact: true }, // V
  { target: 'Payment terms - Type 3', sourceDept: RoleCode.BD, sourceColumn: 'Type 3', type: 'string', exact: true }, // W
  { target: 'Selling Price (USD)', sourceDept: RoleCode.BD, sourceColumn: 'Selling Price (USD)', type: 'number', exact: true }, // X
  // Fixed / Freeze / Variable
  { target: 'LME', sourceDept: RoleCode.BD, sourceColumn: 'LME', type: 'string', exact: true, aliases: ['LME (Fixed / Freeze / Variable - dropdown)'] }, // Y
  { target: 'LME Rate (USD)', sourceDept: RoleCode.BD, sourceColumn: 'LME Rate (USD)', type: 'number', exact: true, aliases: ['LME Rate'] }, // Z
  { target: 'Incoterms', sourceDept: RoleCode.BD, sourceColumn: 'Incoterms', type: 'string', exact: true }, // AA
  { target: 'Props, WPB, Waler, Acc (USD)', sourceDept: RoleCode.BD, sourceColumn: 'Props, WPB, Waler, Acc (USD)', type: 'number', exact: true }, // AB
  { target: 'Aluminium Weight Adjusted (USD)', sourceDept: RoleCode.BD, sourceColumn: 'Aluminium Weight Adjusted (USD)', type: 'number', exact: true }, // AC
  // AD and AF are formulas in the BD file; MR11 recalculates them (resolveLmePricing)
  { target: 'LME Adjusted (USD)', sourceDept: RoleCode.BD, sourceColumn: 'LME Adjusted (USD)', type: 'number', exact: true }, // AD
  { target: 'Freight Adjusted (USD)', sourceDept: RoleCode.BD, sourceColumn: 'Freight Adjusted (USD)', type: 'number', exact: true }, // AE
  { target: 'Final Selling Price (USD)', sourceDept: RoleCode.BD, sourceColumn: 'Final Selling Price (USD)', type: 'number', exact: true }, // AF
  { target: 'Advance Received / Payment Status', sourceDept: RoleCode.FINANCE, sourceColumn: 'Advance Received / Payment Status', type: 'string' },
  { target: 'Actual Received', sourceDept: RoleCode.FINANCE, sourceColumn: 'Actual Received', type: 'number' },
  { target: 'Payment Date', sourceDept: RoleCode.FINANCE, sourceColumn: 'Payment Date', type: 'date' },

  // Shellplan & Design
  { target: 'Shell Plan Status - Pending Consultant Drawings', sourceDept: RoleCode.SHELLPLAN, sourceColumn: 'Shell Plan Status - Pending Consultant Drawings', type: 'string' },
  { target: 'Shell Plan Approved Date', sourceDept: RoleCode.SHELLPLAN, sourceColumn: 'Shell Plan Approved Date', type: 'date' },
  { target: 'Formwork Design Status', sourceDept: RoleCode.DESIGN, sourceColumn: 'Formwork Design Status', type: 'string' },
  { target: 'Actual Formwork Order Completion Date', sourceDept: RoleCode.DESIGN, sourceColumn: 'Actual Formwork Order Completion Date', type: 'date' },
  { target: 'Total Quantity Ordered m2', sourceDept: RoleCode.DESIGN, sourceColumn: 'Total Quantity Ordered m2', type: 'number' },

  // Planning & Production
  // Sum of "Cumulative Processed (Project)" over the BD row's Planning blocks (same colours)
  { target: 'Total Processed', sourceDept: RoleCode.PLANNING, sourceColumn: 'Cumulative Processed (Project)', type: 'number' },
  // The upload date on which Total Processed last changed (not read from the file)
  { target: 'Processed Date', sourceDept: RoleCode.PLANNING, sourceColumn: 'Cumulative Processed (Project)', type: 'date' },
  { target: 'Total Produced', sourceDept: RoleCode.PRODUCTION, sourceColumn: 'Total Produced', type: 'number' },
  { target: 'Produced Date', sourceDept: RoleCode.PRODUCTION, sourceColumn: 'Day/Date', type: 'date' },

  // Dispatch & ATD
  { target: 'Total Dispatch', sourceDept: RoleCode.DISPATCH, sourceColumn: 'Column K', type: 'number' },
  { target: 'Dispatched Date', sourceDept: RoleCode.DISPATCH, sourceColumn: 'Dispatched Date', type: 'date' },
  { target: 'Formwork Quantity Sailed (m2)', sourceDept: RoleCode.DISPATCH, sourceColumn: 'Formwork Quantity Sailed (m2)', type: 'number' },
  { target: 'ATD', sourceDept: RoleCode.DISPATCH, sourceColumn: 'ATD', type: 'date' },
];
/** Highlight colour per department: a department user's MR11 columns glow in this colour. */
export const MR11_DEPARTMENT_COLORS: Record<string, string> = {
  BD: '#2563EB', // blue
  FINANCE: '#16A34A', // green
  SHELLPLAN: '#9333EA', // purple
  DESIGN: '#EA580C', // orange
  PLANNING: '#0891B2', // teal
  PRODUCTION: '#DB2777', // pink
  DISPATCH: '#D97706', // amber
};

/**
 * Which department's file each MR11 column comes from. Mapped columns use their source;
 * the monthly columns come from BD's ACTUAL / F'CAST month columns.
 */
export const MR11_COLUMN_DEPARTMENTS: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const m of MR11_ORDERED_COLUMNS) map[m.target] = m.sourceDept;
  for (const h of ORDERED_HEADER_LIST) {
    if (/^[A-Z][a-z]{2}-\d{2}$/.test(h) || /^Total 20\d\d m2$/.test(h)) map[h] = RoleCode.BD;
  }
  return map;
})();
