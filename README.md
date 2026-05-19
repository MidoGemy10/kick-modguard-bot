# Kick ModGuard Bot - Presence Panel

بوت Discord يعرض لوحة وجود مودات Kick ويتابعها تلقائيًا من Kick Webhooks.

## التعديل الحالي

- لوحة المودات تظهر سواء اللايف شغال أو أوفلاين.
- لو اللايف أوفلاين: اللوحة حمراء وتكتب `اللايف أوفلاين`.
- لو اللايف شغال: اللوحة خضراء وترتب المودات حسب الوجود والتفاعل.
- اللوحة تتحدث تلقائيًا كل دقيقة حسب `PRESENCE_UPDATE_SECONDS`.
- تم إلغاء نظام التحذيرات والقفل بسبب عدم التفاعل.

## Environment Variables

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
GUILD_ID=
LOG_CHANNEL_ID=
ADMIN_ROLE_ID=

PORT=3000
PUBLIC_URL=https://your-service.code.run
DATABASE_PATH=/app/data/modguard.sqlite

KICK_BROADCASTER_USER_ID=
KICK_APP_ACCESS_TOKEN=
KICK_VERIFY_SIGNATURE=true

PRESENCE_CHANNEL_ID=
PRESENCE_ACTIVE_MINUTES=30
PRESENCE_UPDATE_SECONDS=60

MIN_MESSAGE_LENGTH=3
DUPLICATE_WINDOW_MINUTES=10
COUNT_ONLY_WHEN_LIVE=false
CLOSE_SHIFT_WHEN_STREAM_ENDS=true
```

## أوامر التشغيل

```bash
npm install
npm run deploy
npm start
```

## أوامر Discord

- `/اضافة-مود`
- `/حذف-مود`
- `/دخول`
- `/خروج`
- `/حالتي`
- `/تقرير-المودات`
- `/قفل-شيفت`
- `/لوحة-المودات`
- `/اعدادات-الحضور`

## Northflank

يفضل استخدام Dockerfile مع:

- Build context: `/`
- Dockerfile location: `/Dockerfile`
- CMD override: `node src/index.js`
- Volume mount path: `/app/data`
- `DATABASE_PATH=/app/data/modguard.sqlite`
