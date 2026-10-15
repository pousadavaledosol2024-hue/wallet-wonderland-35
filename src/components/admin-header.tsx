import { Link, useNavigate } from "@tanstack/react-router";
import { BedDouble, CalendarDays, LayoutDashboard, LogOut, Utensils, Wallet, Link2, ImageIcon, MessageCircle, ShieldCheck, Banknote, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function AdminHeader() {
  const navigate = useNavigate();
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }
  const tabs = [
    { to: "/visao-geral", label: "Visão Geral", icon: LayoutDashboard },
    { to: "/calendario", label: "Calendário", icon: CalendarDays },
    { to: "/hospedagem", label: "Hospedagem", icon: BedDouble },
    { to: "/pdv", label: "Lanchonete/PDV", icon: Utensils },
    { to: "/caixa", label: "Caixa", icon: Banknote },
    { to: "/estoque", label: "Estoque", icon: Package },
    { to: "/financeiro", label: "Financeiro", icon: Wallet },
    { to: "/ical", label: "iCal/OTAs", icon: Link2 },
    { to: "/site-galeria", label: "Site & Galeria", icon: ImageIcon },
    { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
    { to: "/seguranca", label: "Segurança & Acesso", icon: ShieldCheck },
  ] as const;
  return (
    <header className="border-b bg-card">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex items-center justify-between gap-3 pb-3">
          <div className="flex min-w-0 items-center gap-3">
          <img src="/logo.png" alt="" className="h-10 w-10 shrink-0 rounded-full object-contain" />
          <div>
            <h1 className="text-lg font-semibold leading-tight">Pousada Vale do Sol</h1>
            <p className="text-sm text-muted-foreground">Painel administrativo</p>
          </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
        <nav aria-label="Menu administrativo" className="grid grid-cols-2 gap-1 border-t pt-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {tabs.map(({ to, label, icon: Icon }) => <Button key={to} asChild variant="ghost" className="h-auto min-h-10 min-w-0 justify-start px-2 py-2 text-muted-foreground">
            <Link to={to} activeOptions={{ exact: true }} activeProps={{ className: "bg-primary text-primary-foreground" }}>
              <Icon className="h-4 w-4 shrink-0" /><span className="min-w-0 whitespace-normal text-left text-xs leading-4 sm:text-sm">{label}</span>
            </Link>
          </Button>)}
        </nav>
      </div>
    </header>
  );
}
