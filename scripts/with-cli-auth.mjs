import { readdir, access, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// Reuse the operator's approved Firebase CLI session. Never print or persist tokens.
const allowed = new Set(['check-installation.mjs','provision-installation.mjs','check-free-project.mjs','setup-meeting-service.mjs','bootstrap-admin.mjs','deploy-safe.mjs','inspect-project.mjs','import-data.mjs','save-mail-templates.mjs','regularize-team.mjs','classify-people.mjs','migrate-account.mjs']);
try {
  const [target, ...args] = process.argv.slice(2);
  if (!allowed.has(target)) throw new Error('Operación no permitida por este asistente de configuración.');
  const root = resolve('.tools/npm-cache/_npx');
  let modulePath;
  for (const dir of await readdir(root)) {
    const candidate = join(root,dir,'node_modules/firebase-tools/lib/auth.js');
    try { await access(candidate); const pkg=JSON.parse(await readFile(join(root,dir,'node_modules/firebase-tools/package.json'),'utf8'));if(pkg.version==='15.34.1'){modulePath=candidate; break;} } catch { /* Not a pinned Firebase CLI install. */ }
  }
  if (!modulePath) throw new Error('Primero ejecuta npx.cmd --cache .tools/npm-cache -y firebase-tools@15.34.1 login.');
  const require = createRequire(import.meta.url);
  const auth = require(modulePath);
  const account = auth.getProjectDefaultAccount(process.cwd()) ?? auth.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) throw new Error('No hay una sesión de Firebase autorizada.');
  const scopes = ['https://www.googleapis.com/auth/cloud-platform', ...(['import-data.mjs','save-mail-templates.mjs','regularize-team.mjs','classify-people.mjs','migrate-account.mjs'].includes(target) ? ['email', 'openid'] : [])];
  const result = await auth.getAccessToken(account.tokens.refresh_token, scopes);
  if (!result.access_token) throw new Error('Google no ha devuelto una sesión válida.');
  process.env.GOOGLE_OAUTH_ACCESS_TOKEN = result.access_token;
  process.argv = [process.argv[0],resolve('scripts',target),...args];
  await import(pathToFileURL(resolve('scripts',target)).href);
  delete process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
} catch (error) { console.error(error.message); process.exitCode=1; }
