import { Router } from 'express';
import { asyncHandler } from '../utils/error.js';
import { handleIncomingMessage } from '../services/whatsapp-bot.service.js';
import { sendWhatsappSeen } from '../services/whatsapp/index.js';
import { normalizeWhatsappNumber } from '../utils/phone.js';

const router = Router();
const recentWebhookKeys = new Map();
const quietLogs = ['error', 'silent'].includes(String(process.env.LOG_LEVEL || '').toLowerCase());

function extractMessageId(p, chatId, fromMe) {
  const direct =
    p.messageId ||
    p.id?._serialized ||
    p.id?.serialized ||
    p._data?.id?._serialized ||
    p._data?.id?.serialized ||
    (typeof p.id === 'string' ? p.id : null) ||
    (typeof p._data?.id === 'string' ? p._data.id : null);
  if (direct) return String(direct);

  const rawId = p.id?.id || p._data?.id?.id;
  const remote = p.id?.remote || p._data?.id?.remote || chatId;
  const idFromMe = p.id?.fromMe ?? p._data?.id?.fromMe ?? fromMe;
  if (rawId && remote) return `${Boolean(idFromMe)}_${remote}_${rawId}`;
  return null;
}

function rewriteMessageIdChat(messageId, chatId) {
  if (!messageId || !chatId) return messageId;
  const parts = String(messageId).split('_');
  if (parts.length < 3) return messageId;
  return `${parts[0]}_${chatId}_${parts.slice(2).join('_')}`;
}

function shouldSkipDuplicate(key) {
  if (!key) return false;
  const now = Date.now();
  for (const [k, ts] of recentWebhookKeys) {
    if (now - ts > 30_000) recentWebhookKeys.delete(k);
  }
  if (recentWebhookKeys.has(key)) return true;
  recentWebhookKeys.set(key, now);
  return false;
}

/**
 * Universal WhatsApp webhook.
 * Accepts multiple payload shapes:
 *   - WAHA:     { event, session, payload: { from, body, ... } }
 *   - WA-AKG:   { sender|from, message|text, ... }
 *   - Generic:  { from, body } or { number, message }
 */
function extractPayload(req) {
  const b = req.body || {};

  // WAHA style
  if (b.payload && (b.payload.from || b.payload.chatId)) {
    const p = b.payload;
    const rawChatId = p.chatId || p.from || p.to || p.id?.remote || p._data?.id?.remote || p.remoteJid;
    const chatId = String(rawChatId || '');
    const author = p.author || p.participant || p.sender?.id || p._data?.author || p._data?.participant;
    const fromMe = Boolean(p.fromMe || p.id?.fromMe || p._data?.id?.fromMe);
    const isGroup = chatId.includes('@g.us');
    const looksLikeWhatsAppId = (value) => /@(c\.us|g\.us|lid)$/.test(String(value || ''));
    const from = isGroup
      ? (looksLikeWhatsAppId(author) ? author : chatId)
      : (fromMe && looksLikeWhatsAppId(p.to) ? p.to : chatId);
    const fromCandidates = [
      p.chatId,
      p.from,
      p.to,
      p.author,
      p.participant,
      p.sender?.id,
      p.id?.remote,
      p._data?.id?.remote,
      p._data?.author,
      p._data?.participant,
      p.remoteJid,
    ].filter(Boolean).map(String);
    return {
      from,
      fromCandidates,
      body: p.body || p.text || p.caption || '',
      fromMe,
      isGroup,
      chatId: isGroup ? chatId : null,
      messageId: extractMessageId(p, chatId, fromMe),
    };
  }

  // Common keys
  const chatId = b.chatId || b.groupId || b.remoteJid || b.key?.remoteJid;
  const author = b.author || b.participant || b.sender?.id || b.key?.participant;
  const from = author || b.from || b.sender || b.number || b.phone || b.msisdn || b.waNumber;
  const body = b.body || b.message || b.text || b.content || b.msg;
  const fromMe = Boolean(b.fromMe);
  const isGroup = String(chatId || from || '').includes('@g.us');

  return {
    from,
    fromCandidates: [from, chatId, author, b.from, b.sender, b.number, b.phone, b.msisdn, b.waNumber].filter(Boolean),
    body,
    fromMe,
    isGroup,
    chatId: isGroup ? String(chatId || b.from || '') : null,
    messageId: b.messageId || b.id?._serialized || b.id?.serialized || b.key?._serialized || b.key?.serialized || (b.key?.id && chatId ? `${fromMe}_${chatId}_${b.key.id}` : null) || b.id || null,
  };
}

router.post(
  '/whatsapp',
  asyncHandler(async (req, res) => {
    const { from, fromCandidates, body, fromMe, isGroup, chatId, messageId } = extractPayload(req);
    const normalizedFrom = normalizeWhatsappNumber(from);
    if (!quietLogs) {
      console.log('[WA webhook]', {
        event: req.body?.event,
        from: normalizedFrom || from,
        fromMe,
        isGroup,
        chatId,
        body: typeof body === 'string' ? body.slice(0, 80) : typeof body,
        messageId,
        fromCandidates,
      });
    }
    const replyTarget = String(from || '').includes('@') ? from : (normalizedFrom || from);
    const seenParticipant = isGroup ? fromCandidates.find((v) => /@(c\.us|lid)$/.test(String(v))) : null;
    const seenTarget = isGroup && chatId
      ? chatId
      : fromCandidates.find((v) => String(v).includes('@c.us')) || replyTarget;
    const seenMessageId = !isGroup && String(seenTarget).includes('@c.us')
      ? rewriteMessageIdChat(messageId, seenTarget)
      : messageId;

    if (process.env.WAHA_DEBUG_SEEN === 'true') {
      console.log('[WA seen debug]', {
        replyTarget,
        seenTarget,
        seenParticipant,
        messageId,
        seenMessageId,
        rawId: req.body?.payload?.id || req.body?.payload?._data?.id || req.body?.id || null,
      });
    }

    if (!from) {
      return res.status(200).json({ ok: true, ignored: 'no_sender' });
    }

    // Skip bot's own outbound echoes (prevents loops when WAHA is listening to fromMe)
    if (fromMe) {
      return res.status(200).json({ ok: true, ignored: 'from_me' });
    }

    const text = typeof body === 'string' ? body : '';
    if (!text) {
      return res.status(200).json({ ok: true, ignored: 'empty_body' });
    }

    const dedupeKey = messageId || `${normalizedFrom || from}:${text}`;
    if (shouldSkipDuplicate(dedupeKey)) {
      return res.status(200).json({ ok: true, ignored: 'duplicate' });
    }

    // Respond 200 quickly then process (best-effort)
    res.status(200).json({ ok: true });

    // if (!messageId && process.env.WAHA_DEBUG_SEEN === 'true') {
    //   console.log('[WA seen skipped] messageId is empty');
    // }
    sendWhatsappSeen(seenTarget, { messageId: seenMessageId, participant: seenParticipant }).catch(() => {});
    // Untuk grup, reply ke chatId grup; untuk DM, reply ke sender
    const replyTo = isGroup && chatId ? chatId : replyTarget;
    handleIncomingMessage({ from: replyTarget, fromCandidates, body: text, replyTo, isGroup }).catch((e) => {
      console.error('[WA bot error]', e);
    });
  })
);

router.get('/whatsapp', (req, res) => {
  // Verification (e.g., Meta)
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token && token === process.env.WA_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.status(200).json({ ok: true });
});

export default router;
