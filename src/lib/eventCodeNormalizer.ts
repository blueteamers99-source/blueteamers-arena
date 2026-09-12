/**
 * Centralized Event Code Normalization Utility for Blueteamers Arena.
 * Ensures consistent formatting: COLLEGE-XXXX across all frontend pages and API calls.
 *
 * Examples:
 * - "cbit-3154"    -> "CBIT-3154"
 * - "CBIT3154"     -> "CBIT-3154"
 * - "cbit3154"     -> "CBIT-3154"
 * - "CBIT 3154"    -> "CBIT-3154"
 * - "JNTU6227"     -> "JNTU-6227"
 * - "CBIT@3154"    -> "CBIT-3154"
 * - "cbit 3154!"   -> "CBIT-3154"
 * - "3154CBIT"     -> "CBIT-3154"
 */
export function normalizeEventCode(rawInput: string): string {
  if (!rawInput) return "";
  let code = String(rawInput).trim().toUpperCase();

  // Step 1: Strip special characters (keep only letters, digits, spaces, hyphens)
  code = code.replace(/[^A-Z0-9\s\-]/g, "");

  // Step 2: Replace multiple spaces or hyphens with a single hyphen
  code = code.replace(/[\s\-]+/g, "-");

  // Step 3: If no hyphen, try to insert one between letters and digits
  if (!code.includes("-")) {
    // Standard: letters then digits (e.g., "CBIT3154")
    let match = code.match(/^([A-Z]+)(\d+)$/);
    if (match) {
      code = `${match[1]}-${match[2]}`;
    } else {
      // Reversed: digits then letters (e.g., "3154CBIT" -> "CBIT-3154")
      match = code.match(/^(\d+)([A-Z]+)$/);
      if (match) {
        code = `${match[2]}-${match[1]}`;
      }
    }
  }

  // Step 4: Validate final format — must be COLLEGE-DIGITS (e.g., CBIT-3154)
  if (!/^[A-Z]+-\d+$/.test(code)) {
    return "";
  }

  return code;
}
