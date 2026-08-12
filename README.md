# Balloon Message

A playful web app where a sender creates a short balloon message, shares an unguessable link, and a recipient opens it without creating an account.

## Features

- Sender flow: enter a sender name, recipient name, short note, and balloon color
- One-time reveal link with a secure random token
- 24-hour expiry and automatic cleanup after the first reveal
- Mobile-friendly happy preview and reveal experience

## Run locally

```bash
npm install
npm start
```

Then open http://localhost:3000

## API

- `POST /api/messages` creates a message and returns a share URL
- `POST /api/messages/:token/reveal` reveals the message once
- `GET /health` checks app health

## Notes

This implementation is intentionally lightweight and stores records in memory so it remains easy to run locally while validating the product flow.
