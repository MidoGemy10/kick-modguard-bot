require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('./config');
const commands = [
new SlashCommandBuilder().setName('اضافة-مود').setDescription('إضافة مود إلى نظام حضور Kick').addUserOption(o=>o.setName('عضو').setDescription('عضو الديسكورد').setRequired(true)).addStringOption(o=>o.setName('يوزر_كيك').setDescription('اسم مستخدم Kick بدون @').setRequired(true)),
new SlashCommandBuilder().setName('حذف-مود').setDescription('حذف مود من نظام حضور Kick').addUserOption(o=>o.setName('عضو').setDescription('عضو الديسكورد').setRequired(true)),
new SlashCommandBuilder().setName('حالتي').setDescription('عرض احصائياتك'),
new SlashCommandBuilder().setName('تقرير-المودات').setDescription('ترتيب المودات')
].map(c=>c.toJSON());
async function main(){const rest=new REST({version:'10'}).setToken(config.discordToken); if(config.guildId) await rest.put(Routes.applicationGuildCommands(config.clientId,config.guildId),{body:commands}); else await rest.put(Routes.applicationCommands(config.clientId),{body:commands});}
main();
