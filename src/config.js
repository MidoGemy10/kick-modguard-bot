require('dotenv').config();

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

function int(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

module.exports = {
  discordToken: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.GUILD_ID,
  logChannelId: process.env.LOG_CHANNEL_ID,
  adminRoleId: process.env.ADMIN_ROLE_ID || null,

  port: int(process.env.PORT, 3000),
  publicUrl: process.env.PUBLIC_URL,
  databasePath: process.env.DATABASE_PATH || 'modguard.sqlite',

  kickBroadcasterUserId: process.env.KICK_BROADCASTER_USER_ID,
  kickAccessToken: process.env.KICK_APP_ACCESS_TOKEN,
  kickVerifySignature: bool(process.env.KICK_VERIFY_SIGNATURE, true),

  // قناة لوحة وجود المودات. لو مش موجودة، البوت يستخدم LOG_CHANNEL_ID.
  presenceChannelId: process.env.PRESENCE_CHANNEL_ID || process.env.LOG_CHANNEL_ID,
  presenceActiveMinutes: int(process.env.PRESENCE_ACTIVE_MINUTES || process.env.INACTIVITY_MINUTES, 30),
  presenceUpdateSeconds: int(process.env.PRESENCE_UPDATE_SECONDS, 60),

  minMessageLength: int(process.env.MIN_MESSAGE_LENGTH, 3),
  duplicateWindowMinutes: int(process.env.DUPLICATE_WINDOW_MINUTES, 10),
  countOnlyWhenLive: bool(process.env.COUNT_ONLY_WHEN_LIVE, false),
  closeShiftWhenStreamEnds: bool(process.env.CLOSE_SHIFT_WHEN_STREAM_ENDS, true)
};
