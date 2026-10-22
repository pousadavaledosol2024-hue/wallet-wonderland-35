import { createFileRoute } from '@tanstack/react-router';
import { hrOptions } from '@/lib/hr/data';
import { HRWorkspace } from '@/components/hr/hr-workspace';
import { configHead } from '@/components/config-shell';
export const Route=createFileRoute('/_authenticated/colaborador')({loader:({context})=>context.queryClient.ensureQueryData(hrOptions),head:()=>configHead('Portal do colaborador','Acesso individual protegido a ponto, escala, férias, documentos e demonstrativos da Pousada Vale do Sol.'),component:EmployeePortal});
function EmployeePortal(){return <HRWorkspace portal/>;}