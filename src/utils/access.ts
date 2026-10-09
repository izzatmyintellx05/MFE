// Who may open which page. The server enforces the same rules for its data.

export const rolesOf = (user: any): string[] =>
  (user?.roles || []).map((r: any) => String(r?.code || r).toUpperCase());

export const isAdmin = (user: any): boolean =>
  rolesOf(user).includes('ADMIN') || user?.email === 'admin@mfeformwork.com';

// The CEO Executive Hub is for the CEO and administrators only
export const canSeeCeoDashboard = (user: any): boolean => isAdmin(user) || rolesOf(user).includes('CEO');

// Shell Plan and Design share one page; every other department has its own
export const DEPARTMENT_ROLES: Record<string, string[]> = {
  BD: ['BD'],
  FINANCE: ['FINANCE'],
  DESIGN: ['SHELLPLAN', 'DESIGN'],
  SHELLPLAN: ['SHELLPLAN', 'DESIGN'],
  PLANNING: ['PLANNING'],
  PRODUCTION: ['PRODUCTION'],
  DISPATCH: ['DISPATCH'],
};

export const canSeeDepartment = (user: any, code: string): boolean => {
  if (isAdmin(user)) return true;
  const allowed = DEPARTMENT_ROLES[String(code).toUpperCase()] || [String(code).toUpperCase()];
  return allowed.some((r) => rolesOf(user).includes(r));
};
