import { queryOptions, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getHR } from './hr.functions';
export const hrOptions = queryOptions({ queryKey: ['hr'], queryFn: () => getHR(), staleTime: 15000 });
export function useHRRealtime() { const qc = useQueryClient(); useEffect(() => { const refresh = () => { void qc.invalidateQueries({ queryKey: ['hr'] }); }; const channel = supabase.channel('hr-operations').on('postgres_changes', { event: '*', schema: 'public', table: 'hr_employees' }, refresh).on('postgres_changes', { event:'*',schema:'public',table:'hr_entries' },refresh).on('postgres_changes', { event:'*',schema:'public',table:'hr_punches' },refresh).subscribe(); const timer = setInterval(refresh, 30000); return () => { clearInterval(timer); void supabase.removeChannel(channel); }; }, [qc]); }