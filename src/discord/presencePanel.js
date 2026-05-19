const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const db = require('../db');
const { diffMinutes, formatDuration } = require('../utils/time');

let clientRef = null;

function setClient(client) {
  clientRef = client;
}

function streamState() {
  return db.prepare('SELECT * FROM stream_state WHERE id = 1').get();
}

function getPresenceRows() {
  return db.prepare(`
    SELECT
      m.id,
      m.discord_id,
      m.kick_username,
      m.last_activity_at,
      m.last_activity_type,
      s.id AS shift_id,
      s.started_at AS shift_started_at,
      s.last_activity_at AS shift_last_activity_at
    FROM mods m
    LEFT JOIN shifts s ON s.mod_id = m.id AND s.status = 'open'
    WHERE m.active = 1
  `).all();
}

function statusForRow(row, liveNow) {
  if (!liveNow) {
    return { icon: '⚫', label: 'اللايف أوفلاين', minutes: row.last_activity_at ? diffMinutes(new Date(), row.last_activity_at) : null, rank: 5 };
  }

  if (!row.last_activity_at) {
    return { icon: '🔴', label: 'غير موجود', minutes: null, rank: 4 };
  }

  const minutes = diffMinutes(new Date(), row.last_activity_at);
  if (minutes <= config.presenceActiveMinutes) {
    return row.shift_id
      ? { icon: '🟢', label: 'موجود', minutes, rank: 1 }
      : { icon: '🔵', label: 'متفاعل بدون شيفت', minutes, rank: 2 };
  }

  if (row.shift_id) {
    return { icon: '🟡', label: 'شيفت مفتوح بدون تفاعل', minutes, rank: 3 };
  }

  return { icon: '🔴', label: 'غير موجود', minutes, rank: 4 };
}

function timeAgo(minutes) {
  if (minutes === null || minutes === undefined) return 'لا يوجد';
  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `منذ ${minutes} د`;
  return `منذ ${formatDuration(minutes)}`;
}

function unix(iso) {
  if (!iso) return Math.floor(Date.now() / 1000);
  return Math.floor(new Date(iso).getTime() / 1000);
}

function getSortedRows(liveNow) {
  return getPresenceRows()
    .map((row) => ({ ...row, presence: statusForRow(row, liveNow) }))
    .sort((a, b) => {
      if (a.presence.rank !== b.presence.rank) return a.presence.rank - b.presence.rank;
      const aTime = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
      const bTime = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      return String(a.kick_username).localeCompare(String(b.kick_username), 'ar');
    });
}

function buildLiveEmbed() {
  const state = streamState();
  const rows = getSortedRows(true);

  const active = rows.filter((r) => ['موجود', 'متفاعل بدون شيفت'].includes(r.presence.label)).length;
  const openShifts = rows.filter((r) => r.shift_id).length;
  const missing = rows.filter((r) => r.presence.label === 'غير موجود').length;
  const weak = rows.filter((r) => r.presence.label === 'شيفت مفتوح بدون تفاعل').length;

  const startedLine = state?.started_at
    ? `بدأ اللايف: <t:${unix(state.started_at)}:R>`
    : 'بدأ اللايف: غير معروف';

  const lines = rows.length ? rows.map((r, index) => {
    const shiftText = r.shift_id && r.shift_started_at
      ? `الشيفت: ${formatDuration(diffMinutes(new Date(), r.shift_started_at))}`
      : 'الشيفت: مقفول';

    return `**${index + 1}.** ${r.presence.icon} <@${r.discord_id}> | Kick: \`${r.kick_username}\`\n` +
      `الحالة: **${r.presence.label}** | آخر تفاعل: ${timeAgo(r.presence.minutes)} | ${shiftText}`;
  }) : ['لا يوجد مودات متضافة في النظام.'];

  return new EmbedBuilder()
    .setTitle('🟢 لوحة وجود مودات Kick')
    .setColor(0x22c55e)
    .setDescription(lines.join('\n\n').slice(0, 3900))
    .addFields(
      { name: 'حالة اللايف', value: '🟢 اللايف شغال', inline: true },
      { name: 'الموجودين', value: String(active), inline: true },
      { name: 'الشيفتات المفتوحة', value: String(openShifts), inline: true },
      { name: 'بدون تفاعل', value: String(weak), inline: true },
      { name: 'غير موجودين', value: String(missing), inline: true },
      { name: 'حد الوجود', value: `${config.presenceActiveMinutes} دقيقة`, inline: true },
      { name: 'معلومة', value: `${startedLine}\nاللوحة تتحدث تلقائيًا كل دقيقة.` }
    )
    .setFooter({ text: 'Kick ModGuard • Presence Panel' })
    .setTimestamp(new Date());
}

