import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

const server = createServer(async (req, res) => {
  console.log(`${req.method} ${req.url}`);

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Handle API routes
  if (req.url.startsWith('/api/')) {
    try {
      const apiModule = await import(`.${req.url}.js`);
      const handler = apiModule.default;
      await handler(req, res);
      return;
    } catch (error) {
      console.error('API Error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
      return;
    }
  }

  // Serve static files
  let filePath = join(__dirname, req.url === '/' ? 'code.html' : req.url);
  
  try {
    const data = readFileSync(filePath);
    const ext = filePath.split('.').pop();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch (error) {
    // Try serving web.html for /web route
    if (req.url === '/web') {
      try {
        const data = readFileSync(join(__dirname, 'web.html'));
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
        return;
      } catch (webError) {
        console.error('Web.html error:', webError);
      }
    }
    
    // 404 - try code.html as fallback
    try {
      const data = readFileSync(join(__dirname, 'code.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    } catch (fallbackError) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    }
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Serving files from: ${__dirname}`);
  console.log(`🌐 Main app: http://localhost:${PORT}/code.html`);
  console.log(`🔍 Web search: http://localhost:${PORT}/web`);
});
