'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const OMNIRITE_DB_PATH = path.join(os.homedir(), '.omniroute', 'storage.sqlite');

function localTodayKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function timestampMs(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

function dbExists(dbPath = OMNIRITE_DB_PATH) {
  try {
    return fs.statSync(dbPath).isFile();
  } catch (_) {
    return false;
  }
}

/**
 * Collect OmniRoute usage rows from the SQLite database.
 * Returns rows in a format compatible with extractUsageFromTokscale().
 */
function collectOmniRouteRows(options = {}) {
  const dbPath = options.dbPath || OMNIRITE_DB_PATH;
  if (!dbExists(dbPath)) return [];

  let db;
  try {
    db = new DatabaseSync(`file:${dbPath}?mode=ro`, { strict: false });
  } catch (_) {
    return [];
  }

  const rows = [];
  try {
    const now = options.now ? new Date(options.now) : new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    ).toISOString();

    // Query usage_history for today
    try {
      const historyStmt = db.prepare(
        'SELECT provider, model, tokens_input, tokens_output, tokens_cache_read, tokens_cache_creation, timestamp FROM usage_history WHERE timestamp >= ? ORDER BY timestamp ASC'
      );
      const historyRows = historyStmt.all(todayStart);
      for (const row of historyRows) {
        rows.push({
          client: 'omniroute',
          model: String(row.model || 'unknown'),
          provider: String(row.provider || 'unknown'),
          input: Number(row.tokens_input) || 0,
          output: Number(row.tokens_output) || 0,
          cacheRead: Number(row.tokens_cache_read) || 0,
          cacheWrite: Number(row.tokens_cache_creation) || 0,
          reasoning: 0,
          messageCount: 1,
          cost: 0,
          startedAt: row.timestamp || '',
          lastUsedAt: row.timestamp || '',
          performance: null
        });
      }
    } catch (_) {
      // usage_history table may not exist; continue to call_logs
    }

    // Also query call_logs for today (skipping zero-token entries like connection tests)
    try {
      const callStmt = db.prepare(
        'SELECT provider, model, tokens_in, tokens_out, tokens_cache_read, tokens_cache_creation, timestamp, duration FROM call_logs WHERE timestamp >= ? ORDER BY timestamp ASC'
      );
      const callRows = callStmt.all(todayStart);
      for (const row of callRows) {
        const tokensIn = Number(row.tokens_in) || 0;
        const tokensOut = Number(row.tokens_out) || 0;
        // Skip rows with zero tokens (connection tests, errors)
        if (!tokensIn && !tokensOut) continue;

        rows.push({
          client: 'omniroute',
          model: String(row.model || 'unknown'),
          provider: String(row.provider || 'unknown'),
          input: tokensIn,
          output: tokensOut,
          cacheRead: Number(row.tokens_cache_read) || 0,
          cacheWrite: Number(row.tokens_cache_creation) || 0,
          reasoning: 0,
          messageCount: 1,
          cost: 0,
          startedAt: row.timestamp || '',
          lastUsedAt: row.timestamp || '',
          performance: Number(row.duration) > 0 ? { timedDurationMs: Number(row.duration) } : null
        });
      }
    } catch (_) {
      // call_logs table may not exist; continue with whatever rows were collected
    }
  } catch (_) {
    // Silently fail if DB read errors
  } finally {
    try { db.close(); } catch (_) {}
  }

  return rows;
}

/**
 * Build a tokscale-compatible JSON object from OmniRoute usage data.
 * Compatible with extractUsageFromTokscale().
 */
