const express = require('express');
const config = require('../config');
const shiftManager = require('../shiftManager');
const presencePanel = require('../discord/presencePanel');
const logs = require('../discord/logs');
const { parseModerationAction } = require('../utils/moderationParser');
const { verifyKickRequest } = require('./verifyWebhook');

function hasModeratorBadge(sender) {
  const badges = sender?.identity?.badges || [];
  return badges.some((b) => String(b.type).toLowerCase() === 'moderator');
}

function createWebhookServer() {
  const app = express();

  app.get('/', (req, res) => {
    res.json({ ok: true, service: 'Kick ModGuard Bot' });
  });

  app.post('/kick/webhook', express.raw({ type: '*/*' }), async (req, res) => {
    try {
      const valid = await verifyKickRequest(req.headers, req.body);
      if (!valid) return res.status(401).json({ ok: false, error: 'invalid signature' });

      const messageId = req.headers['kick-event-message-id'];
      if (!shiftManager.markEventProcessed(messageId)) {
        return res.status(200).json({ ok: true, duplicated: true });
      }

      const eventType = req.headers['kick-event-type'];
      const payload = JSON.parse(req.body.toString('utf8'));

      if (config.kickBroadcasterUserId && payload?.broadcaster?.user_id) {
        if (String(payload.broadcaster.user_id) !== String(config.kickBroadcasterUserId)) {
          return res.status(200).json({ ok: true, ignored: 'different broadcaster' });
        }
      }

      if (eventType === 'chat.message.sent') {
        const sender = payload.sender;
        if (!sender?.user_id) return res.json({ ok: true, ignored: 'no sender' });

        // ملاحظة: لو عايز تحسب رسائل المودات فقط لما بادج Moderator ظاهر، فعل الشرط ده.
        // حالياً بنعتمد على ربط الأدمن لليوزر، عشان بعض الأحداث/الحالات ممكن badge ما يظهرش فيها.
        const result = await shiftManager.recordActivityForKickUser({
          kickUserId: sender.user_id,
          kickUsername: sender.username,
          type: 'chat_message',
          content: payload.content,
          createdAt: payload.created_at,
          requireValidChat: true
        });

        return res.json({ ok: true, counted: result.ok, reason: result.reason || null, moderatorBadge: hasModeratorBadge(sender) });
      }

      if (eventType === 'moderation.banned') {
        const details = parseModerationAction(payload);

        if (!details.moderatorUserId) {
          await logs.logModerationAction({
            mod: null,
            details,
            resultReason: 'لم يتم العثور على بيانات المود داخل حدث Kick'
          });
          return res.json({ ok: true, logged: true, counted: false, reason: 'no moderator' });
        }

        const result = await shiftManager.recordActivityForKickUser({
          kickUserId: details.moderatorUserId,
          kickUsername: details.moderatorUsername,
          type: details.type,
          content: details.summary,
          createdAt: details.createdAt,
          requireValidChat: false,
          logDetails: details
        });

        // لو المود مش متضاف/مش مربوط في النظام، برضه ابعت الإجراء في LOG_CHANNEL عشان مفيش أكشن يضيع.
        if (!result.ok) {
          await logs.logModerationAction({
            mod: null,
            details,
            resultReason: result.reason || 'لم يتم احتساب الإجراء كنشاط'
          });
        }

        return res.json({ ok: true, logged: true, counted: result.ok, action: details.kind, reason: result.reason || null });
      }

      if (eventType === 'livestream.status.updated') {
        await shiftManager.updateStreamState(payload);
        await presencePanel.handleStreamStatusChanged(Boolean(payload.is_live));
        return res.json({ ok: true, live: payload.is_live });
      }

      return res.json({ ok: true, ignored: eventType });
    } catch (err) {
      console.error('[KICK_WEBHOOK_ERROR]', err);
      return res.status(500).json({ ok: false, error: 'server error' });
    }
  });

  return app;
}

function startWebhookServer() {
  const app = createWebhookServer();
  app.listen(config.port, () => {
    console.log(`[WEB] Listening on port ${config.port}`);
    console.log(`[WEB] Kick webhook: ${config.publicUrl || `http://localhost:${config.port}`}/kick/webhook`);
  });
}

module.exports = { createWebhookServer, startWebhookServer };
