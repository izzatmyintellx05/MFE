// BD's "Customer & Project Name" holds the country, the customer and the project in one cell
// ("SINGAPORE - Wee Hur Construction - Bedok FD4-4 Blk Apartment"). MR11 shows the customer and
// the project in columns of their own; the combined value stays on the row, since it is what
// identifies the project and gives its country.
export const COMBINED_NAME_COLUMN = 'Customer & Project Name';
export const CUSTOMER_COLUMN = 'Customer';
export const PROJECT_NAME_COLUMN = 'Project Name';

export function splitCustomerProject(combined: unknown, country?: unknown): { customer: string; project: string } {
  const text = String(combined ?? '').trim();
  if (!text) return { customer: '', project: '' };
  const parts = text.split(/\s+-\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) return { customer: parts[1], project: parts.slice(2).join(' - ') };
  if (parts.length === 2) {
    // "COUNTRY - Project": the first part is the row's country, or written in capitals as countries are
    const first = parts[0];
    const isCountry =
      first.toLowerCase() === String(country ?? '').trim().toLowerCase() || (/[A-Z]/.test(first) && first === first.toUpperCase());
    return isCountry ? { customer: '', project: parts[1] } : { customer: parts[0], project: parts[1] };
  }
  return { customer: '', project: text };
}

// Adds the Customer and Project Name columns to an MR11 row (rows saved before the split have only
// the combined column). Columns the row already has are kept.
export function withCustomerProject<T extends Record<string, any>>(row: T): T {
  if (!row || typeof row !== 'object') return row;
  const hasCustomer = row[CUSTOMER_COLUMN] !== undefined;
  const hasProject = row[PROJECT_NAME_COLUMN] !== undefined;
  if (hasCustomer && hasProject) return row;
  const { customer, project } = splitCustomerProject(row[COMBINED_NAME_COLUMN], row['Countries']);
  return {
    ...row,
    ...(hasCustomer ? {} : { [CUSTOMER_COLUMN]: customer || null }),
    ...(hasProject ? {} : { [PROJECT_NAME_COLUMN]: project || null }),
  };
}
