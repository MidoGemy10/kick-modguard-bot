require('dotenv').config();
const config = require('../config');

async function main() {
  if (!config.kickAccessToken) throw new Error('KICK_APP_ACCESS_TOKEN missing in .env');
  if (!config.kickBroadcasterUserId) throw new Error('KICK_BROADCASTER_USER_ID missing in .env');

  const events = [
    { name: 'chat.message.sent', version: 1 },
    { name: 'livestream.status.updated', version: 1 },
    { name: 'moderation.banned', version: 1 }
  ];

  const res = await fetch('https://api.kick.com/public/v1/events/subscriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.kickAccessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      broadcaster_user_id: Number(config.kickBroadcasterUserId),
      events,
      method: 'webhook'
    })
  });

  const text = await res.text();
  console.log('Status:', res.status);
  console.log(text);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
