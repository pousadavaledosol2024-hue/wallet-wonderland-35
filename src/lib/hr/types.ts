import type { Tables } from '@/integrations/supabase/types';
export type Employee = Tables<'hr_employees'>;
export type Entry = Tables<'hr_entries'>;
export type Punch = Tables<'hr_punches'>;
export type DayShift = { employeeId: string; date: string; start: string; end: string; minutes: number; off: boolean };
export type Payroll = { base: number; workedMinutes: number; expectedMinutes: number; absenceMinutes: number; extraMinutes: number; balanceMinutes: number; extraPay: number; absenceDeduction: number; inss: number; irrf: number; otherDeductions: number; additions: number; gross: number; net: number; fgts: number; issues: string[] };
export const recordLabels: Record<string, string> = { entrada: 'Entrada', intervalo_saida: 'Saída para almoço', intervalo_volta: 'Volta do almoço', saida: 'Saída' };
export function payload<T>(entry: Entry): T { return entry.payload as unknown as T; }