function buildOfflineEmbed(reason = 'اللايف أوفلاين') {
  const state = streamState();
  const rows = getSortedRows(false);
  const endedLine = state?.ended_at
    ? `آخر إغلاق: <t:${unix(state.ended_at)}:R>`
    : 'آخر إغلاق: غير معروف';

  const lines = rows.length ? rows.map((r, index) => {
    const last = r.last_activity_at ? timeAgo(diffMinutes(new Date(), r.last_activity_at)) : 'لا يوجد';
    return `**${index + 1}.** ⚫ <@${r.discord_id}> | Kick: \`${r.kick_username}\`\n` +
      `الحالة: **متوقف لأن اللايف أوفلاين** | آخر تفاعل: ${last}`;
  }) : ['لا يوجد مودات متضافة في النظام.'];

  return new EmbedBuilder()
    .setTitle('🔴 لوحة وجود مودات Kick')
    .setColor(0xef4444)
    .setDescription(lines.join('\n\n').slice(0, 3900))
    .addFields(
      { name: 'حالة اللايف', value: '🔴 اللايف أوفلاين', inline: true },
      { name: 'المودات المسجلة', value: String(rows.length), inline: true },
      { name: 'التحديث', value: `كل ${config.presenceUpdateSeconds} ثانية`, inline: true },
      { name: 'معلومة', value: `${reason}\n${endedLine}\nأول ما اللايف يشتغل، نفس اللوحة هتتحول للأخضر وترتب المودات حسب الوجود والتفاعل.` }
    )
    .setFooter({ text: 'Kick ModGuard • Presence Panel' })
    .setTimestamp(new Date());
}

function buildPresenceEmbed() {
  const state = streamState();
  return state?.is_live ? buildLiveEmbed() : buildOfflineEmbed('اللايف غير شغال حاليًا');
}

async function getPanelChannel() {
  if (!clientRef || !config.presenceChannelId) return null;
  const channel = await clientRef.channels.fetch(config.presenceChannelId).catch(() => null);
  if (!channel || !channel.isTextBased?.()) return null;
  return channel;
}

async function savePanelMessage(message) {
  db.prepare(`
    UPDATE stream_state
    SET panel_message_id = ?, panel_channel_id = ?, panel_created_at = COALESCE(panel_created_at, ?)
    WHERE id = 1
  `).run(message.id, message.channel.id, new Date().toISOString());
}

async function updatePresencePanel(reason = null) {
  const channel = await getPanelChannel();
  if (!channel) return { ok: false, reason: 'presence channel not found' };

  const state = streamState();
  const embed = state?.is_live ? buildLiveEmbed() : buildOfflineEmbed(reason || 'اللايف غير شغال حاليًا');

  if (state?.panel_message_id) {
    const oldChannel = state.panel_channel_id
      ? await clientRef.channels.fetch(state.panel_channel_id).catch(() => channel)
      : channel;
    const message = await oldChannel.messages.fetch(state.panel_message_id).catch(() => null);
    if (message) {
      await message.edit({ embeds: [embed] });
      return { ok: true, edited: true, live: Boolean(state?.is_live) };
    }
  }

  const message = await channel.send({ embeds: [embed] });
  await savePanelMessage(message);
  return { ok: true, created: true, live: Boolean(state?.is_live) };
}

async function handleStreamStatusChanged(isLiveNow) {
  return updatePresencePanel(isLiveNow ? 'بدأ اللايف على Kick' : 'اللايف أوفلاين');
}

module.exports = {
  setClient,
  updatePresencePanel,
  handleStreamStatusChanged,
  buildPresenceEmbed,
  buildLiveEmbed,
  buildOfflineEmbed
};
