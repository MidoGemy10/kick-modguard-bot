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
      { name: 'الخامل', value: formatDuration(idle), inline: true }
    ));
}


function safeValue(value, fallback = 'غير معروف', max = 900) {
  const text = value === undefined || value === null || value === '' ? fallback : String(value);
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function unix(iso) {
  if (!iso) return Math.floor(Date.now() / 1000);
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? Math.floor(Date.now() / 1000) : Math.floor(date.getTime() / 1000);
}

async function logModerationAction({ mod = null, details = {}, content = null, resultReason = null }) {
  const isTimeout = details.kind === 'timeout' || details.type === 'moderation_timeout';
  const title = isTimeout ? '⏱️ تايم أوت من مود Kick' : '🔨 بان من مود Kick';
  const color = isTimeout ? 0xf59e0b : 0xef4444;

  const moderatorDiscord = mod?.discord_id ? `<@${mod.discord_id}>` : 'غير مربوط بديسكورد';
  const moderatorKick = safeValue(details.moderatorUsername || mod?.kick_username);
  const target = safeValue(details.targetUsername);
  const reason = safeValue(details.reason, 'غير مذكور');
  const duration = isTimeout ? safeValue(details.durationText, 'غير محددة') : 'دائم';
  const createdTs = unix(details.createdAt);

  const status = resultReason
    ? `اتسجل في اللوج فقط — ${safeValue(resultReason, 'غير معروف', 500)}`
    : 'تم تسجيله كنشاط للمود';

  const embed = baseEmbed(title, color)
    .addFields(
      { name: 'مود Discord', value: moderatorDiscord, inline: true },
      { name: 'مود Kick', value: moderatorKick, inline: true },
      { name: 'الإجراء', value: details.actionText || (isTimeout ? 'تايم أوت' : 'بان'), inline: true },
      { name: 'على المستخدم', value: target, inline: true },
      { name: 'المدة', value: duration, inline: true },
      { name: 'وقت الإجراء', value: `<t:${createdTs}:f>\n<t:${createdTs}:R>`, inline: true },
      { name: 'السبب', value: reason, inline: false },
      { name: 'الحالة', value: status, inline: false }
    );

  const footerParts = [];
  if (details.moderatorUserId) footerParts.push(`Mod ID: ${details.moderatorUserId}`);
  if (details.targetUserId) footerParts.push(`Target ID: ${details.targetUserId}`);
  if (footerParts.length) embed.setFooter({ text: footerParts.join(' • ') });

  if (content && !details.summary) {
    embed.addFields({ name: 'تفاصيل', value: safeValue(content, 'لا يوجد'), inline: false });
  }

  await sendLog(embed);
}

async function logActivity({ mod, type, content, details = null }) {
  if (!String(type || '').startsWith('moderation_')) return;
  await logModerationAction({ mod, details: details || { type, summary: content, actionText: 'مودريشن' }, content });
}

module.exports = { setClient, sendLog, baseEmbed, logShiftStart, logShiftClosed, logActivity, logModerationAction };
