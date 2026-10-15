import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pousada Vale do Sol — Gestão" },
      { name: "description", content: "Gestão de hospedagem, reservas, lanchonete e financeiro da Pousada Vale do Sol." },
      { property: "og:title", content: "Pousada Vale do Sol — Gestão" },
      { property: "og:description", content: "Gestão de hospedagem, reservas, lanchonete e financeiro da Pousada Vale do Sol." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      navigate({ to: data.session ? "/visao-geral" : "/auth", replace: true });
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground">Carregando...</p>
    </div>
  );
}
