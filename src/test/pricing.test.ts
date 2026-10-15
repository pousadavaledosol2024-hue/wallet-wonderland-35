import { describe, expect, it, vi } from "vitest";
import { calculateStay, decimalNumber, withPricingDefaults } from "@/lib/pricing";
vi.mock("@/lib/admin-config.functions", () => ({ getAdminConfig: vi.fn() }));
import { settingsSchema } from "@/lib/admin-config";

const guests = { adults: 1, children: 0, petSmall: 0, petMedium: 0, petLarge: 0 };
const settings = { extra_adult_discount: "34", weekend_percent: "10", holiday_percent: "20" };
describe("Percentage settings", () => {
  it("uses original defaults only for missing or blank values", () => {
    expect(withPricingDefaults({ child_rate: "0", pet_small: "22,5", pet_medium: "" })).toMatchObject({ child_rate: "0", pet_small: "22,5", pet_medium: "27.6", pet_large: "34.5" });
  });
  it("accepts commas and saves canonical decimal percentages", () => {
    expect(settingsSchema.parse({ child_rate: "65", pet_small: "20,7", pet_medium: "27,6", pet_large: "34,5" })).toEqual({ child_rate: "65", pet_small: "20.7", pet_medium: "27.6", pet_large: "34.5" });
    expect(decimalNumber("20.7")).toBe(20.7);
  });
  it("rejects invalid or out-of-range percentages", () => {
    for (const value of ["101", "-1", "20,7,5", "abc", "Infinity"]) expect(settingsSchema.safeParse({ pet_small: value }).success).toBe(false);
  });
});
describe("Stay pricing", () => {
  it("charges each child and pet against one undiscounted adult rate", () => {
    const price = calculateStay(100, "2026-10-15", "2026-10-16", { ...guests, adults: 2, children: 1, petSmall: 1, petMedium: 1, petLarge: 1 }, settings);
    expect(price.days[0]).toMatchObject({ adults: 166, children: 65, pets: 82.8, total: 313.8 });
  });
  it("discounts only additional adults, independently", () => {
    expect(calculateStay(100, "2026-10-15", "2026-10-16", { ...guests, adults: 3 }, settings).total).toBe(232);
  });
  it("applies Friday/Saturday surcharges per night, excluding checkout", () => {
    const price = calculateStay(100, "2026-10-15", "2026-10-19", guests, settings);
    expect(price.days.map((day) => day.total)).toEqual([100, 110, 110, 100]);
    expect(price.total).toBe(420);
  });
  it("applies listed holidays without stacking weekend surcharges", () => {
    const price = calculateStay(100, "2026-10-15", "2026-10-17", guests, { ...settings, holidays: "2026-10-15\n2026-10-16" });
    expect(price.days.map((day) => day.total)).toEqual([120, 120]);
    expect(calculateStay(100, "2026-10-16", "2026-10-17", guests, { ...settings, holiday_percent: "5", holidays: "2026-10-16" }).total).toBe(110);
  });
  it("uses configured decimal rates and rounds currency to cents", () => {
    expect(calculateStay(145, "2026-10-15", "2026-10-16", { ...guests, petSmall: 2 }, { ...settings, pet_small: "20,7" }).total).toBe(205.03);
  });
  it("handles leap days and rejects invalid dates/counts", () => {
    expect(calculateStay(100, "2028-02-28", "2028-03-01", guests, {}).nights).toBe(2);
    expect(() => calculateStay(100, "2026-10-15", "2026-10-15", guests, settings)).toThrow();
    expect(() => calculateStay(100, "2026-02-30", "2026-03-03", guests, settings)).toThrow();
    expect(() => calculateStay(100, "2026-10-15", "2026-10-16", { ...guests, adults: 1.5 }, settings)).toThrow();
  });
});