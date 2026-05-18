const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const { formatDuration } = require('../utils/time');

let clientRef = null;

function setClient(client) {
  clientRef = client;
}

async function sendLog(embed) {
  if (!clientRef || !config.logChannelId) return;
  try {
    const channel = await clientRef.channels.fetch(config.logChannelId);
    if (!channel) return;
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('[LOG_CHANNEL_ERROR]', err.message);
  }
}

function baseEmbed(title, color = 0x2b2d31) {
  return new EmbedBuilder().setTitle(title).setColor(color).setTimestamp(new Date());
}

async function logShiftStart({ mod, shift }) {
  await sendLog(baseEmbed('🟢 تم فتح شيفت مود', 0x22c55e)
    .addFields(
      { name: 'المود', value: `<@${mod.discord_id}>`, inline: true },
      { name: 'Kick', value: mod.kick_username, inline: true },
      { name: 'بداية الشيفت', value: `<t:${Math.floor(new Date(shift.started_at).getTime() / 1000)}:f>`, inline: false }
    ));
}

async function logShiftClosed({ mod, shift, reason }) {
  const total = shift.total_minutes || 0;
  const idle = shift.idle_minutes || 0;
  const active = shift.active_minutes || Math.max(0, total - idle);
  await sendLog(baseEmbed('⛔ تم قفل شيفت مود', 0xef4444)
    .addFields(
      { name: 'المود', value: `<@${mod.discord_id}>`, inline: true },
      { name: 'Kick', value: mod.kick_username, inline: true },
      { name: 'السبب', value: reason || shift.close_reason || 'غير محدد', inline: false },
      { name: 'الإجمالي', value: formatDuration(total), inline: true },
      { name: 'النشط', value: formatDuration(active), inline: true },
      { name: 'الخامل', value: formatDuration(idle), inline: true },
      { name: 'التحذيرات', value: String(shift.warnings || 0), inline: true }
    ));
}

async function logWarning({ mod, shift, warningNumber, minutesSinceLastActivity }) {
  await sendLog(baseEmbed('⚠️ تحذير خمول مود', 0xf59e0b)
    .addFields(
      { name: 'المود', value: `<@${mod.discord_id}>`, inline: true },
      { name: 'Kick', value: mod.kick_username, inline: true },
      { name: 'التحذير', value: `${warningNumber} / ${config.maxWarnings}`, inline: true },
      { name: 'آخر تفاعل', value: `منذ ${minutesSinceLastActivity} دقيقة`, inline: true },
      { name: 'تنبيه', value: `لو وصل إلى ${config.maxWarnings} تحذيرات سيتم قفل الشيفت تلقائيًا.` }
    ));
}

async function logActivity({ mod, type, content }) {
  if (type !== 'moderation_banned') return;
  await sendLog(baseEmbed('🛡️ نشاط مودريشن من Kick', 0x3b82f6)
    .addFields(
      { name: 'المود', value: `<@${mod.discord_id}>`, inline: true },
      { name: 'Kick', value: mod.kick_username, inline: true },
      { name: 'النشاط', value: content || type, inline: false }
    ));
}

module.exports = { setClient, sendLog, baseEmbed, logShiftStart, logShiftClosed, logWarning, logActivity };
