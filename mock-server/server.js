'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const fixtures = require('./fixtures');
const { SCENARIOS, ROUTE_LABELS, state, reset, scenario, setScenario, record } = require('./state');

const PORT = Number(process.env.PORT || argValue('--port') || 8080);
const ORIGIN = process.env.MOCK_ORIGIN || argValue('--origin') || 'http://localhost:4200';

/** The backend guard against JMS selector injection (JmsMessageRepository.SAFE_MESSAGE_ID). */
const SAFE_MESSAGE_ID = /^[A-Za-z0-9:_.-]{1,255}$/;

/* -------------------------------------------------------------------------- */
/* Tokens                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A structurally real JWT with a fake signature. The frontend treats the token as
 * opaque, but devtools -- and any future code that decodes it -- should see three
 * base64url segments rather than a random string.
 */
function issueToken(username, roles) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    sub: username,
    roles,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  }));
  return header + '.' + payload + '.mock-signature-not-verified';
}

/** Returns `{username, roles}` or null. Expiry is honoured, so a stale tab gets its 401. */
function readToken(raw) {
  const parts = String(raw || '').split('.');
  if (parts.length !== 3) {
    return null;
  }
  try {
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) {
      return null;
    }
    return { username: claims.sub, roles: claims.roles || [] };
  } catch {
    return null;
  }
}

function b64url(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

/* -------------------------------------------------------------------------- */
/* Responses                                                                  */
/* -------------------------------------------------------------------------- */

function send(res, status, body, contentType) {
  res.writeHead(status, contentType ? { 'Content-Type': contentType } : {});
  res.end(body === undefined || body === null ? '' : body);
}

function json(res, status, value) {
  send(res, status, JSON.stringify(value), 'application/json; charset=utf-8');
}

function text(res, status, value) {
  send(res, status, value, 'text/plain; charset=utf-8');
}

/** The ApiResponse envelope, used for both business outcomes and error bodies. */
function api(res, status, success, message) {
  json(res, status, { success, message });
}

/**
 * The upstream failures ApiExceptionHandler maps, so the frontend sees exactly the
 * status/body pair it will see in production.
 */
function brokerDown(res) {
  api(res, 502, false, 'Broker unavailable: mock broker is stopped (scenario: broker-down)');
}

function serverError(res) {
  api(res, 500, false, 'Unexpected error (scenario: server-error)');
}

function badRequest(res) {
  api(res, 400, false, 'Invalid request parameter.');
}

/* -------------------------------------------------------------------------- */
/* Server                                                                     */
/* -------------------------------------------------------------------------- */

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error('[mock] handler failed:', err);
    if (!res.headersSent) {
      api(res, 500, false, 'Mock server error: ' + err.message);
    }
  });
});

async function handle(req, res) {
  cors(res);

  // Preflight is answered before any auth check, exactly as the real CorsFilter does by
  // sitting ahead of authorization in the security chain.
  if (req.method === 'OPTIONS') {
    return send(res, 204);
  }

  const rawPath = req.url.split('?')[0];

  // The control panel is deliberately outside /api: no auth, no latency, no scenarios.
  if (rawPath === '/__mock' || rawPath.startsWith('/__mock/')) {
    return panel(req, res, rawPath);
  }

  const rawSegments = rawPath.split('/').filter(Boolean);

  // Reproduces the observed container rejection of a double-encoded segment (%253A). It
  // happens before routing, which is why the real backend log stays silent and the
  // browser just reports the call as failed. Logged loudly here so the cause is visible.
  if (state.strictPaths && rawSegments.some((s) => /%25/i.test(s))) {
    console.warn('[mock] 400 double-encoded path segment: ' + rawPath);
    record({
      at: new Date().toISOString(),
      method: req.method,
      path: rawPath,
      status: 400,
      note: 'double-encoded path -- see README',
    });
    return text(res, 400, 'Bad Request: double-encoded path segment.');
  }

  let segments;
  try {
    segments = rawSegments.map(decodeURIComponent);
  } catch {
    return text(res, 400, 'Bad Request: malformed percent-encoding.');
  }

  if (segments[0] !== 'api') {
    return text(res, 404, 'Not Found. The mock serves /api/* and /__mock.');
  }

  const delay = state.latencyMs + (isSlow(segments) ? 3000 : 0);
  if (delay > 0) {
    await sleep(delay);
  }

  const note = await route(req, res, segments);
  record({
    at: new Date().toISOString(),
    method: req.method,
    path: rawPath,
    status: res.statusCode,
    note: note || '',
  });
}

/** Only the message list has a `slow` scenario, and only its own requests should stall. */
function isSlow(segments) {
  return scenario('messages.list') === 'slow'
    && segments[1] === 'messages' && segments[2] === 'queue' && segments.length === 4;
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  // Matches SecurityConfig: bearer tokens ride in a header, so credentials mode stays off.
  res.setHeader('Access-Control-Allow-Credentials', 'false');
}

