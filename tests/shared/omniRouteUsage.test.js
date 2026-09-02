'use strict';

process.env.TZ = 'UTC';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  collectOmniRouteRows,
  buildOmniRoutePeriods,
  buildOmniRouteHistoryGraph,
  dbExists
} = require('../../src/shared/omniRouteUsage');

const { tmpdir } = os;

test('collectOmniRouteRows returns empty when DB does not exist', () => {
  const nonExistent = path.join(tmpdir(), `omni-route-nodb-${Date.now()}.sqlite`);
  const rows = collectOmniRouteRows({ dbPath: nonExistent });
  assert.deepEqual(rows, []);
});

test('collectOmniRouteRows returns empty when DB exists but has no data', () => {
  const tmpDb = path.join(tmpdir(), `omni-route-empty-${Date.now()}.sqlite`);
  const { DatabaseSync } = require('node:sqlite');
  try {
    const db = new DatabaseSync(tmpDb);
    db.exec(`
      CREATE TABLE usage_history (
        id INTEGER PRIMARY KEY,
        provider TEXT,
        model TEXT,
        tokens_input INTEGER,
        tokens_output INTEGER,
        tokens_cache_read INTEGER,
        tokens_cache_creation INTEGER,
        timestamp TEXT
      );
      CREATE TABLE call_logs (
        id INTEGER PRIMARY KEY,
        provider TEXT,
        model TEXT,
        tokens_in INTEGER,
        tokens_out INTEGER,
        tokens_cache_read INTEGER,
        tokens_cache_creation INTEGER,
        timestamp TEXT,
        duration INTEGER
      );
    `);
    db.close();

    const rows = collectOmniRouteRows({ dbPath: tmpDb });
    assert.deepEqual(rows, []);
  } finally {
    try { fs.unlinkSync(tmpDb); } catch (_) {}
  }
});

test('buildOmniRoutePeriods returns valid structure with no DB', () => {
  const periods = buildOmniRoutePeriods({ dbPath: path.join(tmpdir(), 'nonexistent.sqlite') });
  assert.ok(typeof periods === 'object');
  assert.ok(typeof periods.today === 'object');
  assert.ok(typeof periods.month === 'object');
  assert.ok(typeof periods.allTime === 'object');
  assert.equal(periods.today.totalInput, 0);
  assert.equal(periods.today.totalOutput, 0);
  assert.equal(periods.month.totalInput, 0);
  assert.equal(periods.allTime.totalInput, 0);
});

test('buildOmniRouteHistoryGraph returns valid structure with no DB', () => {
  const graph = buildOmniRouteHistoryGraph({ dbPath: path.join(tmpdir(), 'nonexistent.sqlite') });
  assert.ok(typeof graph === 'object');
  assert.ok(Array.isArray(graph.contributions));
});

test('collectOmniRouteRows parses usage_history rows correctly', () => {
  const tmpDb = path.join(tmpdir(), `omni-route-history-${Date.now()}.sqlite`);
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(tmpDb);
    db.exec(`
      CREATE TABLE usage_history (
        id INTEGER PRIMARY KEY,
        provider TEXT,
        model TEXT,
        tokens_input INTEGER,
        tokens_output INTEGER,
        tokens_cache_read INTEGER,
        tokens_cache_creation INTEGER,
        timestamp TEXT
      );
    `);
    const now = new Date().toISOString().split('T')[0];
    db.prepare(
      'INSERT INTO usage_history (provider, model, tokens_input, tokens_output, tokens_cache_read, tokens_cache_creation, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('openai', 'gpt-4o', 100, 50, 10, 0, `${now}T12:00:00.000Z`);
    db.close();

    const rows = collectOmniRouteRows({ dbPath: tmpDb });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].client, 'omniroute');
    assert.equal(rows[0].provider, 'openai');
    assert.equal(rows[0].model, 'gpt-4o');
    assert.equal(rows[0].input, 100);
    assert.equal(rows[0].output, 50);
    assert.equal(rows[0].cacheRead, 10);
    assert.equal(rows[0].cacheWrite, 0);
  } finally {
    try { fs.unlinkSync(tmpDb); } catch (_) {}
  }
});

