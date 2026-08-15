// ANTI-PATTERN: a top-level lib folder that is not one of the model's layers.
export function safeReturnUrl(raw: string): string {
  return raw.startsWith("/") ? raw : "/";
}
