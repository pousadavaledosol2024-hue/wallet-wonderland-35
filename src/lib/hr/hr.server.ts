import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
type HRContext = { supabase: SupabaseClient<Database>; userId: string };
export async function authorizeHR(context: HRContext) {
  const { data: role, error } = await context.supabase.from('user_roles').select('account_id,role').eq('user_id', context.userId).maybeSingle();
  if (error || role?.role !== 'admin') throw Error('Somente administradores podem gerenciar o RH.');
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server'); return { db, account: role.account_id };
}
export async function authorizedEmployee(context: HRContext, id: string) {
  const { data: employee, error } = await context.supabase.from('hr_employees').select('*').eq('id', id).single();
  if (error || !employee) throw Error('Sem acesso ao colaborador.');
  const { data: allowed } = await context.supabase.rpc('hr_is_admin', { _account: employee.account_id });
  if (!allowed && employee.auth_user_id !== context.userId) throw Error('Acesso negado.');
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server'); return { db, employee, admin: Boolean(allowed) };
}