import { createFileRoute } from '@tanstack/react-router';
import { hrOptions } from '@/lib/hr/data';
import { HRWorkspace } from '@/components/hr/hr-workspace';
import { configHead } from '@/components/config-shell';
export const Route=createFileRoute('/_authenticated/rh')({loader:({context})=>context.queryClient.ensureQueryData(hrOptions),head:()=>configHead('Recursos humanos','Colaboradores, escalas, ponto interno, férias, demonstrativos preliminares e afastamentos da Pousada Vale do Sol.'),component:HRPage});
function HRPage(){return <HRWorkspace/>;}