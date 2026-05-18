const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config');
const { startWebhookServer } = require('./kick/webhookServer');
const { handleInteraction } = require('./discord/handlers');
const logs = require('./discord/logs');
const shiftManager = require('./shiftManager');

if (!config.discordToken) {
  console.error('DISCORD_TOKEN missing in .env');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', () => {
  console.log(`[DISCORD] Logged in as ${client.user.tag}`);
  logs.setClient(client);

  setInterval(() => {
    shiftManager.checkInactiveMods().catch((err) => console.error('[INACTIVITY_CHECK_ERROR]', err));
  }, config.checkEveryMinutes * 60 * 1000);

  console.log(`[SHIFT] Inactivity check every ${config.checkEveryMinutes} minutes.`);
});

client.on('interactionCreate', (interaction) => {
  handleInteraction(interaction).catch(async (err) => {
    console.error('[INTERACTION_ERROR]', err);
    const msg = { content: '❌ حصل خطأ غير متوقع.', ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(msg).catch(() => null);
    else await interaction.reply(msg).catch(() => null);
  });
});

startWebhookServer();
client.login(config.discordToken);