/* -------------------------------------------------------------------------- */
/* Routing                                                                    */
/* -------------------------------------------------------------------------- */

async function route(req, res, segments) {
  const area = segments[1];
  const rest = segments.slice(2);

  if (area === 'auth' && rest[0] === 'login' && req.method === 'POST') {
    return login(req, res);
  }

  // Everything else requires a bearer token. A missing or expired one is answered by the
  // resource-server filter with a bare 401 and no ApiResponse body -- that is the shape
  // AuthInterceptor keys off to clear the session and bounce to /login.
  const auth = readToken((req.headers.authorization || '').replace(/^Bearer /, ''));
  if (!auth) {
    res.setHeader('WWW-Authenticate', 'Bearer');
    send(res, 401);
    return 'missing or expired token';
  }

  if (area === 'queues') {
    return queues(req, res, rest, auth);
  }
  if (area === 'messages') {
    return messages(req, res, rest, auth);
  }

  return notFound(res);
}

async function login(req, res) {
  if (scenario('auth.login') === 'invalid') {
    // AuthenticationException reaches ApiExceptionHandler, so this 401 -- unlike the
    // filter's -- does carry an ApiResponse body.
    api(res, 401, false, 'Invalid username or password.');
    return 'forced invalid';
  }

  let creds;
  try {
    creds = JSON.parse((await readBody(req)) || '{}');
  } catch {
    badRequest(res);
    return 'unparseable login body';
  }

  const user = fixtures.USERS.find(
    (u) => u.username === creds.username && u.password === creds.password);
  if (!user) {
    api(res, 401, false, 'Invalid username or password.');
    return 'bad credentials';
  }

  json(res, 200, {
    token: issueToken(user.username, user.roles),
    username: user.username,
    roles: user.roles,
  });
  return 'signed in as ' + user.username;
}

async function queues(req, res, rest, auth) {
  if (rest[0] === 'artemis-jolokia' && rest[1] === 'names' && req.method === 'GET') {
    switch (scenario('queues.names')) {
      case 'broker-down': return brokerDown(res);
      case 'empty': return json(res, 200, []);
      default: return json(res, 200, state.queues);
    }
  }

  if (rest[0] === 'last-used') {
    if (req.method === 'GET') {
      switch (scenario('queues.lastUsed')) {
        case 'server-error': return serverError(res);
        // Absence is an empty 200, not a 404 -- the normal first run for a new user.
        case 'none': return text(res, 200, '');
        default: return text(res, 200, state.lastUsed[auth.username] || '');
      }
    }
    if (req.method === 'POST') {
      // The user comes from the token, never from the request, matching the
      // Principal-based controller.
      const queueName = (await readBody(req)).trim();
      state.lastUsed[auth.username] = queueName;
      send(res, 200);
      return 'last-used = ' + queueName;
    }
  }

  return notFound(res);
}

async function messages(req, res, rest, auth) {
  if (rest[0] !== 'queue' || !rest[1]) {
    return notFound(res);
  }
  const queueName = rest[1];

  // GET /api/messages/queue/{queueName}
  if (rest.length === 2 && req.method === 'GET') {
    switch (scenario('messages.list')) {
      case 'broker-down': return brokerDown(res);
      case 'server-error': return serverError(res);
      case 'empty': return json(res, 200, []);
      default: return json(res, 200, state.messages[queueName] || []);
    }
  }

  if (rest[2] !== 'message' || !rest[3]) {
    return notFound(res);
  }
  const messageId = rest[3];
  const action = rest[4];

  if (!SAFE_MESSAGE_ID.test(messageId)) {
    console.warn('[mock] 400 unsafe message id: ' + messageId);
    badRequest(res);
    return 'rejected by SAFE_MESSAGE_ID';
  }

  // GET .../message/{messageId}
  if (!action && req.method === 'GET') {
    switch (scenario('messages.get')) {
      case 'broker-down': return brokerDown(res);
      case 'server-error': return serverError(res);
      // A missing message is a 200 with an empty body, as the backend returns null.
      case 'not-found': return send(res, 200);
      default: {
        const found = find(queueName, messageId);
        return found ? json(res, 200, found) : send(res, 200);
      }
    }
  }

  if (action === 'resend' && req.method === 'POST') {
    // Resend copies onto the queue; the browsed message stays where it is.
    return mutate(res, 'messages.resend', queueName, messageId, auth, false,
      'Message resent successfully.', () => {});
  }

  if (!action && req.method === 'DELETE') {
    return mutate(res, 'messages.delete', queueName, messageId, auth, true,
      'Message deleted successfully.', () => remove(queueName, messageId));
  }

  if (action === 'move-to-dlq' && req.method === 'POST') {
    return mutate(res, 'messages.dlq', queueName, messageId, auth, true,
      'Message moved to DLQ successfully.', () => moveToDlq(queueName, messageId));
  }

  return notFound(res);
}

