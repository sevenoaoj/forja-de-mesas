const encoder = new TextEncoder();

export async function strongEtag(input) {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  let hex = '';
  for (let i = 0; i < 16; i++) hex += digest[i].toString(16).padStart(2, '0');
  return '"' + hex + '"';
}

export function matchesIfNoneMatch(header, etag, {allowWildcard = false} = {}) {
  if (!header || !etag) return false;
  for (const part of header.split(',')) {
    const candidate = part.trim();
    if (!candidate) continue;
    if (allowWildcard && candidate === '*') return true;
    const normalized = candidate.startsWith('W/') ? candidate.slice(2) : candidate;
    if (normalized === etag) return true;
  }
  return false;
}

export function staticAssetHeaders(etag, contentType) {
  return {
    ...(contentType ? {'Content-Type': contentType} : {}),
    'Cache-Control': 'no-cache',
    'ETag': etag,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  };
}

export function createMemoryStaticHandler(assets) {
  const cache = new Map();
  return async function serveAsset(request, pathname) {
    const file = Object.hasOwn(assets, pathname) && assets[pathname];
    if (!file) return new Response('Página não encontrada.', {status: 404});
    let entry = cache.get(pathname);
    if (!entry) {
      const [contentType, base64] = file;
      const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
      entry = {contentType, bytes, etag: await strongEtag(bytes)};
      cache.set(pathname, entry);
    }
    if (['GET', 'HEAD'].includes(request.method) && matchesIfNoneMatch(request.headers.get('if-none-match'), entry.etag, {allowWildcard: true})) {
      return new Response(null, {status: 304, headers: staticAssetHeaders(entry.etag)});
    }
    return new Response(request.method === 'HEAD' ? null : entry.bytes, {
      headers: staticAssetHeaders(entry.etag, entry.contentType)
    });
  };
}
