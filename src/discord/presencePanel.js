const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const db = require('../db');

let clientRef = null;

function setClient(client) {
  clientRef = client;
}

function streamState() {
  return db.prepare('SELECT * FROM stream_state WHERE id = 1').get();
}

function getMods() {
  return db.prepare(`
    SELECT
      discord_id,
      kick_username
    FROM mods
    WHERE active = 1
    ORDER BY kick_username ASC
  `).all();
}

function buildPresenceEmbed() {
  const state = streamState();
  const mods = getMods();

  const liveStatus = state?.is_live
    ? '🟢 مباشر'
    : '🔴 أوفلاين';

  const modList = mods.length
    ? mods.map(m => `• ${m.kick_username}`).join('\n')
    : 'لا يوجد مودات مسجلة';

  return new EmbedBuilder()
    .setTitle('لوحة وجود مودات Kick')
    .setColor(state?.is_live ? 0x22c55e : 0xef4444)
    .addFields(
      {
        name: 'حالة اللايف',
        value: liveStatus,
        inline: false
      },
      {
        name: 'المودات المسجلة',
        value: String(mods.length),
        inline: false
      },
      {
        name: 'المودات',
        value: modList.slice(0, 1024),
        inline: false
      }
    )
    .setFooter({
      text: `آخر تحديث: ${new Date().toLocaleTimeString('ar-EG')}`
    })
    .setTimestamp();
}

async function getPanelChannel() {
  if (!clientRef || !config.presenceChannelId) return null;

  const channel = await clientRef.channels
    .fetch(config.presenceChannelId)
    .catch(() => null);

  if (!channel || !channel.isTextBased?.()) return null;

  return channel;
}

async function savePanelMessage(message) {
  db.prepare(`
    UPDATE stream_state
    SET panel_message_id = ?, panel_channel_id = ?
    WHERE id = 1
  `).run(message.id, message.channel.id);
}

async function updatePresencePanel() {
  const channel = await getPanelChannel();

  if (!channel) {
    return {
      ok: false,
      reason: 'presence channel not found'
    };
  }

  const state = streamState();
  const embed = buildPresenceEmbed();

  if (state?.panel_message_id) {
    const oldChannel = state.panel_channel_id
      ? await clientRef.channels
          .fetch(state.panel_channel_id)
          .catch(() => channel)
      : channel;

    const message = await oldChannel.messages
      .fetch(state.panel_message_id)
      .catch(() => null);

    if (message) {
      await message.edit({
        embeds: [embed]
      });

      return {
        ok: true,
        edited: true
      };
    }
  }

  const message = await channel.send({
    embeds: [embed]
  });

  await savePanelMessage(message);

  return {
    ok: true,
    created: true
  };
}

async function handleStreamStatusChanged() {
  return updatePresencePanel();
}

module.exports = {
  setClient,
  updatePresencePanel,
  handleStreamStatusChanged,
  buildPresenceEmbed
};
