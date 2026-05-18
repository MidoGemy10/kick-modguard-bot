# Kick ModGuard Bot

بوت ديسكورد لتسجيل شيفتات مودات Kick بذكاء:
- المود يفتح شيفت من ديسكورد.
- البوت يراقب تفاعل المود في شات Kick عن طريق Webhooks.
- لو عدى 30 دقيقة بدون تفاعل = تحذير.
- لو التحذيرات وصلت 3 = قفل تلقائي للشيفت.
- نهاية اللايف تقفل الشيفتات تلقائياً إذا الإعداد مفعل.

## التشغيل السريع

```bash
npm install
cp .env.example .env
# عدل بيانات .env
# على Northflank استخدم DATABASE_PATH=/app/data/modguard.sqlite مع Volume على /app/data
npm run deploy
npm start
```

## Endpoint الخاص بك في Kick

بعد رفع البوت على الاستضافة، رابط Webhook سيكون:

```txt
https://your-domain.com/kick/webhook
```

## الاشتراك في أحداث Kick

بعد وضع KICK_APP_ACCESS_TOKEN و PUBLIC_URL و KICK_BROADCASTER_USER_ID في .env:

```bash
npm run subscribe:kick
```

الأحداث المستخدمة:
- chat.message.sent
- livestream.status.updated
- moderation.banned

## أوامر ديسكورد

- /اضافة-مود عضو kick_username
- /حذف-مود عضو
- /دخول
- /خروج
- /حالتي
- /تقرير-المودات الفترة
- /قفل-شيفت عضو السبب
- /اعدادات-الحضور

