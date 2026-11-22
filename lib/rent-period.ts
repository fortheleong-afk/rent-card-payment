// Rent is billed by calendar month in Korea, including for tenants applying abroad.
export function renewalSchedule(rentMonth: string | null, dueDate: string | null, now = new Date()) {
  const base = rentMonth || new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const nextMonth = (date: string) => {
    const year = Number(date.slice(0, 4)), month = Number(date.slice(5, 7));
    const first = new Date(Date.UTC(year, month, 1));
    return first.toISOString().slice(0, 7);
  };
  const month = nextMonth(base);
  let due = '';
  if (dueDate && rentMonth) {
    const next = nextMonth(dueDate);
    const last = new Date(Date.UTC(Number(next.slice(0, 4)), Number(next.slice(5, 7)), 0)).getUTCDate();
    due = next + '-' + String(Math.min(Number(dueDate.slice(8, 10)), last)).padStart(2, '0');
  }
  return {month, due};
}

export function sameProperty(left: string | null | undefined, right: string | null | undefined) {
  return Boolean(left?.trim()) && left?.trim().toLowerCase() === right?.trim().toLowerCase();
}
