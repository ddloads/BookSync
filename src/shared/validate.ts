import type * as z from 'zod';

/**
 * Parse a JSON string and validate against a Zod schema.
 * Graceful: on validation failure, logs a warning and returns the raw parsed data.
 * On JSON parse failure, throws.
 */
export function safeParseJSON<T>(json: string, schema: z.ZodType<T>, context: string): T {
  const data = JSON.parse(json);
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn(`[BookSync] Schema validation warning (${context}):`, result.error.issues);
    return data as T;
  }
  return result.data;
}

/**
 * Validate already-parsed data against a Zod schema.
 * Graceful: on validation failure, logs a warning and returns the raw data.
 */
export function safeValidate<T>(data: unknown, schema: z.ZodType<T>, context: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn(`[BookSync] Schema validation warning (${context}):`, result.error.issues);
    return data as T;
  }
  return result.data;
}
