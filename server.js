const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MESSAGE_TTL_MS = 24 * 60 * 60 * 1000;
const VALID_BALLOON_COLORS = new Set(['pink', 'yellow', 'mint', 'lavender', 'peach']);
const messages = new Map();

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function createToken() {
  return crypto.randomBytes(18).toString('base64url');
}

function sanitizeText(value, fallback = '') {
  const text = typeof value === 'string' ? value.trim() : fallback;
  return text || fallback;
}

function normalizeBalloonColor(value) {
  const color = sanitizeText(value, 'pink').toLowerCase();
  return VALID_BALLOON_COLORS.has(color) ? color : 'pink';
}

function createShareUrl(req, token) {
  return `${req.protocol}://${req.get('host')}/r/${token}`;
}

function removeExpiredRecord(token) {
  const record = messages.get(token);
  if (!record) {
    return null;
  }

  if (Date.now() >= record.expiresAt) {
    messages.delete(token);
    return { expired: true };
  }

  return record;
}

function getMessageRecord(token) {
  return removeExpiredRecord(token);
}

function buildUnavailableResponse(message, statusCode, extra = {}) {
  return {
    status: statusCode,
    error: message,
    ...extra,
  };
}

app.get('/favicon.ico', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.svg'));
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, status: 'healthy' });
});

app.post('/api/messages', (req, res) => {
  const sender = sanitizeText(req.body.sender).slice(0, 40);
  const recipient = sanitizeText(req.body.recipient).slice(0, 40) || 'someone special';
  const message = sanitizeText(req.body.message).slice(0, 180);
  const balloonColor = normalizeBalloonColor(req.body.balloonColor);

  if (!sender) {
    return res.status(400).json({ error: 'A sender name is required.' });
  }

  if (!message) {
    return res.status(400).json({ error: 'Your message needs a little sparkle.' });
  }

  const token = createToken();
  const record = {
    token,
    sender,
    recipient,
    message,
    balloonColor,
    createdAt: Date.now(),
    expiresAt: Date.now() + MESSAGE_TTL_MS,
    revealed: false,
  };

  messages.set(token, record);

  res.json({
    token,
    sender,
    recipient,
    message,
    balloonColor,
    shareUrl: createShareUrl(req, token),
    expiresAt: record.expiresAt,
  });
});

app.get('/api/messages/:token', (req, res) => {
  const token = req.params.token;
  const record = getMessageRecord(token);

  if (!record) {
    return res.status(410).json(buildUnavailableResponse('This balloon has drifted away or expired.', 410, {
      status: 'expired',
      token,
    }));
  }

  if (record.expired) {
    return res.status(410).json(buildUnavailableResponse('This balloon has expired.', 410, {
      status: 'expired',
      token,
    }));
  }

  res.json({
    token: record.token,
    sender: record.sender,
    recipient: record.recipient,
    message: record.revealed ? record.message : null,
    balloonColor: record.balloonColor,
    revealed: record.revealed,
    expiresAt: record.expiresAt,
  });
});

app.post('/api/messages/:token/reveal', (req, res) => {
  const token = req.params.token;
  const record = getMessageRecord(token);

  if (!record || record.expired) {
    return res.status(410).json(buildUnavailableResponse('This balloon has already floated away or expired.', 410, {
      status: 'expired',
      token,
    }));
  }

  if (record.revealed) {
    return res.status(409).json({
      status: 'already_revealed',
      error: 'This balloon has already been opened.',
      message: record.message,
      sender: record.sender,
      recipient: record.recipient,
      revealed: true,
    });
  }

  record.revealed = true;
  record.revealedAt = Date.now();
  messages.delete(token);

  res.json({
    token,
    sender: record.sender,
    recipient: record.recipient,
    message: record.message,
    balloonColor: record.balloonColor,
    revealed: true,
  });
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/r/:token', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reveal.html'));
});

app.listen(PORT, () => {
  console.log(`Balloon Message app is running on http://localhost:${PORT}`);
});
