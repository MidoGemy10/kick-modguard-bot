const db = require('./db');
const config = require('./config');
const { nowIso, diffMinutes } = require('./utils/time');
const { isValidActivity, normalizeMessage } = require('./utils/activityFilter');
const logs = require('./discord/logs');

function getModByDiscord(discordId) {
  return db.prepare('SELECT * FROM mods WHERE discord_id = ? AND active = 1').get(String(discordId));
}

function getModByKickUserId(kickUserId) {
  return db.prepare('SELECT * FROM mods WHERE kick_user_id = ? AND active = 1').get(String(kickUserId));
}

function getModByKickUsername(username) {
  return db.prepare('SELECT * FROM mods WHERE lower(kick_username) = lower(?) AND active = 1').get(String(username));
}

function upsertKickUserId(modId, kickUserId) {
  db.prepare('UPDATE mods SET kick_user_id = ? WHERE id = ? AND (kick_user_id IS NULL OR kick_user_id = ?)')
    .run(String(kickUserId), modId, String(kickUserId));
}

function touchModActivity(modId, eventTime, type) {
  db.prepare('UPDATE mods SET last_activity_at = ?, last_activity_type = ? WHERE id = ?')
    .run(eventTime, type, modId);
}

function addMod({ discordId, kickUsername, kickUserId = null }) {
  const stmt = db.prepare(`
    INSERT INTO mods (discord_id, kick_user_id, kick_username, active)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(discord_id) DO UPDATE SET
      kick_user_id = excluded.kick_user_id,
      kick_username = excluded.kick_username,
      active = 1
  `);

  stmt.run(
    String(discordId),
    kickUserId ? String(kickUserId) : null,
    String(kickUsername)
  );

  return getModByDiscord(discordId);
}

function removeMod(discordId) {
  return db.prepare('UPDATE mods SET active = 0 WHERE discord_id = ?').run(String(discordId));
}

function getOpenShift(modId) {
  return db.prepare(
    'SELECT * FROM shifts WHERE mod_id = ? AND status = ? ORDER BY id DESC LIMIT 1'
  ).get(modId, 'open');
}

async function startShiftForMod(mod) {
  const open = getOpenShift(mod.id);

  if (open) {
    return {
      alreadyOpen: true,
      shift: open
    };
  }

  const now = nowIso();

  const info = db.prepare(`
    INSERT INTO shifts (mod_id, started_at, last_activity_at, status)
    VALUES (?, ?, ?, 'open')
  `).run(mod.id, now, now);

  touchModActivity(mod.id, now, 'shift_start');

  const shift = db
    .prepare('SELECT * FROM shifts WHERE id = ?')
    .get(info.lastInsertRowid);

  await logs.logShiftStart({ mod, shift });

  return {
    alreadyOpen: false,
    shift
  };
}

async function startShiftByDiscord(discordId) {
  const mod = getModByDiscord(discordId);

  if (!mod) {
    return {
      ok: false,
      reason: 'المود مش متضاف في النظام.'
    };
  }

  if (config.countOnlyWhenLive && !isStreamLive()) {
    return {
      ok: false,
      reason: 'القناة ليست Live الآن، والتسجيل وقت الأوفلاين مقفول.'
    };
  }

  const result = await startShiftForMod(mod);

  return {
    ok: true,
    mod,
    ...result
  };
}

function computeShiftMinutes(shift, closedAtIso = nowIso()) {
  const total = diffMinutes(closedAtIso, shift.started_at);

  return {
    total,
    idle: 0,
    active: total
  };
}

async function closeShift(shiftId, reason = 'مغلق يدويًا') {
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shiftId);

  if (!shift || shift.status !== 'open') {
    return null;
  }

  const endedAt = nowIso();
  const minutes = computeShiftMinutes(shift, endedAt);

  db.prepare(`
    UPDATE shifts
    SET ended_at = ?,
        status = 'closed',
        close_reason = ?,
        total_minutes = ?,
        active_minutes = ?,
        idle_minutes = ?
    WHERE id = ?
  `).run(
    endedAt,
    reason,
    minutes.total,
    minutes.active,
    minutes.idle,
    shiftId
  );

  const closed = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shiftId);
  const mod = db.prepare('SELECT * FROM mods WHERE id = ?').get(shift.mod_id);

  await logs.logShiftClosed({
    mod,
    shift: closed,
    reason
  });

  return closed;
}

async function closeShiftByDiscord(discordId, reason = 'خروج يدوي') {
  const mod = getModByDiscord(discordId);

  if (!mod) {
    return {
      ok: false,
      reason: 'المود مش متضاف في النظام.'
    };
  }

  const shift = getOpenShift(mod.id);

  if (!shift) {
    return {
      ok: false,
      reason: 'لا يوجد شيفت مفتوح لهذا المود.'
    };
  }

  const closed = await closeShift(shift.id, reason);

  return {
    ok: true,
    mod,
    shift: closed
  };
}

function isStreamLive() {
  const state = db.prepare('SELECT * FROM stream_state WHERE id = 1').get();
  return Boolean(state?.is_live);
}

