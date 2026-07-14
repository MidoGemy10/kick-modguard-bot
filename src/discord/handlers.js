const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config');
const db = require('../db');
const shiftManager = require('../shiftManager');
const presencePanel = require('./presencePanel');
const { diffMinutes, formatDuration } = require('../utils/time');

function isAdmin(interaction) {
  if (!interaction.member) return false;
  if (interaction.member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (config.adminRoleId && interaction.member.roles?.cache?.has(config.adminRoleId)) return true;
  return false;
}

async function requireAdmin(interaction) {
  if (isAdmin(interaction)) return true;
  await interaction.reply({ content: '❌ الأمر ده للإدارة فقط.', ephemeral: true });
  return false;
}

function currentOpenShiftForDiscord(discordId) {
  const mod = shiftManager.getModByDiscord(discordId);
  if (!mod) return { mod: null, shift: null };
  const shift = shiftManager.getOpenShift(mod.id);
  return { mod, shift };
}

async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;

  const name = interaction.commandName;

  if (name === 'اضافة-مود') {
    if (!(await requireAdmin(interaction))) return;

    const user = interaction.options.getUser('عضو', true);
    const kickUsername = interaction.options
      .getString('يوزر_كيك', true)
      .replace('@', '')
      .trim();

    // التحقق إذا كان المود موجود بالفعل
    const existing = shiftManager.getModByDiscord(user.id);

    if (existing && existing.active) {
      return interaction.reply({
        content: `❌ <@${user.id}> موجود بالفعل في النظام.`,
        ephemeral: true
      });
    }

    const mod = shiftManager.addMod({
      discordId: user.id,
      kickUsername
    });

    return interaction.reply({
      content: `✅ تم إضافة <@${user.id}> وربطه بحساب Kick: **${mod.kick_username}**`,
      ephemeral: true
    });
  }

  if (name === 'حذف-مود') {
    if (!(await requireAdmin(interaction))) return;

    const user = interaction.options.getUser('عضو', true);

    const existing = shiftManager.getModByDiscord(user.id);

    if (!existing || !existing.active) {
      return interaction.reply({
        content: `❌ <@${user.id}> غير موجود في النظام.`,
        ephemeral: true
      });
    }

    shiftManager.removeMod(user.id);

    return interaction.reply({
      content: `✅ تم حذف <@${user.id}> من النظام.`,
      ephemeral: true
    });
  }

  if (name === 'دخول') {
    const result = await shiftManager.startShiftByDiscord(interaction.user.id);
    if (!result.ok) return interaction.reply({ content: `❌ ${result.reason}`, ephemeral: true });
    if (result.alreadyOpen) return interaction.reply({ content: '⚠️ عندك شيفت مفتوح بالفعل.', ephemeral: true });
    return interaction.reply({ content: `🟢 تم فتح شيفتك. ظهورك في لوحة المودات بيتحدث حسب تفاعلك في شات Kick.`, ephemeral: true });
  }

  if (name === 'خروج') {
    const result = await shiftManager.closeShiftByDiscord(interaction.user.id, 'خروج يدوي');
    if (!result.ok) return interaction.reply({ content: `❌ ${result.reason}`, ephemeral: true });
    return interaction.reply({ content: '✅ تم قفل شيفتك بنجاح.', ephemeral: true });
  }

  if (name === 'حالتي') {
    const { mod, shift } = currentOpenShiftForDiscord(interaction.user.id);
    if (!mod) return interaction.reply({ content: '❌ أنت مش متضاف كمود في النظام.', ephemeral: true });
    if (!shift) return interaction.reply({ content: '🔴 لا يوجد شيفت مفتوح لك الآن.', ephemeral: true });

    const sinceStart = diffMinutes(new Date(), shift.started_at);
    const sinceActivity = diffMinutes(new Date(), shift.last_activity_at);

    const embed = new EmbedBuilder()
      .setTitle('📌 حالة الشيفت')
      .setColor(0x22c55e)
      .addFields(
        { name: 'Kick', value: mod.kick_username, inline: true },
        { name: 'مدة الشيفت', value: formatDuration(sinceStart), inline: true },
        { name: 'آخر تفاعل', value: `منذ ${sinceActivity} دقيقة`, inline: true }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (name === 'تقرير-المودات') {
    if (!(await requireAdmin(interaction))) return;
    const period = interaction.options.getString('الفترة') || 'today';
    const rows = shiftManager.getReport(period);

    const title = period === 'week' ? 'آخر 7 أيام' : period === 'month' ? 'آخر 30 يوم' : 'اليوم';
    const lines = rows.length ? rows.map((r, i) => {
      return `**${i + 1}. <@${r.discord_id}>** | Kick: \`${r.kick_username}\`\n` +
        `النشط: **${formatDuration(r.active_minutes)}** | الإجمالي: ${formatDuration(r.total_minutes)} | الخامل: ${formatDuration(r.idle_minutes)}`;
    }) : ['لا يوجد بيانات.'];

    const embed = new EmbedBuilder()
      .setTitle(`📊 تقرير المودات - ${title}`)
      .setColor(0x3b82f6)
      .setDescription(lines.join('\n\n').slice(0, 3900))
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: false });
  }

  if (name === 'قفل-شيفت') {
    if (!(await requireAdmin(interaction))) return;
    const user = interaction.options.getUser('عضو', true);
    const reason = interaction.options.getString('السبب') || 'قفل يدوي من الإدارة';
    const result = await shiftManager.closeShiftByDiscord(user.id, reason);
    if (!result.ok) return interaction.reply({ content: `❌ ${result.reason}`, ephemeral: true });
    return interaction.reply({ content: `✅ تم قفل شيفت <@${user.id}>.`, ephemeral: true });
  }


  if (name === 'لوحة-المودات') {
    if (!(await requireAdmin(interaction))) return;
    await interaction.deferReply({ ephemeral: true });
    const result = await presencePanel.updatePresencePanel('تحديث يدوي من الإدارة');
    if (!result.ok) return interaction.editReply(`❌ لم يتم تحديث اللوحة: ${result.reason || 'سبب غير معروف'}`);
    const status = result.live ? '🟢 اللايف شغال' : '🔴 اللايف أوفلاين';
    return interaction.editReply(`${result.created ? '✅ تم إرسال لوحة المودات.' : '✅ تم تحديث لوحة المودات.'}
${status}`);
  }

  if (name === 'اعدادات-الحضور') {
    if (!(await requireAdmin(interaction))) return;
    const state = db.prepare('SELECT * FROM stream_state WHERE id = 1').get();
    const embed = new EmbedBuilder()
      .setTitle('⚙️ إعدادات حضور مودات Kick')
      .setColor(0xa855f7)
      .addFields(
        { name: 'حد الوجود في اللوحة', value: `${config.presenceActiveMinutes} دقيقة`, inline: true },
        { name: 'تحديث اللوحة', value: `كل ${config.presenceUpdateSeconds} ثانية`, inline: true },
        { name: 'قناة اللوحة', value: config.presenceChannelId ? `<#${config.presenceChannelId}>` : 'غير محددة', inline: true },
        { name: 'أقل طول رسالة', value: `${config.minMessageLength}`, inline: true },
        { name: 'فلتر التكرار', value: `${config.duplicateWindowMinutes} دقائق`, inline: true },
        { name: 'يحسب وقت اللايف فقط', value: config.countOnlyWhenLive ? 'نعم' : 'لا', inline: true },
        { name: 'قفل عند نهاية اللايف', value: config.closeShiftWhenStreamEnds ? 'نعم' : 'لا', inline: true },
        { name: 'حالة اللايف', value: state?.is_live ? '🟢 Live' : '🔴 Offline', inline: true },
        { name: 'ملاحظة', value: 'تم إلغاء نظام التحذيرات والقفل بسبب الخمول. اللوحة فقط بتوضح الموجودين وغير الموجودين.' }
      )
      .setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

module.exports = { handleInteraction };
