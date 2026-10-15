import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/ocupacao")({ beforeLoad: () => { throw redirect({ to: "/hospedagem", replace: true }); } });
