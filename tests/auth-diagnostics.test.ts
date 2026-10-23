import { afterEach, describe, expect, it, vi } from 'vitest';
import { publicResourceLocation, startAuthDiagnostics } from '../src/data/authDiagnostics';
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Diagnóstico de Auth sin credenciales', () => {
  it('elimina parámetros OAuth y fragmentos de todas las URL', () => {
    expect(publicResourceLocation('/__/auth/handler?code=private-code&state=private-state#id_token=private-token', 'https://example.test')).toBe('https://example.test/__/auth/handler');
  });
  it('informa sólo metadatos del iframe y cuenta mensajes sin tocar su contenido', () => {
    const handlers: Record<string, (event: unknown) => void> = {};
    const remove = vi.fn(), warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const inner = { readyState: 'complete', URL: 'https://example.test/__/auth/iframe?secret=hidden', body: { innerHTML: '<p>example</p>' }, querySelectorAll: () => [{ src: 'https://example.test/__/auth/iframe.js?token=hidden' }] };
    vi.stubGlobal('location', { origin: 'https://example.test' });
    vi.stubGlobal('window', { addEventListener: (name: string, fn: (event: unknown) => void) => { handlers[name] = fn; }, removeEventListener: remove });
    vi.stubGlobal('document', { addEventListener: (name: string, fn: (event: unknown) => void) => { handlers[name] = fn; }, removeEventListener: remove, querySelectorAll: () => [{ src: inner.URL, contentDocument: inner }] });
    const diagnostics = startAuthDiagnostics();
    const message = { origin: 'https://example.test', get data() { throw new Error('No se puede leer una credencial'); } };
    handlers.message(message);
    handlers.error({ target: { nodeName: 'SCRIPT', getAttribute: () => 'https://example.test/__/auth/iframe.js?token=hidden' } });
    diagnostics.report(); diagnostics.stop();
    const output = String(warn.mock.calls[0][1]);
    expect(output).not.toMatch(/hidden|secret|token|credential|example<\/p>/);
    expect(JSON.parse(output)).toMatchObject({ phase: 'google-return', frames: [{ documentState: 'complete', bodyLength: 14, scripts: ['https://example.test/__/auth/iframe.js'] }], messages: { 'https://example.test/': 1 }, resourceErrors: ['https://example.test/__/auth/iframe.js'] });
    expect(remove).toHaveBeenCalledTimes(2);
  });
});
