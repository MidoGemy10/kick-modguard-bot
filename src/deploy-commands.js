require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('./config');

const commands = [
  new SlashCommandBuilder()
    .setName('اضافة-مود')
    .setDescription('إضافة مود إلى نظام حضور Kick')
    .addUserOption(o => o.setName('عضو').setDescription('عضو الديسكورد').setRequired(true))
    .addStringOption(o => o.setName('يوزر_كيك').setDescription('اسم مستخدم Kick بدون @').setRequired(true)),

  new SlashCommandBuilder()
    .setName('حذف-مود')
    .setDescription('حذف مود من نظام حضور Kick')
    .addUserOption(o => o.setName('عضو').setDescription('عضو الديسكورد').setRequired(true)),

  new SlashCommandBuilder()
    .setName('دخول')
    .setDescription('فتح شيفت مود Kick'),

  new SlashCommandBuilder()
    .setName('خروج')
    .setDescription('قفل شيفتك الحالي'),

  new SlashCommandBuilder()
    .setName('حالتي')
    .setDescription('عرض حالة شيفتك الحالية'),

  new SlashCommandBuilder()
    .setName('تقرير-المودات')
    .setDescription('تقرير حضور مودات Kick')
    .addStringOption(o => o
      .setName('الفترة')
      .setDescription('فترة التقرير')
      .setRequired(false)
      .addChoices(
        { name: 'اليوم', value: 'today' },
        { name: 'آخر 7 أيام', value: 'week' },
        { name: 'آخر 30 يوم', value: 'month' }
      )),

  new SlashCommandBuilder()
    .setName('قفل-شيفت')
    .setDescription('قفل شيفت مود يدويًا')
    .addUserOption(o => o.setName('عضو').setDescription('المود').setRequired(true))
    .addStringOption(o => o.setName('السبب').setDescription('سبب القفل').setRequired(false)),

  new SlashCommandBuilder()
    .setName('اعدادات-الحضور')
    .setDescription('عرض إعدادات نظام حضور مودات Kick')
].map(c => c.toJSON());

async function main() {
  if (!config.discordToken || !config.clientId) {
    throw new Error('DISCORD_TOKEN and DISCORD_CLIENT_ID are required');
  }

  const rest = new REST({ version: '10' }).setToken(config.discordToken);

  if (config.guildId) {
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
    console.log('Guild slash commands deployed.');
  } else {
    await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
    console.log('Global slash commands deployed.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