/**
 * The shared shape of the three mutating endpoints: scenario override, role gate, then
 * the state change. The case that matters most is `refused` -- HTTP 200 carrying
 * `success: false` -- because a caller that only handles the error callback will treat
 * it as a success.
 */
function mutate(res, route, queueName, messageId, auth, adminOnly, okMessage, apply) {
  const forced = scenario(route);

  if (forced === 'broker-down') {
    return brokerDown(res);
  }
  if (forced === 'bad-id') {
    return badRequest(res);
  }

  const roles = auth.roles || [];
  if (forced === 'forbidden' || (adminOnly && !roles.includes('ADMIN'))) {
    // Method security denies with a bare 403: AccessDeniedException is not handled by
    // ApiExceptionHandler, so no ApiResponse body reaches the client.
    send(res, 403);
    return '403 for roles [' + roles.join(',') + ']';
  }

  if (forced === 'refused') {
    api(res, 200, false, 'Operation refused by the broker (scenario: refused)');
    return 'HTTP 200 with success:false';
  }

  // A missing message is also reported as a 200 with success:false, not a 404.
  if (!find(queueName, messageId)) {
    api(res, 200, false, 'Message not found.');
    return 'HTTP 200 with success:false (not found)';
  }

  apply();
  api(res, 200, true, okMessage);
  return null;
}

function find(queueName, messageId) {
  return (state.messages[queueName] || []).find((m) => m.messageId === messageId) || null;
}

function remove(queueName, messageId) {
  const list = state.messages[queueName] || [];
  const at = list.findIndex((m) => m.messageId === messageId);
  if (at !== -1) {
    list.splice(at, 1);
  }
}

function moveToDlq(queueName, messageId) {
  const list = state.messages[queueName] || [];
  const at = list.findIndex((m) => m.messageId === messageId);
  if (at === -1) {
    return;
  }
  const moved = list.splice(at, 1)[0];
  moved.properties = Object.assign({}, moved.properties, { _AMQ_ORIG_QUEUE: queueName });
  moved.queueName = 'DLQ';
  state.messages.DLQ = state.messages.DLQ || [];
  state.messages.DLQ.push(moved);
}

function notFound(res) {
  api(res, 404, false, 'No such endpoint on the mock backend.');
  return 'unrouted';
}

/* -------------------------------------------------------------------------- */
/* Control panel                                                              */
/* -------------------------------------------------------------------------- */

async function panel(req, res, rawPath) {
  if (rawPath === '/__mock' || rawPath === '/__mock/') {
    const html = fs.readFileSync(path.join(__dirname, 'panel.html'), 'utf8');
    return send(res, 200, html, 'text/html; charset=utf-8');
  }

  if (rawPath === '/__mock/state' && req.method === 'GET') {
    return json(res, 200, {
      scenarios: state.scenarios,
      latencyMs: state.latencyMs,
      strictPaths: state.strictPaths,
      catalogue: SCENARIOS,
      labels: ROUTE_LABELS,
      counts: Object.fromEntries(
        Object.entries(state.messages).map((entry) => [entry[0], entry[1].length])),
      lastUsed: state.lastUsed,
      log: state.log,
    });
  }

  if (rawPath === '/__mock/state' && req.method === 'POST') {
    let patch;
    try {
      patch = JSON.parse((await readBody(req)) || '{}');
    } catch {
      return api(res, 400, false, 'Unparseable patch body.');
    }
    if (patch.route && !setScenario(patch.route, patch.scenario)) {
      return api(res, 400, false, 'Unknown route/scenario: ' + patch.route + '/' + patch.scenario);
    }
    if (typeof patch.latencyMs === 'number') {
      state.latencyMs = Math.max(0, Math.min(10000, patch.latencyMs));
    }
    if (typeof patch.strictPaths === 'boolean') {
      state.strictPaths = patch.strictPaths;
    }
    return json(res, 200, { ok: true });
  }

  if (rawPath === '/__mock/reset' && req.method === 'POST') {
    reset();
    console.log('[mock] fixtures reset');
    return json(res, 200, { ok: true });
  }

  return api(res, 404, false, 'No such control endpoint.');
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function argValue(flag) {
  const at = process.argv.indexOf(flag);
  return at === -1 ? undefined : process.argv[at + 1];
}

server.listen(PORT, () => {
  console.log('[mock] message-inspector mock backend on http://localhost:' + PORT);
  console.log('[mock] control panel                    http://localhost:' + PORT + '/__mock');
  console.log('[mock] CORS origin                      ' + ORIGIN);
  console.log('[mock] sign in as admin/admin (ADMIN) or jason/jason (USER)');
});
