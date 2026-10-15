import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";

/** Shared item controls. Deletion stays open on failure and cannot be double-submitted. */
export function CrudActions({ name, onEdit, onDelete, disabled, editDisabled, deleteDisabled, reason, description, deleteLabel = "Excluir" }: {
  name: string; onEdit?: () => void; onDelete?: () => Promise<void>;
  disabled?: boolean; editDisabled?: boolean; deleteDisabled?: boolean; reason?: string; description?: string; deleteLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (!onDelete || busy) return;
    setBusy(true);
    try { await onDelete(); setOpen(false); } catch { /* Caller displays the operation-specific error. */ }
    finally { setBusy(false); }
  }
  return <>
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label={`Ações de ${name}`}>
      <span title={disabled || editDisabled ? reason : `Editar ${name}`}><Button type="button" variant="outline" size="sm" disabled={disabled || editDisabled || !onEdit} aria-label={`Editar ${name}`} onClick={onEdit}><Pencil className="h-3.5 w-3.5" />Editar</Button></span>
      <span title={disabled || deleteDisabled ? reason : `${deleteLabel} ${name}`}><Button type="button" variant="ghost" size="sm" className="text-destructive" disabled={disabled || deleteDisabled || !onDelete} aria-label={`${deleteLabel} ${name}`} onClick={() => setOpen(true)}><Trash2 className="h-3.5 w-3.5" />{deleteLabel}</Button></span>
    </div>
    <AlertDialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg"><AlertDialogHeader><AlertDialogTitle>{deleteLabel} {name}?</AlertDialogTitle><AlertDialogDescription>{description ?? "Esta exclusão é permanente. Deseja continuar?"}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><Button variant="destructive" disabled={busy} onClick={() => void remove()}>{busy ? "Aguarde…" : `Confirmar ${deleteLabel.toLowerCase()}`}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}