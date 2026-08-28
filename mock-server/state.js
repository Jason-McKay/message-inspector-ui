'use strict';

const fixtures = require('./fixtures');

/**
 * All mutable mock state, in one module so the control panel has a single thing to read
 * and patch. Nothing is persisted: restarting the process is equivalent to a reset.
 */

/**
 * The scenarios each route can be forced into. `ok` is always the happy path; the rest
 * exist because the frontend's failure branches are otherwise unreachable without
 * stopping a real broker.
 *
 * Keep the keys in sync with panel.html, which renders straight from this map.
 */
const SCENARIOS = {
  'messages.list': ['ok', 'empty', 'slow', 'broker-down', 'server-error'],
  'messages.get': ['ok', 'not-found', 'broker-down', 'server-error'],
  'messages.resend': ['ok', 'refused', 'bad-id', 'broker-down'],
  'messages.delete': ['ok', 'refused', 'forbidden', 'broker-down'],
  'messages.dlq': ['ok', 'refused', 'bad-id', 'broker-down'],
  'queues.names': ['ok', 'empty', 'broker-down'],
  'queues.lastUsed': ['ok', 'none', 'server-error'],
  'auth.login': ['ok', 'invalid'],
};

/** Human-readable labels for the panel; the route key alone is too terse to scan. */
const ROUTE_LABELS = {
  'messages.list': 'GET  /api/messages/queue/{q}',
  'messages.get': 'GET  /api/messages/queue/{q}/message/{id}',
  'messages.resend': 'POST /api/messages/.../resend',
  'messages.delete': 'DEL  /api/messages/.../message/{id}',
  'messages.dlq': 'POST /api/messages/.../move-to-dlq',
  'queues.names': 'GET  /api/queues/artemis-jolokia/names',
  'queues.lastUsed': 'GET  /api/queues/last-used',
  'auth.login': 'POST /api/auth/login',
};

const MAX_LOG = 100;

const state = {
  scenarios: {},
  /** Applied to every /api response. The `slow` scenario adds 3s on top of this. */
  latencyMs: 0,
  /**
   * Reproduce the container's rejection of a double-encoded path segment. On by default
   * because that bug is silent from the browser side; see README.
   */
  strictPaths: true,
  queues: [],
  messages: {},
  /** username -> queue name. The backend keys this off the token, so the mock does too. */
  lastUsed: {},
  log: [],
};

function reset() {
  for (const route of Object.keys(SCENARIOS)) {
    state.scenarios[route] = 'ok';
  }
  state.latencyMs = 0;
  state.strictPaths = true;
  state.queues = [...fixtures.QUEUES];
  state.messages = structuredClone(fixtures.MESSAGES);
  state.lastUsed = {};
  state.log = [];
}

/** Scenario for a route, falling back to `ok` for anything unrecognised. */
function scenario(route) {
  return state.scenarios[route] || 'ok';
}

function setScenario(route, name) {
  if (!SCENARIOS[route] || !SCENARIOS[route].includes(name)) {
    return false;
  }
  state.scenarios[route] = name;
  return true;
}

/**
 * Newest first, capped - the panel polls this and an unbounded array would grow for as
 * long as the mock runs.
 */
function record(entry) {
  state.log.unshift(entry);
  if (state.log.length > MAX_LOG) {
    state.log.length = MAX_LOG;
  }
}

reset();

module.exports = { SCENARIOS, ROUTE_LABELS, state, reset, scenario, setScenario, record };
