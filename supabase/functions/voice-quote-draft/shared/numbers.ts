export function toOptionalPositiveNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1_000_000) {
    return null;
  }
  return Math.round(parsed * 10_000) / 10_000;
}

export function toOptionalPositiveInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 20) return null;
  return parsed;
}

export function isConfidence(
  value: unknown,
): value is "high" | "medium" | "low" {
  return value === "high" || value === "medium" || value === "low";
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
