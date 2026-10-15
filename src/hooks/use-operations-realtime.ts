import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
export function useOperationsRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase.channel(`operations-${crypto.randomUUID()}`);
    for (const table of ["cash_registers", "cash_movements", "ingredients", "stock_movements", "products", "transactions"]) channel.on("postgres_changes", { event: "*", schema: "public", table }, () => { void qc.invalidateQueries({ queryKey: ["operations"] }); });
    channel.subscribe(); return () => { void supabase.removeChannel(channel); };
  }, [qc]);
}