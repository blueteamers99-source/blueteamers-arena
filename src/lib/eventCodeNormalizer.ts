/**
 * Centralized Event Code Normalization Utility for Blueteamers Arena.
 * Ensures consistent formatting: COLLEGE-XXXX across all frontend pages and API calls.
 * 
 * Examples:
 * - "cbit-3154"  -> "CBIT-3154"
 * - "CBIT3154"   -> "CBIT-3154"
 * - "cbit3154"   -> "CBIT-3154"
 * - "CBIT 3154"  -> "CBIT-3154"
 * - "JNTU6227"   -> "JNTU-6227"
 */
export function normalizeEventCode(rawInput: string): string {
  if (!rawInput) return "";
  let code = String(rawInput).trim().toUpperCase();
  
  // Replace multiple spaces or hyphens with a single hyphen
  code = code.replace(/[\s\-]+/g, "-");
  
  // If no hyphen exists, insert hyphen between alpha prefix and numeric suffix
  if (!code.includes("-")) {
    const match = code.match(/^([A-Z]+)(\d+)$/);
    if (match) {
      code = `${match[1]}-${match[2]}`;
    }
  }
  return code;
}
