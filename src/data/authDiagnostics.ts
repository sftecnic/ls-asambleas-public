/** Public resource locations only. OAuth query strings and fragments never leave the browser. */
export function publicResourceLocation(value: string, base: string): string {
  try { const url = new URL(value, base); return `${url.origin}${url.pathname}`; }
  catch { return 'ubicación no disponible'; }
}

export function startAuthDiagnostics() {
  const messages: Record<string, number> = {};
  const resourceErrors: string[] = [];
  const enabled = typeof window !== 'undefined' && typeof document !== 'undefined';
  const onMessage = (event: MessageEvent) => {
    // Never inspect event.data: a relay message can contain OAuth credentials.
    const origin = event.origin === 'null' ? 'null' : publicResourceLocation(event.origin, location.origin);
    messages[origin] = (messages[origin] || 0) + 1;
  };
  const onResourceError = (event: Event) => {
    const target = event.target as Element | null;
    if (target && ['SCRIPT', 'IFRAME'].includes(target.nodeName)) {
      const source = target.getAttribute('src');
      if (source && resourceErrors.length < 10) resourceErrors.push(publicResourceLocation(source, location.origin));
    }
  };
  if (enabled) {
    window.addEventListener('message', onMessage);
    document.addEventListener('error', onResourceError, true);
  }
  return {
    stop() {
      if (!enabled) return;
      window.removeEventListener('message', onMessage);
      document.removeEventListener('error', onResourceError, true);
    },
    report() {
      if (!enabled) return;
      const frames = [...document.querySelectorAll<HTMLIFrameElement>('iframe')].filter(frame => {
        try { return new URL(frame.src, location.origin).pathname.startsWith('/__/auth/'); } catch { return false; }
      }).map(frame => {
        const result: Record<string, unknown> = { source: publicResourceLocation(frame.src, location.origin), documentState: 'inaccesible' };
        try {
          const inner = frame.contentDocument;
          if (inner) {
            result.documentState = inner.readyState;
            result.bodyLength = inner.body?.innerHTML.length || 0;
            result.documentLocation = publicResourceLocation(inner.URL, location.origin);
            result.scripts = [...inner.querySelectorAll<HTMLScriptElement>('script[src]')].map(script => publicResourceLocation(script.src, inner.URL));
          }
        } catch { /* An inaccessible frame is diagnostic data; do not log the exception. */ }
        return result;
      });
      console.warn('LS Asambleas: espera de Google', JSON.stringify({ phase: 'google-return', frames, messages, resourceErrors }));
    },
  };
}