test('collectOmniRouteRows parses call_logs rows and skips zero-token entries', () => {
  const tmpDb = path.join(tmpdir(), `omni-route-calls-${Date.now()}.sqlite`);
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(tmpDb);
    db.exec(`
      CREATE TABLE call_logs (
        id INTEGER PRIMARY KEY,
        provider TEXT,
        model TEXT,
        tokens_in INTEGER,
        tokens_out INTEGER,
        tokens_cache_read INTEGER,
        tokens_cache_creation INTEGER,
        timestamp TEXT,
        duration INTEGER
      );
    `);
    const now = new Date().toISOString().split('T')[0];
    // Valid call
    db.prepare(
      'INSERT INTO call_logs (provider, model, tokens_in, tokens_out, tokens_cache_read, tokens_cache_creation, timestamp, duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run('anthropic', 'claude-3.5-sonnet', 200, 100, 20, 5, `${now}T13:00:00.000Z`, 500);
    // Zero-token entry (should be skipped)
    db.prepare(
      'INSERT INTO call_logs (provider, model, tokens_in, tokens_out, tokens_cache_read, tokens_cache_creation, timestamp, duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run('test', 'test-model', 0, 0, 0, 0, `${now}T13:01:00.000Z`, 0);
    db.close();

    const rows = collectOmniRouteRows({ dbPath: tmpDb });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].provider, 'anthropic');
    assert.equal(rows[0].input, 200);
    assert.equal(rows[0].performance.timedDurationMs, 500);
  } finally {
    try { fs.unlinkSync(tmpDb); } catch (_) {}
  }
});

test('dbExists returns true for existing DB, false for missing', () => {
  const existing = path.join(tmpdir(), `omni-route-exists-${Date.now()}.sqlite`);
  fs.writeFileSync(existing, '');
  assert.equal(dbExists(existing), true);
  assert.equal(dbExists(path.join(tmpdir(), 'nonexistent-db.sqlite')), false);
  try { fs.unlinkSync(existing); } catch (_) {}
});

test('buildOmniRoutePeriods aggregates by provider+model', () => {
  const tmpDb = path.join(tmpdir(), `omni-route-aggregate-${Date.now()}.sqlite`);
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(tmpDb);
    db.exec(`
      CREATE TABLE usage_history (
        id INTEGER PRIMARY KEY,
        provider TEXT,
        model TEXT,
        tokens_input INTEGER,
        tokens_output INTEGER,
        tokens_cache_read INTEGER,
        tokens_cache_creation INTEGER,
        timestamp TEXT
      );
    `);
    const now = new Date().toISOString().split('T')[0];
    db.prepare(
      'INSERT INTO usage_history (provider, model, tokens_input, tokens_output, tokens_cache_read, tokens_cache_creation, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('openai', 'gpt-4o', 100, 50, 0, 0, `${now}T10:00:00.000Z`);
    db.prepare(
      'INSERT INTO usage_history (provider, model, tokens_input, tokens_output, tokens_cache_read, tokens_cache_creation, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('openai', 'gpt-4o', 200, 100, 10, 0, `${now}T11:00:00.000Z`);
    db.prepare(
      'INSERT INTO usage_history (provider, model, tokens_input, tokens_output, tokens_cache_read, tokens_cache_creation, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('anthropic', 'claude-3.5-sonnet', 50, 25, 0, 0, `${now}T12:00:00.000Z`);
    db.close();

    const periods = buildOmniRoutePeriods({ dbPath: tmpDb });
    const today = periods.today;
    assert.equal(today.totalInput, 350);
    assert.equal(today.totalOutput, 175);
    assert.equal(today.totalCacheRead, 10);
    assert.equal(today.entries.length, 2);

    const models = today.entries.map((e) => e.model);
    assert.ok(models.includes('gpt-4o'));
    assert.ok(models.includes('claude-3.5-sonnet'));
  } finally {
    try { fs.unlinkSync(tmpDb); } catch (_) {}
  }
});
