import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Reservation = Tables<"reservations">;
export const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const todayISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const dateISO = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const formatDate = (date: string) => date.split("-").reverse().join("/");
export const blocksDates = (r: Reservation) => ["pre_reserva", "confirmada", "hospedado"].includes(r.status);
export const origin = (r: Reservation) => /ical/i.test(r.source ?? "") ? r.source || "iCal" : r.source || "Direta";
export const managementOptions = queryOptions({
  queryKey: ["management"],
  queryFn: async () => {
    const month = todayISO().slice(0, 7);
    const results = await Promise.all([
      supabase.from("rooms").select("*").order("name"),
      supabase.from("reservations").select("*").order("check_in"),
      supabase.from("transactions").select("*").gte("due_date", `${month}-01`).lt("due_date", dateISO(new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 1))),
      supabase.from("orders").select("*").eq("status", "aberta"),
      supabase.from("ingredients").select("*").order("name"),
      supabase.from("cash_registers").select("*").eq("status", "aberto"),
    ]);
    const failure = results.find((r) => r.error);
    if (failure?.error) throw new Error("Não foi possível carregar os dados. Tente novamente.");
    return { rooms: results[0].data ?? [], reservations: results[1].data ?? [], transactions: results[2].data ?? [], orders: results[3].data ?? [], ingredients: results[4].data ?? [], registers: results[5].data ?? [] };
  },
  staleTime: 15_000,
  refetchInterval: 60_000,
});

export function useManagementRealtime() {
  const client = useQueryClient();
  const [connection, setConnection] = useState("Conectando");
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => client.invalidateQueries({ queryKey: managementOptions.queryKey }), 150);
    };
    const channel = supabase.channel(`management-${crypto.randomUUID()}`);
    for (const table of ["rooms", "reservations", "transactions", "orders", "ingredients", "cash_registers"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    }
    channel.subscribe((status) => {
      if (disposed) return;
      setConnection(status === "SUBSCRIBED" ? "Ao vivo" : "Reconectando");
      if (status === "SUBSCRIBED") refresh();
    });
    const onFocus = () => client.invalidateQueries({ queryKey: managementOptions.queryKey });
    window.addEventListener("focus", onFocus);
    return () => { disposed = true; clearTimeout(timer); window.removeEventListener("focus", onFocus); void supabase.removeChannel(channel); };
  }, [client]);
  return connection;
}