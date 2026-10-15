import { Link, useNavigate } from "@tanstack/react-router";
import { BedDouble, LogOut, Sun, Utensils, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function AdminHeader() {
  const navigate = useNavigate();
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }
  const tab =
    "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
            <Sun className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Pousada Vale do Sol</h1>
            <p className="text-sm text-muted-foreground">Painel administrativo</p>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          <Link to="/financeiro" className={tab} activeProps={{ className: "bg-muted text-foreground" }}>
            <Wallet className="h-4 w-4" /> Financeiro
          </Link>
          <Link to="/hospedagem" className={tab} activeProps={{ className: "bg-muted text-foreground" }}>
            <BedDouble className="h-4 w-4" /> Hospedagem
          </Link>
          <Link to="/pdv" className={tab} activeProps={{ className: "bg-muted text-foreground" }}>
            <Utensils className="h-4 w-4" /> Lanchonete / PDV
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </nav>
      </div>
    </header>
  );
}
