function pickFirst(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function findDeep(obj, keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  const wanted = new Set(keys.map((k) => String(k).toLowerCase()));
  const queue = [obj];
  const seen = new Set();

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);

    for (const [key, value] of Object.entries(current)) {
      if (wanted.has(String(key).toLowerCase()) && value !== undefined && value !== null && value !== '') {
        return value;
      }
      if (value && typeof value === 'object') queue.push(value);
    }
  }

  return undefined;
}

function toIso(value) {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function secondsToText(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  if (!seconds) return null;

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days) parts.push(`${days} يوم`);
  if (hours) parts.push(`${hours} ساعة`);
  if (minutes) parts.push(`${minutes} دقيقة`);
  if (!parts.length) parts.push(`${seconds} ثانية`);
  return parts.join(' و ');
}

function minutesToText(minutes) {
  const n = Number(minutes);
  if (!Number.isFinite(n) || n <= 0) return null;
  return secondsToText(n * 60);
}

function parseDurationSeconds(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseModerationAction(payload = {}) {
  const metadata = payload.metadata || {};
  const moderator = payload.moderator || payload.created_by || payload.banned_by || payload.mod || {};
  const target = payload.banned_user || payload.user || payload.target_user || payload.target || {};

  const moderatorUserId = pickFirst(moderator.user_id, moderator.id, metadata.moderator_user_id, findDeep(payload, ['moderator_user_id']));
  const moderatorUsername = pickFirst(moderator.username, moderator.name, metadata.moderator_username, findDeep(payload, ['moderator_username']));

  const targetUserId = pickFirst(target.user_id, target.id, metadata.banned_user_id, metadata.target_user_id, findDeep(payload, ['banned_user_id', 'target_user_id']));
  const targetUsername = pickFirst(target.username, target.name, metadata.banned_username, metadata.target_username, findDeep(payload, ['banned_username', 'target_username'])) || 'غير معروف';

  const reason = pickFirst(payload.reason, metadata.reason, payload.ban?.reason, findDeep(payload, ['reason'])) || 'غير مذكور';
  const createdAt = toIso(pickFirst(payload.created_at, metadata.created_at, payload.ban?.created_at, findDeep(payload, ['created_at'])));

  const expiresAtRaw = pickFirst(
    payload.expires_at,
    payload.expired_at,
    payload.ends_at,
    payload.until,
    payload.banned_until,
    metadata.expires_at,
    metadata.expired_at,
    metadata.ends_at,
    metadata.until,
    metadata.banned_until,
    payload.ban?.expires_at,
    payload.ban?.expired_at,
    findDeep(payload, ['expires_at', 'expired_at', 'ends_at', 'until', 'banned_until'])
  );

  const durationSeconds = parseDurationSeconds(pickFirst(
    payload.duration_seconds,
    payload.duration,
    metadata.duration_seconds,
    metadata.duration,
    payload.ban?.duration_seconds,
    findDeep(payload, ['duration_seconds'])
  ));

  const durationMinutes = parseDurationSeconds(pickFirst(
    payload.duration_minutes,
    payload.minutes,
    metadata.duration_minutes,
    metadata.minutes,
    payload.ban?.duration_minutes,
    findDeep(payload, ['duration_minutes', 'minutes'])
  ));

  const permanentValue = pickFirst(
    payload.permanent,
    payload.is_permanent,
    metadata.permanent,
    metadata.is_permanent,
    payload.ban?.permanent,
    payload.ban?.is_permanent,
    findDeep(payload, ['permanent', 'is_permanent'])
  );

  let expiresAt = null;
  if (expiresAtRaw) {
    const date = new Date(expiresAtRaw);
    if (!Number.isNaN(date.getTime())) expiresAt = date.toISOString();
  }

  const hasTimeoutSignals = Boolean(expiresAt || durationSeconds || durationMinutes);
  const isPermanent = permanentValue === true || String(permanentValue).toLowerCase() === 'true' || String(permanentValue) === '1';
  const isTimeout = hasTimeoutSignals && !isPermanent;

  let durationText = null;
  if (durationSeconds) durationText = secondsToText(durationSeconds);
  if (!durationText && durationMinutes) durationText = minutesToText(durationMinutes);
  if (!durationText && expiresAt) {
    const diffSeconds = Math.round((new Date(expiresAt).getTime() - new Date(createdAt).getTime()) / 1000);
    durationText = diffSeconds > 0 ? secondsToText(diffSeconds) : `حتى <t:${Math.floor(new Date(expiresAt).getTime() / 1000)}:f>`;
  }

  const kind = isTimeout ? 'timeout' : 'ban';
  const actionText = isTimeout ? 'تايم أوت' : 'بان';
  const type = isTimeout ? 'moderation_timeout' : 'moderation_ban';
  const summary = `${actionText}: ${targetUsername}${isTimeout && durationText ? ` | المدة: ${durationText}` : ''}${reason && reason !== 'غير مذكور' ? ` | السبب: ${reason}` : ''}`;

  return {
    kind,
    type,
    actionText,
    summary,
    moderatorUserId: moderatorUserId ? String(moderatorUserId) : null,
    moderatorUsername: moderatorUsername ? String(moderatorUsername) : null,
    targetUserId: targetUserId ? String(targetUserId) : null,
    targetUsername: String(targetUsername),
    reason: String(reason),
    durationText,
    expiresAt,
    createdAt,
    rawEvent: 'moderation.banned'
  };
}

module.exports = { parseModerationAction };
