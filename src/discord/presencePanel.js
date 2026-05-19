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

function isLive() {
  return Boolean(streamState()?.is_live);
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
    ORDER BY
      CASE WHEN m.last_activity_at IS NULL THEN 1 ELSE 0 END,
      m.last_activity_at DESC,
      m.kick_username COLLATE NOCASE ASC
  `).all();
}

function statusForRow(row) {
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
  return Math.floor(new Date(iso).getTime() / 1000);
}

function buildPresenceEmbed() {
  const state = streamState();
  const rows = getPresenceRows().map((row) => ({ ...row, presence: statusForRow(row) }))
    .sort((a, b) => a.presence.rank - b.presence.rank || String(a.kick_username).localeCompare(String(b.kick_username)));

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
      { name: 'حالة اللايف', value: '🟢 Live', inline: true },
      { name: 'الموجودين', value: String(active), inline: true },
      { name: 'الشيفتات المفتوحة', value: String(openShifts), inline: true },
      { name: 'بدون تفاعل', value: String(weak), inline: true },
      { name: 'غير موجودين', value: String(missing), inline: true },
      { name: 'حد الوجود', value: `${config.presenceActiveMinutes} دقيقة`, inline: true },
      { name: 'معلومة', value: `${startedLine}\nاللوحة تتحدث تلقائيًا كل دقيقة وقت اللايف.` }
    )
    .setFooter({ text: 'Kick ModGuard • Presence Panel' })
    .setTimestamp(new Date());
}

function buildOfflineEmbed(reason = 'انتهى اللايف') {
  const state = streamState();
  const ended = state?.ended_at ? `<t:${unix(state.ended_at)}:f>` : `<t:${Math.floor(Date.now() / 1000)}:f>`;
  return new EmbedBuilder()
    .setTitle('🔴 لوحة وجود مودات Kick')
    .setColor(0xef4444)
    .setDescription(`${reason}\nتوقفت تحديثات اللوحة لأن اللايف غير شغال.`)
    .addFields({ name: 'وقت الإيقاف', value: ended, inline: true })
    .setTimestamp(new Date());
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

async function clearPanelMessage() {
  db.prepare(`
    UPDATE stream_state
    SET panel_message_id = NULL, panel_channel_id = NULL, panel_created_at = NULL
    WHERE id = 1
  `).run();
}

async function updatePresencePanel() {
  if (!isLive()) return { ok: false, reason: 'offline' };

  const channel = await getPanelChannel();
  if (!channel) return { ok: false, reason: 'presence channel not found' };

  const state = streamState();
  const embed = buildPresenceEmbed();

  if (state?.panel_message_id) {
    const oldChannel = state.panel_channel_id
      ? await clientRef.channels.fetch(state.panel_channel_id).catch(() => channel)
      : channel;
    const message = await oldChannel.messages.fetch(state.panel_message_id).catch(() => null);
    if (message) {
      await message.edit({ embeds: [embed] });
      return { ok: true, edited: true };
    }
  }

  const message = await channel.send({ embeds: [embed] });
  await savePanelMessage(message);
  return { ok: true, created: true };
}

async function finalizePresencePanel(reason = 'انتهى اللايف على Kick') {
  const state = streamState();
  if (!clientRef || !state?.panel_message_id) return { ok: false, reason: 'no panel' };

  const channel = state.panel_channel_id
    ? await clientRef.channels.fetch(state.panel_channel_id).catch(() => null)
    : await getPanelChannel();
  if (!channel) {
    await clearPanelMessage();
    return { ok: false, reason: 'channel not found' };
  }

  const message = await channel.messages.fetch(state.panel_message_id).catch(() => null);
  if (message) await message.edit({ embeds: [buildOfflineEmbed(reason)] }).catch(() => null);
  await clearPanelMessage();
  return { ok: true };
}

async function handleStreamStatusChanged(isLiveNow) {
  if (isLiveNow) return updatePresencePanel();
  return finalizePresencePanel('انتهى اللايف على Kick');
}

module.exports = {
  setClient,
  updatePresencePanel,
  finalizePresencePanel,
  handleStreamStatusChanged,
  buildPresenceEmbed
};
