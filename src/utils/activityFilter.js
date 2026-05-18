const db = require('../db');
const config = require('../config');

function normalizeMessage(content = '') {
  return String(content)
    .replace(/\[emote:[^\]]+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function stripEmojiAndSymbols(text) {
  return text
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .replace(/[\p{P}\p{S}\s]/gu, '')
    .trim();
}

function isValidActivity(content, modId) {
  const normalized = normalizeMessage(content);
  const meaningful = stripEmojiAndSymbols(normalized);

  if (meaningful.length < config.minMessageLength) {
    return { ok: false, reason: 'رسالة قصيرة أو إيموجي فقط' };
  }

  const since = new Date(Date.now() - config.duplicateWindowMinutes * 60000).toISOString();
  const duplicate = db.prepare(`
    SELECT id FROM mod_activity
    WHERE mod_id = ?
      AND type = 'chat_message'
      AND lower(trim(content)) = ?
      AND created_at >= ?
    LIMIT 1
  `).get(modId, normalized, since);

  if (duplicate) {
    return { ok: false, reason: 'رسالة مكررة' };
  }

  return { ok: true, normalized };
}

module.exports = { normalizeMessage, isValidActivity };