function buildOmniRouteJson(windows = {}, options = {}) {
  const rows = collectOmniRouteRows(options);
  const sinceMs = Math.max(
    0,
    timestampMs(windows.todayStart),
    timestampMs(windows.monthStart),
    timestampMs(windows.allTimeSince)
  );

  const entries = [];
  let allInput = 0, allOutput = 0, allCacheRead = 0, allCacheWrite = 0, allMessages = 0, allCost = 0;

  // Aggregate by provider+model
  const byProviderModel = new Map();
  for (const row of rows) {
    if (sinceMs && row.startedAt) {
      const ts = timestampMs(row.startedAt);
      if (ts < sinceMs) continue;
    }
    const key = `${row.provider}\u0000${row.model}`;
    if (!byProviderModel.has(key)) {
      byProviderModel.set(key, {
        provider: row.provider,
        model: row.model,
        input: 0, output: 0, cacheRead: 0, cacheWrite: 0,
        messages: 0, cost: 0, startedAt: 0, lastUsedAt: 0
      });
    }
    const agg = byProviderModel.get(key);
    agg.input += row.input;
    agg.output += row.output;
    agg.cacheRead += row.cacheRead;
    agg.cacheWrite += row.cacheWrite;
    agg.messages += row.messageCount || 1;
    agg.cost += row.cost || 0;

    const started = timestampMs(row.startedAt);
    if (started && (!agg.startedAt || started < agg.startedAt)) agg.startedAt = started;
    const lastUsed = timestampMs(row.lastUsedAt);
    if (lastUsed > agg.lastUsedAt) agg.lastUsedAt = lastUsed;
  }

  for (const agg of byProviderModel.values()) {
    entries.push({
      client: 'omniroute',
      mergedClients: null,
      sessionId: `omniroute-${agg.provider}-${agg.model}`,
      model: agg.model,
      provider: agg.provider,
      input: agg.input,
      output: agg.output,
      cacheRead: agg.cacheRead,
      cacheWrite: agg.cacheWrite,
      reasoning: 0,
      messageCount: agg.messages,
      cost: agg.cost,
      startedAt: agg.startedAt ? new Date(agg.startedAt).toISOString() : '',
      lastUsedAt: agg.lastUsedAt ? new Date(agg.lastUsedAt).toISOString() : '',
      performance: null
    });

    allInput += agg.input;
    allOutput += agg.output;
    allCacheRead += agg.cacheRead;
    allCacheWrite += agg.cacheWrite;
    allMessages += agg.messages;
    allCost += agg.cost;
  }

  return {
    groupBy: 'client,session,model',
    entries,
    totalInput: allInput,
    totalOutput: allOutput,
    totalCacheRead: allCacheRead,
    totalCacheWrite: allCacheWrite,
    totalMessages: allMessages,
    totalCost: allCost,
    processingTimeMs: 0
  };
}

/**
 * Build tokscale-compatible periods for today, month, allTime.
 */
function buildOmniRoutePeriods(options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();

  return {
    today: buildOmniRouteJson({ todayStart }, options),
    month: buildOmniRouteJson({ monthStart }, options),
    allTime: buildOmniRouteJson({ allTimeSince: options.allTimeSince }, options)
  };
}

/**
 * Build graph-compatible contributions for history display.
 */
function buildOmniRouteHistoryGraph(options = {}) {
  const rows = collectOmniRouteRows({ ...options, allTimeSince: 0 });
  const byDate = new Map();

  for (const row of rows) {
    const date = row.startedAt ? localTodayKey(new Date(row.startedAt)) : '';
    if (!date) continue;

    let day = byDate.get(date);
    if (!day) {
      day = { date, clients: [] };
      byDate.set(date, day);
    }

    let client = day.clients.find((c) => c.modelId === row.model);
    if (!client) {
      client = {
        client: 'omniroute',
        modelId: row.model,
        tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 },
        cost: 0,
        messages: 0
      };
      day.clients.push(client);
    }

    client.tokens.input += row.input;
    client.tokens.output += row.output;
    client.tokens.cacheRead += row.cacheRead;
    client.tokens.cacheWrite += row.cacheWrite;
    client.cost += row.cost || 0;
    client.messages += row.messageCount || 1;
  }

  return { contributions: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}

module.exports = {
  OMNIRITE_DB_PATH,
  collectOmniRouteRows,
  buildOmniRouteJson,
  buildOmniRoutePeriods,
  buildOmniRouteHistoryGraph,
  dbExists
};
