import { addDays, format, parseISO } from 'date-fns';
import { DAILY_MINUTES, daysOfMonth, timeMinutes, timeText } from './rules';
import type { DayShift, Employee } from './types';
export async function generateSchedule(employees: Employee[], month: string, minimum: number, weekendMinimum: number, unavailable: { employeeId: string; start: string; end: string }[] = [], history: DayShift[] = []) {
  const { default: Logic } = await import('logic-solver');
  const staff = employees.filter(e => e.active); if (!staff.length) return { shifts: [] as DayShift[], issues: ['Cadastre colaboradores ativos antes de gerar a escala.'] };
  if (staff.length > 40) throw Error('Gerador limitado a 40 colaboradores por escala.');
  const days = daysOfMonth(month); const first = parseISO(`${month}-01`); const offset = (first.getDay() + 6) % 7;
  const padded = Array.from({ length: Math.ceil((days.length + offset) / 7) * 7 }, (_, i) => format(addDays(first, i - offset), 'yyyy-MM-dd'));
  const solver = new Logic.Solver(); const v = (e: Employee, d: string) => `e${e.id.replaceAll('-', '')}d${d.replaceAll('-', '')}`;
  const atmost = (vs: string[], n: number) => Logic.lessThanOrEqual(Logic.sum(vs), Logic.constantBits(n));
  const atleast = (vs: string[], n: number) => { if (n > vs.length) { solver.require(Logic.FALSE); return; } if (n > 0) solver.require(Logic.greaterThanOrEqual(Logic.sum(vs), Logic.constantBits(n))); };
  const historical = new Map(history.map(s => [`${s.employeeId}:${s.date}`, s]));
  for (const e of staff) {
    if (timeMinutes(e.shift_start) + DAILY_MINUTES + 60 >= 1440) return { shifts: [] as DayShift[], issues: [`${e.name}: horário atravessa a meia-noite; requer jornada específica.`] };
    for (const d of padded) { const previous = historical.get(`${e.id}:${d}`); if (d < month + '-01' && previous) solver.require(previous.off ? Logic.not(v(e, d)) : v(e, d)); if (d < e.hired_on || unavailable.some(u => u.employeeId === e.id && d >= u.start && d <= u.end)) solver.require(Logic.not(v(e, d))); }
    for (let i = 0; i < padded.length; i += 7) { const week = padded.slice(i, i + 7); solver.require(atmost(week.map(d => v(e, d)), 5)); const fullyAvailable = week.every(d => d >= e.hired_on && !unavailable.some(u => u.employeeId === e.id && d >= u.start && d <= u.end)); if (fullyAvailable) atleast(week.map(d => v(e, d)), 5); }
    for (let i = 0; i <= padded.length - 6; i++) solver.require(atmost(padded.slice(i, i + 6).map(d => v(e, d)), 5));
    const sundays = padded.filter(d => parseISO(d).getDay() === 0);
    for (let i = 0; i <= sundays.length - e.sunday_interval; i++) solver.require(Logic.or(sundays.slice(i, i + e.sunday_interval).map(d => Logic.not(v(e, d)))));
    solver.require(Logic.or(days.filter(d => parseISO(d).getDay() === 0).map(d => Logic.not(v(e, d)))));
  }
  for (const d of days) { const weekend = [0, 6].includes(parseISO(d).getDay()); atleast(staff.map(e => v(e, d)), weekend ? weekendMinimum : minimum); }
  const solution = solver.solve();
  if (!solution) return { shifts: [] as DayShift[], issues: ['Escala inviável: cobertura, folgas 5x2, afastamentos e domingos não podem ser atendidos simultaneamente. Ajuste a equipe ou a cobertura.'] };
  const shifts = staff.flatMap(e => days.map(date => ({ employeeId: e.id, date, start: e.shift_start, end: timeText(timeMinutes(e.shift_start) + DAILY_MINUTES + 60), minutes: DAILY_MINUTES, off: !solution.evaluate(v(e, date)) })));
  return { shifts, issues: ['Escala proposta: 8h48 de trabalho + 1h de intervalo. Compensação diária, domingos, feriados e CCT exigem validação profissional.', ...(history.length ? [] : ['Sem histórico anterior: validar o descanso na transição entre meses.'])] };
}