/**
 * Input validation utilities for MCP tool parameters.
 *
 * AI agents are helpful, but they can also pass
 * "'; DROP TABLE users; --" as a product name.
 * This makes sure that doesn't happen on your watch.
 */
export class InputValidator {
  /**
   * Validate that a string doesn't contain common injection patterns
   *
   * Checks for XSS, SQL injection, template injection,
   * and other fun ways people try to break your app.
   */
  static isSafeString(input: string): boolean {
    const dangerousPatterns = [
      /\$\{.*\}/,           // template injection — "${HACKED}"
      /<script.*>.*<\/script>/is,  // XSS — "<script>alert(1)</script>"
      /javascript:/i,       // javascript: URIs — old school but still scary
      /on\w+\s*=/i,         // event handlers — "onclick=..."
      /--\s/,               // SQL comment injection — classic
      /;\s*DROP\s+/i,       // SQL drop — "lil bobby tables"
      /;\s*DELETE\s+/i,     // SQL delete — bye bye data
      /\x00/,               // null bytes — binary nonsense
      /(%0d|%0a)/i,         // URL-encoded newlines — smuggling payloads
    ];

    return !dangerousPatterns.some((pattern) => pattern.test(input));
  }

  /**
   * Sanitize a string parameter (strip dangerous characters)
   *
   * Truncates to max length and strips control characters.
   * We keep newlines and tabs because those are actually useful.
   */
  static sanitizeString(input: string, maxLength: number = 10000): string {
    let sanitized = input.slice(0, maxLength);
    // strip control characters except newlines (\n) and tabs (\t)
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    return sanitized;
  }

  /**
   * Validate that a numeric parameter is within allowed range
   *
   * No negative quantities. No NaN. No Infinity.
   * Keep your numbers within the guardrails.
   */
  static isSafeNumber(value: number, min?: number, max?: number): boolean {
    if (!Number.isFinite(value)) return false;
    if (min !== undefined && value < min) return false;
    if (max !== undefined && value > max) return false;
    return true;
  }

  /**
   * Validate that an array parameter is within size limits
   *
   * We love arrays. We do not love 10-million-element arrays.
   */
  static isSafeArray(arr: unknown[], maxLength: number = 1000): boolean {
    return arr.length <= maxLength;
  }

  /**
   * Validate that an object parameter doesn't have too many keys
   *
   * If an agent sends you an object with 10,000 keys,
   * it's probably not trying to search for a product.
   */
  static isSafeObject(obj: Record<string, unknown>, maxKeys: number = 100): boolean {
    const keys = Object.keys(obj);
    return keys.length <= maxKeys;
  }

  /**
   * Deep sanitize parameters object recursively
   *
   * Goes through every key and value, recursively,
   * and cleans up anything that looks sketchy.
   * Max depth of 5 because if your params go deeper than that,
   * you have bigger problems.
   */
  static sanitizeParams(
    params: Record<string, unknown>,
    maxDepth: number = 5,
    currentDepth: number = 0
  ): Record<string, unknown> {
    if (currentDepth > maxDepth) return {};

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      const safeKey = this.sanitizeString(String(key), 256);

      if (typeof value === 'string') {
        sanitized[safeKey] = this.sanitizeString(value);
      } else if (typeof value === 'number') {
        sanitized[safeKey] = this.isSafeNumber(value) ? value : 0;
      } else if (typeof value === 'boolean') {
        sanitized[safeKey] = value;
      } else if (value === null) {
        sanitized[safeKey] = null;
      } else if (Array.isArray(value)) {
        if (this.isSafeArray(value)) {
          sanitized[safeKey] = value.map((item) => {
            if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
              return this.sanitizeParams(item as Record<string, unknown>, maxDepth, currentDepth + 1);
            }
            if (typeof item === 'string') return this.sanitizeString(item);
            return item;
          });
        } else {
          sanitized[safeKey] = [];
        }
      } else if (typeof value === 'object' && value !== null) {
        sanitized[safeKey] = this.sanitizeParams(
          value as Record<string, unknown>,
          maxDepth,
          currentDepth + 1
        );
      }
    }

    return sanitized;
  }
}
