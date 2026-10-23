/** Firebase's built-in auth helpers and the app share the same browser origin. */
export function canonicalAppUrl(projectId: string | undefined, href: string, production: boolean): string | null {
  if (!production || !projectId || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) return null;
  const url = new URL(href);
  if (url.protocol !== 'https:' || url.hostname !== `${projectId}.web.app` || url.pathname.startsWith('/__/')) return null;
  url.hostname = `${projectId}.firebaseapp.com`;
  return url.href;
}
