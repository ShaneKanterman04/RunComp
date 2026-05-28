export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function isJsonParseError(error: unknown) {
  if (error instanceof SyntaxError) return true;
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";
  return name === "SyntaxError" || /JSON|Expected property name|Unexpected end/i.test(message);
}
