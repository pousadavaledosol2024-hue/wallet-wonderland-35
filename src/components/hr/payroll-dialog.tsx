import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { closePayroll } from '@/lib/hr/hr.functions';
import type { Employee, Entry, Payroll } from '@/lib/hr/types';
import { payload } from '@/lib/hr/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
export function PayrollDialog({employee,month,entry,onClose,onSaved}:{employee:Employee;month:string;entry?:Entry;onClose:()=>void;onSaved:()=>Promise<void>}){
 const p=entry?payload<Payroll>(entry):undefined;const [values,setValues]=useState({inss:p?.inss??0,irrf:p?.irrf??0,otherDeductions:p?.otherDeductions??0,additions:p?.additions??0,fgts:p?.fgts??0,extraPercent:50}),[publish,setPublish]=useState(false),[busy,setBusy]=useState(false);const save=useServerFn(closePayroll);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);try{await save({data:{...values,employeeId:employee.id,month,publish}});await onSaved();onClose();toast.success(publish?'Demonstrativo preliminar disponibilizado':'Prévia da folha salva');}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível salvar');}finally{setBusy(false);}}
 const labels={inss:'INSS conferido (R$)',irrf:'IRRF conferido (R$)',otherDeductions:'Outros descontos (R$)',additions:'Outros proventos (R$)',fgts:'FGTS conferido (R$)',extraPercent:'Adicional de horas extras (%)'};
 return <Dialog open onOpenChange={onClose}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Folha preliminar · {employee.name}</DialogTitle></DialogHeader><p className="text-sm text-warning-foreground">{month} · Valores tributários devem ser informados após conferência. Zero não significa isenção. Não há envio ao eSocial.</p><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">{(Object.keys(labels) as (keyof typeof labels)[]).map(key=><div key={key}><Label htmlFor={`payroll-${key}`}>{labels[key]}</Label><Input id={`payroll-${key}`} type="number" min={key==='extraPercent'?50:0} max={key==='extraPercent'?200:undefined} step="0.01" required value={values[key]} onChange={e=>setValues({...values,[key]:Number(e.target.value)})}/></div>)}<label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={publish} onChange={e=>setPublish(e.target.checked)}/>Revisei os dados e autorizo disponibilizar o demonstrativo preliminar, preservando-o sem alterações posteriores.</label><Button type="submit" disabled={busy} className="sm:col-span-2">{busy?'Apurando…':publish?'Disponibilizar demonstrativo':'Salvar prévia'}</Button></form></DialogContent></Dialog>;
}