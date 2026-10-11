import { readFileSync } from "node:fs";

/** A JSON value, as `JSON.parse` produces it. */
export type Json = null | boolean | number | string | readonly Json[] | JsonObject;
export interface JsonObject {
  readonly [key: string]: Json;
}

export type JsonRead =
  | { readonly kind: "parsed"; readonly value: Json }
  | { readonly kind: "failure"; readonly reason: string };

/**
 * Parse JSON text. A syntax error is a failure the caller has to read, never a
 * default.
 */
export function parseJson(text: string): JsonRead {
  try {
    // chisel-ignore narrowing:no-json-parse-cast -- JSON.parse returns a JSON value by definition; its declared `any` is the only thing this names.
    const value: Json = JSON.parse(text);
    return { kind: "parsed", value };
  } catch (exc) {
    return { kind: "failure", reason: String(exc) };
  }
}

/** Read and parse a JSON file. A missing or unreadable file is a failure too. */
export function readJsonFile(path: string): JsonRead {
  let text: string;
  try {
    text = readFileSync(path, "utf-8");
  } catch (exc) {
    return { kind: "failure", reason: String(exc) };
  }
  return parseJson(text);
}

/** The value as an object, when it is one. */
export function asObject(value: Json | undefined): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonObject
    : undefined;
}

/** The value as a string, when it is one. */
export function asString(value: Json | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** The value as a list of strings, when it is an array; other elements are dropped. */
export function asStrings(value: Json | undefined): string[] | undefined {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;
}
