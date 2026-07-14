const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config');
const { startWebhookServer } = require('./kick/webhookServer');
const { handleInteraction } = require('./discord/handlers');
const logs = require('./discord/logs');
const presencePanel = require('./discord/presencePanel');
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
  presencePanel.setClient(client);

  const updateMs = Math.max(15, config.presenceUpdateSeconds) * 1000;

  setInterval(() => {
    presencePanel
      .updatePresencePanel()
      .catch((err) => console.error('[PRESENCE_PANEL_ERROR]', err));
  }, updateMs);

  presencePanel
    .updatePresencePanel()
    .catch((err) => console.error('[PRESENCE_PANEL_START_ERROR]', err));

  setInterval(() => {
    if (typeof shiftManager.processActivityCycle === 'function') {
      shiftManager.processActivityCycle();
    }
  }, 180000);

  console.log(
    `[PRESENCE] Panel update every ${config.presenceUpdateSeconds} seconds.`
  );
});

client.on('interactionCreate', (interaction) => {
  handleInteraction(interaction).catch(async (err) => {
    console.error('[INTERACTION_ERROR]', err);

    const msg = {
      content: '❌ حصل خطأ غير متوقع.',
      ephemeral: true
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(msg).catch(() => null);
    } else {
      await interaction.reply(msg).catch(() => null);
    }
  });
});

startWebhookServer();
client.login(config.discordToken);
