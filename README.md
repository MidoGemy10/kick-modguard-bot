# Kick ModGuard - Presence Panel

بوت ديسكورد لمودات Kick بنظام لوحة وجود ذكية:

- لا يوجد نظام تحذيرات أو قفل تلقائي بسبب الخمول.
- أول ما اللايف يبقى Live، البوت يرسل لوحة في قناة محددة.
- اللوحة تتحدث تلقائيًا كل دقيقة.
- المود يظهر "موجود" لو تفاعل في شات Kick خلال آخر 30 دقيقة.
- المود يظهر "غير موجود" لو مفيش تفاعل حديث.
- يدعم رسائل الشات وأحداث المودريشن المتاحة من Kick Webhooks.

## أهم المتغيرات

```env
PRESENCE_CHANNEL_ID=ID_CHANNEL_FOR_PANEL
PRESENCE_ACTIVE_MINUTES=30
PRESENCE_UPDATE_SECONDS=60
DATABASE_PATH=/app/data/modguard.sqlite
```

لو `PRESENCE_CHANNEL_ID` مش موجود، البوت يستخدم `LOG_CHANNEL_ID`.

## التشغيل

```bash
npm install
npm run deploy
npm start
```

## أوامر ديسكورد

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

- Build type: Dockerfile
- Build context: `/`
- Dockerfile location: `/Dockerfile`
- CMD override: Custom command = `node src/index.js`
- Volume mount path: `/app/data`
