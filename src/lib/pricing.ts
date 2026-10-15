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