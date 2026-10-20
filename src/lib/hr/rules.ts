import { addDays, addMonths, differenceInCalendarDays, format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import type { DayShift, Employee, Entry, Payroll, Punch } from './types';
export const WEEKLY_MINUTES = 44 * 60;
export const DAILY_MINUTES = WEEKLY_MINUTES / 5;
export const INTERJOURNEY_MINUTES = 11 * 60;
export const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
export const dateLabel = (date: string) => format(parseISO(date), 'dd/MM/yyyy');
export function daysOfMonth(month: string) { const date = parseISO(`${month}-01`); return eachDayOfInterval({ start: startOfMonth(date), end: endOfMonth(date) }).map(d => format(d, 'yyyy-MM-dd')); }
export function timeMinutes(time: string) { const [h = 0, m = 0] = time.split(':').map(Number); return h * 60 + m; }
export function timeText(minutes: number) { return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; }
export function hours(minutes: number) { const rounded = Math.round(Math.abs(minutes)); return `${minutes < 0 ? '-' : ''}${Math.floor(rounded / 60)}h${String(rounded % 60).padStart(2, '0')}`; }
export function vacationPeriod(hired: string, cycle = 0) { const start = addMonths(parseISO(hired), cycle * 12); const earned = addMonths(start, 12); const deadline = addDays(addMonths(earned, 12), -1); return { start: format(start, 'yyyy-MM-dd'), earned: format(earned, 'yyyy-MM-dd'), deadline: format(deadline, 'yyyy-MM-dd') }; }
export function vacationIssues(hired: string, start: string, duration: number, now: string, cycle = 0, holidays: string[] = [], restDays: number[] = [0]) {
  const period = vacationPeriod(hired, cycle); const issues: string[] = [];
  if (start < period.earned) issues.push('Período aquisitivo ainda não concluído.');
  if (differenceInCalendarDays(parseISO(start), parseISO(now)) < 30) issues.push('Aviso exige antecedência mínima de 30 dias.');
  if (format(addDays(parseISO(start), duration - 1), 'yyyy-MM-dd') > period.deadline) issues.push('Férias ultrapassam o período concessivo.');
  if (duration < 5 || duration > 30) issues.push('Fração de férias deve ter entre 5 e 30 dias.');
  for (let i = 1; i <= 2; i++) { const d = addDays(parseISO(start), i); if (restDays.includes(d.getDay()) || holidays.includes(format(d, 'yyyy-MM-dd'))) { issues.push('Início vedado nos dois dias anteriores a feriado ou repouso semanal.'); break; } }
  return { ...period, issues, paymentDue: format(addDays(parseISO(start), -2), 'yyyy-MM-dd'), noticeDue: format(addDays(parseISO(start), -30), 'yyyy-MM-dd') };
}
export function dailyPoint(punches: Punch[]) {
  const sorted = [...punches].sort((a, b) => Number(a.sequence) - Number(b.sequence)); let minutes = 0; let started: Punch | undefined; const issues: string[] = [];
  for (const punch of sorted) { if (punch.kind === 'entrada' || punch.kind === 'intervalo_volta') { if (started) issues.push('Marcações incompletas.'); started = punch; } else if (started) { const delta = (Date.parse(punch.recorded_at) - Date.parse(started.recorded_at)) / 60000; if (delta >= 0) minutes += delta; else issues.push('Horários inconsistentes.'); started = undefined; } else issues.push('Marcações incompletas.'); }
  if (started) issues.push('Jornada aberta ou incompleta.');
  return { minutes: Math.round(minutes), issues };
}
export function localDate(timestamp: string) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(timestamp)); }
export function computePayroll(employee: Employee, month: string, punches: Punch[], shifts: DayShift[], entries: Entry[], adjustments: { inss?: number; irrf?: number; otherDeductions?: number; additions?: number; fgts?: number; extraPercent?: number } = {}): Payroll {
  const issues = ['Folha preliminar: validar CCT, INSS, IRRF, FGTS, adicionais, DSR e acordo de compensação com a contabilidade.'];
  let workedMinutes = 0, expectedMinutes = 0, absenceMinutes = 0, extraMinutes = 0;
  for (const shift of shifts.filter(s => s.employeeId === employee.id && s.date.startsWith(month) && !s.off)) {
    if (shift.date < employee.hired_on) continue;
    const leave = entries.find(e => e.employee_id === employee.id && (e.kind === 'absence' || e.kind === 'vacation') && e.status === 'approved' && typeof (e.payload as Record<string, unknown>)['start'] === 'string' && String((e.payload as Record<string, unknown>)['start']) <= shift.date && String((e.payload as Record<string, unknown>)['end']) >= shift.date);
    if (shift.date > today()) { issues.push('Há jornadas futuras nesta competência.'); continue; }
    expectedMinutes += shift.minutes;
    if (leave) { workedMinutes += shift.minutes; continue; }
    const point = dailyPoint(punches.filter(p => p.employee_id === employee.id && localDate(p.recorded_at) === shift.date));
    workedMinutes += point.minutes; absenceMinutes += Math.max(0, shift.minutes - point.minutes); extraMinutes += Math.max(0, point.minutes - shift.minutes);
    if (point.issues.length) issues.push(`${dateLabel(shift.date)}: ${point.issues.join(' ')}`);
    if (!point.minutes) issues.push(`${dateLabel(shift.date)}: sem ponto; conferir falta antes de fechar.`);
  }
  if (!shifts.some(s => s.employeeId === employee.id && s.date.startsWith(month))) issues.push('Sem escala na competência: saldo de ponto não apurado.');
  for (const day of daysOfMonth(month)) { if (shifts.some(s => s.employeeId === employee.id && s.date === day && !s.off)) continue; const point = dailyPoint(punches.filter(p => p.employee_id === employee.id && localDate(p.recorded_at) === day)); workedMinutes += point.minutes; extraMinutes += point.minutes; if (point.minutes) issues.push(`${dateLabel(day)}: trabalho sem jornada prevista; validar adicional/DSR.`); }
  const round = (n: number) => Math.round(n * 100) / 100;
  const base = Number(employee.salary), hourly = base / 220;
  const extraPay = round(extraMinutes / 60 * hourly * (1 + (adjustments.extraPercent ?? 50) / 100));
  const absenceDeduction = round(absenceMinutes / 60 * hourly);
  const inss = adjustments.inss ?? 0, irrf = adjustments.irrf ?? 0, otherDeductions = adjustments.otherDeductions ?? 0, additions = adjustments.additions ?? 0;
  const gross = round(base + extraPay + additions), net = round(gross - absenceDeduction - inss - irrf - otherDeductions);
  return { base, workedMinutes, expectedMinutes, absenceMinutes, extraMinutes, balanceMinutes: workedMinutes - expectedMinutes, extraPay, absenceDeduction, inss, irrf, otherDeductions, additions, gross, net, fgts: adjustments.fgts ?? 0, issues: [...new Set(issues)] };
}