async function updateStreamState(payload) {
  const isLive = payload.is_live ? 1 : 0;

  db.prepare(`
    UPDATE stream_state
    SET is_live = ?,
        title = ?,
        started_at = ?,
        ended_at = ?,
        last_event_at = ?
    WHERE id = 1
  `).run(
    isLive,
    payload.title || null,
    payload.started_at || null,
    payload.ended_at || null,
    nowIso()
  );

  if (!isLive && config.closeShiftWhenStreamEnds) {
    await closeAllOpenShifts('انتهى اللايف على Kick');
  }
}

async function closeAllOpenShifts(reason) {
  const shifts = db.prepare(
    'SELECT * FROM shifts WHERE status = ?'
  ).all('open');

  for (const shift of shifts) {
    await closeShift(shift.id, reason);
  }
}

async function recordActivityForKickUser({
  kickUserId,
  kickUsername,
  type,
  content,
  createdAt,
  requireValidChat = true,
  logDetails = null
}) {
  let mod = getModByKickUserId(kickUserId);

  if (!mod && kickUsername) {
    mod = getModByKickUsername(kickUsername);

    if (mod) {
      upsertKickUserId(mod.id, kickUserId);
      mod = getModByKickUserId(kickUserId) || mod;
    }
  }

  if (!mod) {
    return {
      ok: false,
      reason: 'اليوزر مش مربوط بأي مود.'
    };
  }

  if (config.countOnlyWhenLive && !isStreamLive()) {
    return {
      ok: false,
      reason: 'القناة ليست Live.'
    };
  }

  let storedContent = content || type;

  if (type === 'chat_message' && requireValidChat) {
    const check = isValidActivity(content, mod.id);

    if (!check.ok) {
      return {
        ok: false,
        reason: check.reason
      };
    }

    storedContent = check.normalized;
  }

  const eventTime = createdAt
    ? new Date(createdAt).toISOString()
    : nowIso();

  touchModActivity(mod.id, eventTime, type);

  const shift = getOpenShift(mod.id);

  if (shift) {
    db.prepare(`
      INSERT INTO mod_activity
      (shift_id, mod_id, type, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      shift.id,
      mod.id,
      type,
      normalizeMessage(storedContent),
      eventTime
    );

    db.prepare(
      'UPDATE shifts SET last_activity_at = ? WHERE id = ?'
    ).run(eventTime, shift.id);
  }

  await logs.logActivity({
    mod,
    type,
    content: storedContent,
    details: logDetails
  });

  return {
    ok: true,
    mod,
    shift: shift || null
  };
}

function markEventProcessed(messageId) {
  if (!messageId) return true;

  try {
    db.prepare(
      'INSERT INTO processed_events (message_id) VALUES (?)'
    ).run(String(messageId));

    return true;
  } catch {
    return false;
  }
}

function getReport(period = 'today') {
  let since;
  const now = new Date();

  if (period === 'week') {
    since = new Date(
      now.getTime() - 7 * 24 * 60 * 60000
    ).toISOString();
  } else if (period === 'month') {
    since = new Date(
      now.getTime() - 30 * 24 * 60 * 60000
    ).toISOString();
  } else {
    since = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).toISOString();
  }

  return db.prepare(`
    SELECT
      m.discord_id,
      m.kick_username,
      COUNT(s.id) AS shifts_count,
      COALESCE(SUM(s.total_minutes), 0) AS total_minutes,
      COALESCE(SUM(s.active_minutes), 0) AS active_minutes,
      COALESCE(SUM(s.idle_minutes), 0) AS idle_minutes,
      0 AS warnings
    FROM mods m
    LEFT JOIN shifts s
      ON s.mod_id = m.id
      AND s.started_at >= ?
      AND s.status = 'closed'
    WHERE m.active = 1
    GROUP BY m.id
    ORDER BY active_minutes DESC, total_minutes DESC
  `).all(since);
}

function processActivityCycle() {
  if (!isStreamLive()) return;

  const mods = db.prepare(
    'SELECT * FROM mods WHERE active = 1'
  ).all();

  const now = Date.now();

  for (const mod of mods) {
    if (!mod.last_activity_at) continue;

    const diff =
      now - new Date(mod.last_activity_at).getTime();

    if (diff <= 180000) {
      db.prepare(`
        INSERT INTO mod_scores
        (mod_id, points, active_minutes, messages_count)
        VALUES (?, 3, 3, 0)
        ON CONFLICT(mod_id)
        DO UPDATE SET
          points = points + 3,
          active_minutes = active_minutes + 3
      `).run(mod.id);
    }
  }
}

module.exports = {
  addMod,
  removeMod,
  getModByDiscord,
  getOpenShift,
  startShiftByDiscord,
  closeShiftByDiscord,
  closeShift,
  closeAllOpenShifts,
  recordActivityForKickUser,
  updateStreamState,
  markEventProcessed,
  getReport,
  isStreamLive,
  processActivityCycle
};
