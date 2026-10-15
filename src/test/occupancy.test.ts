import { describe, expect, it } from "vitest";
import type { Tables } from "@/integrations/supabase/types";
import { monthlyOccupancy } from "@/lib/occupancy";
const rooms = [{ id: "one", name: "Suíte" }] as Tables<"rooms">[];
const stay = { id: "stay", room_id: "one", check_in: "2026-10-01", check_out: "2026-10-04", status: "confirmada" } as Tables<"reservations">;
describe("Monthly occupancy", () => {
  it("counts unique room nights and excludes checkout", () => {
    const report = monthlyOccupancy(rooms, [stay, { ...stay, id: "duplicate" }], "2026-10");
    expect(report.occupied).toBe(3); expect(report.capacity).toBe(31); expect(report.rows[0]?.cells[3]?.reservation).toBeNull();
  });
  it("excludes canceled stays and includes completed stays", () => {
    expect(monthlyOccupancy(rooms, [{ ...stay, status: "cancelada" }], "2026-10").occupied).toBe(0);
    expect(monthlyOccupancy(rooms, [{ ...stay, status: "finalizada" }], "2026-10").occupied).toBe(3);
  });
  it("handles leap February and no rooms", () => {
    expect(monthlyOccupancy(rooms, [], "2028-02").capacity).toBe(29);
    expect(monthlyOccupancy([], [], "2026-10").percent).toBe(0);
  });
});