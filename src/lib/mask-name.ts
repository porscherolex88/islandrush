/** Public-safe display name: first letter of the first name, stars, last letter. "Jessica Tan" becomes "J***a". */
export function maskName(name: string | null | undefined) {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  const chars = Array.from(first);
  if (chars.length === 0) return "Player";
  if (chars.length <= 2) return `${chars[0]}***`;
  return `${chars[0]}***${chars[chars.length - 1]}`;
}
