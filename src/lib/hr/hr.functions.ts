import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)), 'Data inválida');
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const employeeSchema = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(2).max(120), email: z.string().email().or(z.literal('')), cpf: z.string().max(20), birth_date: date.nullable(), phone: z.string().max(30), address: z.string().max(500), job_title: z.string().trim().min(2).max(120), salary: z.number().min(0).max(1000000), hired_on: date, active: z.boolean(), shift_start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), sunday_interval: z.union([z.literal(2), z.literal(4)]) });
export const getHR = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: role, error: roleError } = await context.supabase.from('user_roles').select('account_id,role').eq('user_id', context.userId).maybeSingle();
  if (roleError) throw Error('Não foi possível verificar o acesso.');
  const [employees, entries, punches] = await Promise.all([context.supabase.from('hr_employees').select('*').order('name'), context.supabase.from('hr_entries').select('*').order('created_at', { ascending: false }), context.supabase.from('hr_punches').select('*').order('sequence').limit(10000)]);
  if (employees.error || entries.error || punches.error) throw Error('Não foi possível carregar o RH.');
  return { userId: context.userId, accountId: role?.account_id ?? employees.data?.[0]?.account_id ?? context.userId, admin: role?.role === 'admin', employees: employees.data ?? [], entries: entries.data ?? [], punches: punches.data ?? [], truncated: punches.data?.length === 10000 };
});
export const saveEmployee = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => employeeSchema.parse(input)).handler(async ({ context, data }) => {
  const { authorizeHR } = await import('./hr.server'); const { db, account } = await authorizeHR(context);
  const { id, ...values } = data;
  const result = id ? await db.from('hr_employees').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id).eq('account_id', account).select('id').single() : await db.from('hr_employees').insert({ ...values, account_id: account }).select('id').single();
  if (result.error) throw Error('Não foi possível salvar o colaborador.'); return result.data;
});
export const deleteEmployee = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({ id: z.string().uuid() }).parse(input)).handler(async ({ context, data }) => {
  const { authorizeHR } = await import('./hr.server'); const { db, account } = await authorizeHR(context);
  const { data: history } = await db.from('hr_entries').select('id').eq('account_id', account).eq('employee_id', data.id).limit(1);
  const { data: punches } = await db.from('hr_punches').select('id').eq('account_id', account).eq('employee_id', data.id).limit(1);
  const { data: schedules } = await db.from('hr_entries').select('payload').eq('account_id', account).eq('kind', 'schedule');
  if (history?.length || punches?.length || schedules?.some(s => JSON.stringify(s.payload).includes(data.id))) throw Error('Há histórico: desative o colaborador em Editar para preservar os registros.');
  const { error } = await db.from('hr_employees').delete().eq('id', data.id).eq('account_id', account); if (error) throw Error('Não foi possível excluir.'); return { ok: true };
});
export const linkEmployee = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({ id: z.string().uuid(), email: z.string().email() }).parse(input)).handler(async ({ context, data }) => {
  const { authorizeHR } = await import('./hr.server'); const { db, account } = await authorizeHR(context);
  const { data: employee } = await db.from('hr_employees').select('id').eq('account_id', account).eq('id', data.id).single(); if (!employee) throw Error('Colaborador não encontrado.');
  // Only link an already confirmed account. Never give ERP roles to an employee.
  const { data: users, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 }); if (error) throw Error('Não foi possível consultar os acessos.');
  const user = users.users.find(u => u.email?.toLowerCase() === data.email.toLowerCase() && u.email_confirmed_at);
  if (!user) throw Error('O colaborador deve criar e confirmar sua conta na tela de acesso antes de vincular.');
  const result = await db.from('hr_employees').update({ auth_user_id: user.id }).eq('id', employee.id).eq('account_id', account); if (result.error) throw Error('Esta conta já está vinculada ou não pôde ser vinculada.'); return { ok: true };
});
export const buildSchedule = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({ month, minimum: z.number().int().min(1).max(40), weekend: z.number().int().min(1).max(40) }).parse(input)).handler(async ({ context, data }) => {
  const { authorizeHR } = await import('./hr.server'); const { db, account } = await authorizeHR(context);
  const { data: employees } = await db.from('hr_employees').select('*').eq('account_id', account).eq('active', true);
  const { data: entries } = await db.from('hr_entries').select('*').eq('account_id', account);
  const { generateSchedule } = await import('./schedule'); const { payload } = await import('./types');
  const unavailable = (entries ?? []).filter(e => e.status === 'approved' && (e.kind === 'vacation' || e.kind === 'absence') && e.employee_id).map(e => { const p = payload<{ start: string; end: string }>(e); return { employeeId: e.employee_id ?? '', start: p.start, end: p.end }; });
  const history = (entries ?? []).filter(e => e.kind === 'schedule' && e.period < data.month).flatMap(e => payload<{ shifts: import('./types').DayShift[] }>(e).shifts ?? []);
  const result = await generateSchedule(employees ?? [], data.month, data.minimum, data.weekend, unavailable, history);
  if (!result.shifts.length) return result;
  const existing = entries?.find(e => e.kind === 'schedule' && e.period === data.month);
  if (entries?.some(e => e.kind === 'payroll' && e.status === 'published' && e.period === data.month)) throw Error('Há folha publicada nesta competência. A escala está protegida.');
  const values = { payload: { ...result, minimum: data.minimum, weekend: data.weekend }, status: 'draft', updated_at: new Date().toISOString() };
  const saved = existing ? await db.from('hr_entries').update(values).eq('id', existing.id).eq('account_id', account) : await db.from('hr_entries').insert({ ...values, account_id: account, kind: 'schedule', period: data.month, created_by: context.userId });
  if (saved.error) throw Error('Não foi possível salvar a escala.'); return result;
});
export const recordPunch = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({ employeeId: z.string().uuid(), kind: z.enum(['entrada','intervalo_saida','intervalo_volta','saida']), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), accuracy: z.number().min(0) }).parse(input)).handler(async ({ context, data }) => {
  const { data: result, error } = await context.supabase.rpc('hr_record_punch', { _employee: data.employeeId, _kind: data.kind, _latitude: data.latitude, _longitude: data.longitude, _accuracy: data.accuracy });
  if (error) throw Error('Não foi possível registrar o ponto. Verifique seu vínculo de acesso.'); return result;
});
export const saveLeave = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({ id: z.string().uuid().optional(), employeeId: z.string().uuid(), kind: z.enum(['vacation','absence']), start: date, end: date, reason: z.string().max(1000), file: z.string().max(500).optional(), cycle: z.number().int().min(0).max(50).default(0), consent: z.boolean().default(false) }).parse(input)).handler(async ({ context, data }) => {
  const { authorizedEmployee } = await import('./hr.server'); const { db, employee, admin } = await authorizedEmployee(context, data.employeeId);
  if (data.start > data.end) throw Error('Data final anterior à inicial.'); if (data.id && !admin) throw Error('Somente o gestor pode editar solicitações.');
  const { differenceInCalendarDays, parseISO } = await import('date-fns'); const duration = differenceInCalendarDays(parseISO(data.end), parseISO(data.start)) + 1;
  let issues: string[] = [];
  if (data.kind === 'vacation') {
    const { vacationIssues, today } = await import('./rules'); const result = vacationIssues(employee.hired_on, data.start, duration, today(), data.cycle); issues = result.issues;
    if (duration < 5 || duration > 30) throw Error('Férias devem ter entre 5 e 30 dias por fração.');
  }
  if (data.file && !data.file.startsWith(`${employee.account_id}/${employee.id}/`)) throw Error('Arquivo não pertence ao colaborador.');
  const { data: overlaps } = await db.from('hr_entries').select('*').eq('employee_id', employee.id).in('kind', ['vacation','absence']).eq('status', 'approved');
  if (overlaps?.some(e => e.id !== data.id && String((e.payload as Record<string, unknown>)['start']) <= data.end && String((e.payload as Record<string, unknown>)['end']) >= data.start)) throw Error('Período sobrepõe afastamento aprovado.');
  const values = { employee_id: employee.id, account_id: employee.account_id, kind: data.kind, period: data.start.slice(0,7), status: 'pending', payload: { start: data.start, end: data.end, reason: data.reason, file: data.file ?? '', cycle: data.cycle, consent: data.consent, duration, issues }, created_by: context.userId, updated_at: new Date().toISOString() };
  const result = data.id ? await db.from('hr_entries').update(values).eq('id', data.id).eq('account_id', employee.account_id).eq('status', 'pending') : await db.from('hr_entries').insert(values);
  if (result.error) throw Error('Não foi possível salvar o afastamento.'); return { ok: true };
});
export const reviewEntry = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({ id: z.string().uuid(), action: z.enum(['approve','reject','delete']) }).parse(input)).handler(async ({ context, data }) => {
  const { authorizeHR } = await import('./hr.server'); const { db, account } = await authorizeHR(context);
  const { data: entry } = await db.from('hr_entries').select('*').eq('id', data.id).eq('account_id', account).single(); if (!entry) throw Error('Registro não encontrado.');
  if (!['vacation','absence'].includes(entry.kind)) throw Error('Este histórico não pode ser alterado por este controle.');
  if (entry.status !== 'pending') throw Error('Histórico decidido é preservado.');
  if (data.action === 'approve' && entry.kind === 'vacation' && entry.employee_id) {
    const { data: employee } = await db.from('hr_employees').select('*').eq('id', entry.employee_id).eq('account_id', account).single(); if (!employee) throw Error('Colaborador não encontrado.');
    const p = entry.payload as Record<string, unknown>; const { vacationIssues, today } = await import('./rules');
    const result = vacationIssues(employee.hired_on, String(p['start']), Number(p['duration']), today(), Number(p['cycle']));
    if (result.issues.length) throw Error(result.issues.join(' '));
    const { data: previous } = await db.from('hr_entries').select('payload').eq('employee_id', employee.id).eq('kind','vacation').eq('status','approved');
    const portions = (previous ?? []).map(e => e.payload as Record<string, unknown>).filter(e => Number(e['cycle']) === Number(p['cycle']));
    const all = [...portions.map(e => Number(e['duration'])), Number(p['duration'])];
    if (all.reduce((a,b) => a+b,0) > 30 || all.length > 3 || (all.length === 3 && !all.some(d => d >= 14))) throw Error('Fracionamento excede 30 dias/3 períodos ou não inclui fração de 14 dias.');
    if ((Number(p['duration']) !== 30 || portions.length) && !p['consent']) throw Error('Fracionamento exige concordância expressa do colaborador.');
  }
  const result = data.action === 'delete' ? await db.from('hr_entries').delete().eq('id',entry.id).eq('status','pending') : await db.from('hr_entries').update({ status: data.action === 'approve' ? 'approved' : 'rejected', updated_at: new Date().toISOString(), payload: { ...(entry.payload as Record<string, import('@/integrations/supabase/types').Json>), reviewed_by: context.userId, reviewed_at: new Date().toISOString() } }).eq('id',entry.id).eq('status','pending');
  if (result.error) throw Error('Não foi possível decidir a solicitação.'); return { ok: true };
});
export const closePayroll = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({ employeeId: z.string().uuid(), month, inss: z.number().min(0), irrf: z.number().min(0), otherDeductions: z.number().min(0), additions: z.number().min(0), fgts: z.number().min(0), extraPercent: z.number().min(50).max(200), publish: z.boolean() }).parse(input)).handler(async ({ context, data }) => {
  const { authorizeHR } = await import('./hr.server'); const { db, account } = await authorizeHR(context);
  const [e, entries, punches] = await Promise.all([db.from('hr_employees').select('*').eq('id',data.employeeId).eq('account_id',account).single(), db.from('hr_entries').select('*').eq('account_id',account), db.from('hr_punches').select('*').eq('employee_id',data.employeeId).eq('account_id',account).order('sequence').limit(10000)]);
  if (!e.data || entries.error || punches.error || punches.data?.length === 10000) throw Error('Não foi possível apurar a folha completa.');
  const previous = entries.data?.find(v => v.kind === 'payroll' && v.period === data.month && v.employee_id === data.employeeId); if (previous?.status === 'published') throw Error('Demonstrativo publicado é imutável.');
  const { computePayroll } = await import('./rules'); const { payload } = await import('./types');
  const shifts = entries.data?.filter(v => v.kind === 'schedule' && v.period === data.month).flatMap(v => payload<{ shifts: import('./types').DayShift[] }>(v).shifts) ?? [];
  const result = computePayroll(e.data, data.month, punches.data ?? [], shifts, entries.data ?? [], data);
  const values = { payload: { ...result, employeeName: e.data.name, jobTitle: e.data.job_title, reviewed_by: context.userId }, status: data.publish ? 'published' : 'draft', updated_at: new Date().toISOString() };
  const saved = previous ? await db.from('hr_entries').update(values).eq('id',previous.id).eq('status','draft') : await db.from('hr_entries').insert({ ...values, account_id:account, employee_id:data.employeeId, period:data.month, kind:'payroll', created_by:context.userId });
  if (saved.error) throw Error('Não foi possível salvar a folha.'); return result;
});
export const acknowledgePoint = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({ employeeId: z.string().uuid(), month }).parse(input)).handler(async ({ context, data }) => {
  const { authorizedEmployee } = await import('./hr.server'); const { db, employee } = await authorizedEmployee(context,data.employeeId);
  if (employee.auth_user_id !== context.userId) throw Error('A conferência deve ser feita pelo próprio colaborador.');
  const { data: punches, error } = await context.supabase.from('hr_punches').select('id,recorded_at').eq('employee_id', employee.id); if (error) throw Error('Não foi possível conferir.');
  const { localDate } = await import('./rules'); const ids = (punches ?? []).filter(p => localDate(p.recorded_at).startsWith(data.month)).map(p => p.id);
  if (!ids.length) throw Error('Não há marcações para conferir.');
  const { error: saveError } = await db.from('hr_entries').upsert({ account_id:employee.account_id,employee_id:employee.id,kind:'acknowledgment',period:data.month,status:'confirmed',payload:{ punchIds:ids,confirmed_at:new Date().toISOString(),user_id:context.userId },created_by:context.userId },{ onConflict:'employee_id,period', ignoreDuplicates:true });
  if (saveError) { const { data: existing } = await db.from('hr_entries').select('id').eq('employee_id',employee.id).eq('period',data.month).eq('kind','acknowledgment').maybeSingle(); if (!existing) throw Error('Não foi possível salvar a conferência.'); }
  return { ok:true };
});