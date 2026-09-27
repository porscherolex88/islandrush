export function maskAccount(n: string) {
  return n.length <= 4 ? n : `•••• ${n.slice(-4)}`;
}
