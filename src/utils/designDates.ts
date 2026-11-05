// Colour of an Actual Formwork Order Completion Date, by its level's status:
//   completed     -> dark green (whether the date has passed or is still ahead)
//   not completed -> red
export interface DesignDatePart {
  level: string | null;
  date: string;
  completed: boolean;
}

export const DESIGN_DATE_COLORS = {
  done: '#166534',
  notDone: '#DC2626',
};

// Today in Malaysia as YYYY-MM-DD
export function todayInMalaysia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date());
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// A monthly MR11 column ("Oct-26") is ACTUAL once that month has ended, F'CAST until then;
// null for any other column
export function monthColumnKind(header: string, today = todayInMalaysia()): 'ACTUAL' | "F'CAST" | null {
  const m = /^([A-Z][a-z]{2})-(\d{2})$/.exec(header);
  if (!m || !MONTHS.includes(m[1])) return null;
  const key = `20${m[2]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, '0')}`;
  return key < today.slice(0, 7) ? 'ACTUAL' : "F'CAST";
}

export function designDateColor(part: DesignDatePart, _today = todayInMalaysia()): string {
  return part.completed ? DESIGN_DATE_COLORS.done : DESIGN_DATE_COLORS.notDone;
}
