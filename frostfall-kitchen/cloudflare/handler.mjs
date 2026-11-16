const redirects = new Map([
  ['/works', '/works/'],
  ['/classic', '/classic/'],
  ['/index.html', '/'],
  ['/works/index.html', '/works/'],
  ['/classic/index.html', '/classic/']
]);

const responseHeaders = {
  'Cache-Control': 'no-cache',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff'
};
const commonPolicy = "default-src 'none'; img-src 'self' data: blob:; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none'; form-action 'none'";
const stylePolicy = "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com";
const classicPolicy = `${commonPolicy}; ${stylePolicy}; script-src 'self' 'unsafe-inline'; base-uri 'none'`;
const operationsPolicy = `${commonPolicy}; ${stylePolicy}; script-src 'self'; base-uri 'self'`;

export default {
  fetch(request) {
    const { method } = request;
    if (method !== 'GET' && method !== 'HEAD') {
      return new Response('Method not allowed', {
        status: 405,
        headers: { ...responseHeaders, Allow: 'GET, HEAD' }
      });
    }

    const url = new URL(request.url);
    const redirect = redirects.get(url.pathname);
    if (redirect) {
      return new Response(null, {
        status: 308,
        headers: { ...responseHeaders, Location: redirect + url.search }
      });
    }

    const file = files.get(url.pathname);
    if (!file) {
      return new Response(method === 'HEAD' ? null : 'Not found', {
        status: 404,
        headers: responseHeaders
      });
    }

    const [type, body, etag] = file;
    const headers = {
      ...responseHeaders,
      'Content-Type': `${type}; charset=utf-8`,
      ETag: etag
    };
    if (type === 'text/html') {
      headers['Content-Security-Policy'] = url.pathname === '/classic/'
        ? classicPolicy
        : operationsPolicy;
    }
    const cacheTags = request.headers.get('If-None-Match')?.split(',');
    const isCached = cacheTags?.some((tag) => {
      const value = tag.trim().replace(/^W\//, '');
      return value === '*' || value === etag;
    });
    return new Response(method === 'HEAD' || isCached ? null : body, {
      status: isCached ? 304 : 200,
      headers
    });
  }
};
