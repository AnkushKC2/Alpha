const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const users = new Map();
const eventClients = new Set();

const staticFiles = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/register.html': 'register.html',
  '/login.html': 'login.html',
  '/home.html': 'home.html',
  '/styles.css': 'styles.css',
  '/auth.js': 'auth.js',
};

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let data = '';
    request.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        reject(new Error('Payload too large'));
      }
    });
    request.on('end', () => {
      try {
        const payload = data ? JSON.parse(data) : {};
        resolve(payload);
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    request.on('error', reject);
  });
}

function publishEvent(eventType, detail) {
  const payload = `data: ${JSON.stringify({ eventType, detail, at: new Date().toISOString() })}\n\n`;
  for (const client of eventClients) {
    client.write(payload);
  }
}

function handleEvents(request, response) {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  response.write(`data: ${JSON.stringify({ eventType: 'connected', at: new Date().toISOString() })}\n\n`);
  eventClients.add(response);

  request.on('close', () => {
    eventClients.delete(response);
  });
}

async function handleRegister(request, response) {
  try {
    const { name, email, password } = await parseBody(request);
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const safeName = typeof name === 'string' ? name.trim() : '';
    const safePassword = typeof password === 'string' ? password : '';

    if (!safeName || !normalizedEmail || safePassword.length < 8) {
      return sendJson(response, 400, {
        ok: false,
        message: 'Name, email, and password (min 8 chars) are required.',
      });
    }

    if (users.has(normalizedEmail)) {
      return sendJson(response, 409, {
        ok: false,
        message: 'Email already exists. Please login instead.',
      });
    }

    users.set(normalizedEmail, {
      name: safeName,
      passwordHash: hashPassword(safePassword),
      createdAt: new Date().toISOString(),
    });

    publishEvent('register', { email: normalizedEmail, name: safeName });

    return sendJson(response, 201, {
      ok: true,
      message: 'Account created. You can login now.',
      user: {
        name: safeName,
        email: normalizedEmail,
        createdAt: users.get(normalizedEmail).createdAt,
      },
    });
  } catch (error) {
    return sendJson(response, 400, { ok: false, message: error.message });
  }
}

async function handleLogin(request, response) {
  try {
    const { email, password } = await parseBody(request);
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const safePassword = typeof password === 'string' ? password : '';

    const user = users.get(normalizedEmail);
    if (!user || user.passwordHash !== hashPassword(safePassword)) {
      return sendJson(response, 401, {
        ok: false,
        message: 'Invalid email or password.',
      });
    }

    publishEvent('login', { email: normalizedEmail, name: user.name });

    return sendJson(response, 200, {
      ok: true,
      message: `Welcome back, ${user.name}!`,
      user: {
        name: user.name,
        email: normalizedEmail,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    return sendJson(response, 400, { ok: false, message: error.message });
  }
}

function serveStatic(response, fileName) {
  const fullPath = path.join(__dirname, fileName);
  fs.readFile(fullPath, (error, content) => {
    if (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Server error');
      return;
    }

    const extension = path.extname(fileName);
    response.writeHead(200, {
      'Content-Type': mimeTypes[extension] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    response.end(content);
  });
}

const server = http.createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/events') {
    return handleEvents(request, response);
  }

  if (request.method === 'POST' && request.url === '/api/register') {
    return handleRegister(request, response);
  }

  if (request.method === 'POST' && request.url === '/api/login') {
    return handleLogin(request, response);
  }

  if (request.method === 'GET' && staticFiles[request.url]) {
    return serveStatic(response, staticFiles[request.url]);
  }

  response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ ok: false, message: 'Not found' }));
});

server.listen(PORT, HOST, () => {
  console.log(`Server running in real time on http://${HOST}:${PORT}`);
});
