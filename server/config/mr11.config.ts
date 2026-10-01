import { RoleCode } from '@prisma/client';

export interface ColumnMapping {
  target: string;
  sourceDept: RoleCode;
  sourceColumn: string;
  type: 'string' | 'number' | 'date';
}

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
  'Payment terms',
  'Selling Price (USD)',
  'LME',
  'Incoterms',
  'Props, WPB, Waler, Acc (USD)',
  'Aluminium Weight Adjusted (USD)',
  'LME Adjusted (USD)',
  'Freight Adjusted (USD)',
  'Final Selling Price (USD)',
  'Advance Received / Payment Status',
  'Actual Received',
  'Payment Date',
  'Percentage',
  'Type',
  'Balance Percentage',
  'Type Balance Percentage',

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

  // --- 2026 Monthly Breakdown & Total ---
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
  // BD / Pre-Shellplan Columns
  { target: 'Customer & Project Name', sourceDept: RoleCode.BD, sourceColumn: 'Customer & Project Name', type: 'string' },
  { target: 'Project No', sourceDept: RoleCode.BD, sourceColumn: 'Project No', type: 'string' },
  { target: 'Short Name', sourceDept: RoleCode.BD, sourceColumn: 'Short Name', type: 'string' },
  { target: 'Stream', sourceDept: RoleCode.BD, sourceColumn: 'Stream', type: 'string' },
  { target: 'Countries', sourceDept: RoleCode.BD, sourceColumn: 'Countries', type: 'string' },
  { target: 'PIC', sourceDept: RoleCode.BD, sourceColumn: 'PIC', type: 'string' },
  { target: 'Status', sourceDept: RoleCode.BD, sourceColumn: 'Status', type: 'string' },
  { target: 'Products type', sourceDept: RoleCode.BD, sourceColumn: 'Products type', type: 'string' },
  { target: 'Formwork type', sourceDept: RoleCode.BD, sourceColumn: 'Formwork type', type: 'string' },
  { target: 'Remarks', sourceDept: RoleCode.BD, sourceColumn: 'Remarks', type: 'string' },
  { target: 'PO', sourceDept: RoleCode.BD, sourceColumn: 'PO', type: 'string' },
  { target: 'PO date', sourceDept: RoleCode.BD, sourceColumn: 'PO date', type: 'date' },
  { target: 'NCA', sourceDept: RoleCode.BD, sourceColumn: 'NCA', type: 'string' },
  { target: 'NCA date', sourceDept: RoleCode.BD, sourceColumn: 'NCA date', type: 'date' },
  { target: 'Original NCA Qty', sourceDept: RoleCode.BD, sourceColumn: 'Original NCA Qty', type: 'number' },
  { target: 'Revised NCA Qty', sourceDept: RoleCode.BD, sourceColumn: 'Revised NCA Qty', type: 'number' },
  { target: 'NCA Remarks', sourceDept: RoleCode.BD, sourceColumn: 'NCA Remarks', type: 'string' },
  { target: 'Payment terms', sourceDept: RoleCode.BD, sourceColumn: 'Payment terms', type: 'string' },
  { target: 'Selling Price (USD)', sourceDept: RoleCode.BD, sourceColumn: 'Selling Price (USD)', type: 'number' },
  { target: 'LME', sourceDept: RoleCode.BD, sourceColumn: 'LME', type: 'number' },
  { target: 'Incoterms', sourceDept: RoleCode.BD, sourceColumn: 'Incoterms', type: 'string' },
  { target: 'Props, WPB, Waler, Acc (USD)', sourceDept: RoleCode.BD, sourceColumn: 'Props, WPB, Waler, Acc (USD)', type: 'number' },
  { target: 'Aluminium Weight Adjusted (USD)', sourceDept: RoleCode.BD, sourceColumn: 'Aluminium Weight Adjusted (USD)', type: 'number' },
  { target: 'LME Adjusted (USD)', sourceDept: RoleCode.BD, sourceColumn: 'LME Adjusted (USD)', type: 'number' },
  { target: 'Freight Adjusted (USD)', sourceDept: RoleCode.BD, sourceColumn: 'Freight Adjusted (USD)', type: 'number' },
  { target: 'Final Selling Price (USD)', sourceDept: RoleCode.BD, sourceColumn: 'Final Selling Price (USD)', type: 'number' },
  { target: 'Advance Received / Payment Status', sourceDept: RoleCode.FINANCE, sourceColumn: 'Advance Received / Payment Status', type: 'string' },
  { target: 'Actual Received', sourceDept: RoleCode.FINANCE, sourceColumn: 'Actual Received', type: 'number' },
  { target: 'Payment Date', sourceDept: RoleCode.FINANCE, sourceColumn: 'Payment Date', type: 'date' },
  // Payment terms sub-columns under the two-row "Payment terms" header
  { target: 'Percentage', sourceDept: RoleCode.BD, sourceColumn: 'Percentage', type: 'number' },
  { target: 'Type', sourceDept: RoleCode.BD, sourceColumn: 'Type', type: 'string' },
  { target: 'Balance Percentage', sourceDept: RoleCode.BD, sourceColumn: 'Balance Percentage', type: 'number' },
  { target: 'Type Balance Percentage', sourceDept: RoleCode.BD, sourceColumn: 'Type 2', type: 'string' },

  // Shellplan & Design
  { target: 'Shell Plan Status - Pending Consultant Drawings', sourceDept: RoleCode.SHELLPLAN, sourceColumn: 'Shell Plan Status - Pending Consultant Drawings', type: 'string' },
  { target: 'Shell Plan Approved Date', sourceDept: RoleCode.SHELLPLAN, sourceColumn: 'Shell Plan Approved Date', type: 'date' },
  { target: 'Formwork Design Status', sourceDept: RoleCode.DESIGN, sourceColumn: 'Formwork Design Status', type: 'string' },
  { target: 'Actual Formwork Order Completion Date', sourceDept: RoleCode.DESIGN, sourceColumn: 'Actual Formwork Order Completion Date', type: 'date' },
  { target: 'Total Quantity Ordered m2', sourceDept: RoleCode.DESIGN, sourceColumn: 'Total Quantity Ordered m2', type: 'number' },

  // Planning & Production
  { target: 'Total Processed', sourceDept: RoleCode.PLANNING, sourceColumn: 'Total Processed', type: 'number' },
  { target: 'Processed Date', sourceDept: RoleCode.PLANNING, sourceColumn: 'Closing Date', type: 'date' },
  { target: 'Total Produced', sourceDept: RoleCode.PRODUCTION, sourceColumn: 'Total Produced', type: 'number' },
  { target: 'Produced Date', sourceDept: RoleCode.PRODUCTION, sourceColumn: 'Day/Date', type: 'date' },

  // Dispatch & ATD
  { target: 'Total Dispatch', sourceDept: RoleCode.DISPATCH, sourceColumn: 'Column K', type: 'number' },
  { target: 'Dispatched Date', sourceDept: RoleCode.DISPATCH, sourceColumn: 'Dispatched Date', type: 'date' },
  { target: 'Formwork Quantity Sailed (m2)', sourceDept: RoleCode.DISPATCH, sourceColumn: 'Formwork Quantity Sailed (m2)', type: 'number' },
  { target: 'ATD', sourceDept: RoleCode.DISPATCH, sourceColumn: 'ATD', type: 'date' },
];