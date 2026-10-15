export const percentageKeys = new Set([
  "weekend_percent", "holiday_percent", "extra_adult_discount",
  "child_rate", "pet_small", "pet_medium", "pet_large",
]);

export const pricingDefaults: Record<string, string> = {
  child_rate: "65", pet_small: "20.7", pet_medium: "27.6", pet_large: "34.5",
};

export function decimalNumber(value: string) {
  const normalized = value.trim().replace(",", ".");
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized) ? Number(normalized) : NaN;
}

export function withPricingDefaults(settings: Record<string, string>) {
  const result = { ...settings };
  for (const [key, value] of Object.entries(pricingDefaults)) {
    if (!result[key]?.trim()) result[key] = value;
  }
  return result;
}

export type StayGuests = { adults: number; children: number; petSmall: number; petMedium: number; petLarge: number };
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateStay(baseRate: number, checkIn: string, checkOut: string, guests: StayGuests, rawSettings: Record<string, string>) {
  const settings = withPricingDefaults(rawSettings);
  const percent = (key: string) => {
    const n = decimalNumber(settings[key] ?? "0");
    if (!Number.isFinite(n) || n < 0 || n > 100) throw Error("Confira os percentuais em Tarifas e políticas.");
    return n / 100;
  };
  const counts = Object.values(guests);
  if (!Number.isFinite(baseRate) || baseRate < 0 || guests.adults < 1 || counts.some((n) => !Number.isInteger(n) || n < 0)) throw Error("Informe quantidades válidas de hóspedes e pets.");
  const start = new Date(`${checkIn}T00:00:00Z`), end = new Date(`${checkOut}T00:00:00Z`);
  const nights = (end.getTime() - start.getTime()) / 86400000;
  if (!Number.isInteger(nights) || nights < 1 || nights > 366 || start.toISOString().slice(0, 10) !== checkIn || end.toISOString().slice(0, 10) !== checkOut) throw Error("Informe um período válido de até 366 noites.");
  const holidays = new Set((settings["holidays"] ?? "").split("\n").map((d) => d.trim()).filter(Boolean));
  const adultFactor = 1 + (guests.adults - 1) * (1 - percent("extra_adult_discount"));
  const childFactor = guests.children * percent("child_rate");
  const petFactor = guests.petSmall * percent("pet_small") + guests.petMedium * percent("pet_medium") + guests.petLarge * percent("pet_large");
  const days = Array.from({ length: nights }, (_, i) => {
    const day = new Date(start.getTime() + i * 86400000);
    const date = day.toISOString().slice(0, 10);
    // The original panel charges Friday and Saturday nights, without stacking holidays.
    const weekend = day.getUTCDay() === 5 || day.getUTCDay() === 6;
    const holiday = holidays.has(date);
    const surcharge = Math.max(weekend ? percent("weekend_percent") : 0, holiday ? percent("holiday_percent") : 0);
    const adultRate = baseRate * (1 + surcharge);
    const adults = money(adultRate * adultFactor), children = money(adultRate * childFactor), pets = money(adultRate * petFactor);
    return { date, surcharge: surcharge * 100, adults, children, pets, total: money(adults + children + pets) };
  });
  return { nights, days, total: money(days.reduce((sum, day) => sum + day.total, 0)) };
}