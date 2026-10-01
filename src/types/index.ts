export const FileVersionStatus = {
  UPLOADING: 'UPLOADING',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  FAILED: 'FAILED',
} as const;

export type FileVersionStatus = typeof FileVersionStatus[keyof typeof FileVersionStatus];

export const RoleCode = {
  ADMIN: 'ADMIN',
  CEO: 'CEO',
  BD: 'BD',
  FINANCE: 'FINANCE',
  SHELLPLAN: 'SHELLPLAN',
  DESIGN: 'DESIGN',
  PLANNING: 'PLANNING',
  PRODUCTION: 'PRODUCTION',
  DISPATCH: 'DISPATCH',
} as const;

export type RoleCode = typeof RoleCode[keyof typeof RoleCode];

export interface DepartmentVersion {
  id: string;
  departmentId: string;
  originalFilename?: string;
  fileName?: string;
  status: FileVersionStatus;
  parsedWorkbook?: any[];
  uploadedBy?: {
    fullName: string;
    email: string;
  };
  uploadedAt: string;
}

export interface Department {
  id: string;
  code: RoleCode;
  name: string;
  description?: string;
  activeVersion?: DepartmentVersion | null;
}