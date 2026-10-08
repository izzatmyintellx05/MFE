// Colour of an Actual Formwork Order Completion Date, by its level's status and today:
//   completed and the date has passed   -> dark green
//   completed and the date is still ahead -> yellow
//   not completed                        -> red
export interface DesignDatePart {
  level: string | null;
  date: string;
  completed: boolean;
}

export const DESIGN_DATE_COLORS = {
  done: '#166534',
  doneAhead: '#A16207',
  notDone: '#DC2626',
};

// Today in Malaysia as YYYY-MM-DD
export function todayInMalaysia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date());
}

export function designDateColor(part: DesignDatePart, today = todayInMalaysia()): string {
  if (!part.completed) return DESIGN_DATE_COLORS.notDone;
  return part.date <= today ? DESIGN_DATE_COLORS.done : DESIGN_DATE_COLORS.doneAhead;
}
