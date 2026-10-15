import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CrudActions } from "@/components/crud-actions";

afterEach(cleanup);
describe("Management controls", () => {
  it("edits immediately but requires explicit confirmation before deleting", async () => {
    const edit = vi.fn(), remove = vi.fn().mockResolvedValue(undefined);
    render(<CrudActions name="Suíte" onEdit={edit} onDelete={remove} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar Suíte" }));
    expect(edit).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Excluir Suíte" }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar excluir" }));
    await waitFor(() => expect(remove).toHaveBeenCalledOnce());
  });
  it("keeps protected controls visible but disabled", () => {
    render(<CrudActions name="Turno" disabled reason="Histórico imutável" />);
    expect(screen.getByRole("button", { name: "Editar Turno" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Excluir Turno" })).toBeDisabled();
  });
  it("cancelling deletion makes no write", () => {
    const remove = vi.fn();
    render(<CrudActions name="Produto" onEdit={vi.fn()} onDelete={remove} />);
    fireEvent.click(screen.getByRole("button", { name: "Excluir Produto" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(remove).not.toHaveBeenCalled();
  });
  it("does not close the confirmation when deletion fails", async () => {
    render(<CrudActions name="Insumo" onDelete={vi.fn().mockRejectedValue(new Error("linked"))} />);
    fireEvent.click(screen.getByRole("button", { name: "Excluir Insumo" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar excluir" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar excluir" })).toBeEnabled());
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});