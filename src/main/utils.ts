export function sanitize(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim();
}
