const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = __dirname;
const port = 4173;
const accounts = new Map();
const mime = { '.css': 'text/css', '.html': 'text/html', '.jpg': 'image/jpeg', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.webm': 'video/webm', '.mp4': 'video/mp4', '.mov': 'video/quicktime' };
const json = (response, status, value) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); };
const readJson = (request) => new Promise((resolve, reject) => { let body = ''; request.on('data', (chunk) => { body += chunk; if (body.length > 100000) request.destroy(); }); request.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON')); } }); request.on('error', reject); });

http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  try {
    if (url.pathname === '/api/accounts' && request.method === 'GET') return json(response, 200, [...accounts.values()].map(({ id, name, cloudName }) => ({ id, name, cloudName })));
    if (url.pathname === '/api/accounts' && request.method === 'POST') {
      const { name, cloudName, apiKey, apiSecret } = await readJson(request);
      if (![name, cloudName, apiKey, apiSecret].every(Boolean)) return json(response, 400, { error: 'All Cloudinary account fields are required.' });
      const id = crypto.randomUUID(); accounts.set(id, { id, name, cloudName, apiKey, apiSecret }); return json(response, 201, { id, name, cloudName });
    }
    if (url.pathname.startsWith('/api/accounts/') && request.method === 'DELETE') { accounts.delete(url.pathname.split('/').pop()); return json(response, 200, { ok: true }); }
    if (url.pathname === '/api/sign' && request.method === 'POST') {
      const { accountId } = await readJson(request); const account = accounts.get(accountId);
      if (!account) return json(response, 404, { error: 'Cloudinary account not found. Add it again after restarting the local server.' });
      const timestamp = Math.floor(Date.now() / 1000); const folder = 'shrimaan-shikshak-bhavan';
      const signature = crypto.createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${account.apiSecret}`).digest('hex');
      return json(response, 200, { cloudName: account.cloudName, apiKey: account.apiKey, timestamp, folder, signature });
    }
    if (url.pathname.startsWith('/api/')) return json(response, 404, { error: 'Not found' });
    const requestPath = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    const filePath = path.resolve(root, `.${requestPath}`);
    if (!filePath.startsWith(root)) { response.writeHead(403); response.end('Forbidden'); return; }
    fs.readFile(filePath, (error, data) => { if (error) { response.writeHead(error.code === 'ENOENT' ? 404 : 500); response.end(error.code === 'ENOENT' ? 'Not found' : 'Server error'); return; } response.writeHead(200, { 'Content-Type': `${mime[path.extname(filePath)] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store' }); response.end(data); });
  } catch (error) { json(response, 500, { error: error.message || 'Server error' }); }
}).listen(port, '127.0.0.1', () => console.log(`Shrimaan Shikshak Bhavan is running at http://localhost:${port}`));
