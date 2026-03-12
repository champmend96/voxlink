# VoxLink

Self-hosted chat application with voice and video call features built with React Native and Node.js.

## Features

- **Chat**: Real-time messaging with typing indicators and read receipts
- **Voice Calls**: 1-on-1 voice calls with WebRTC
- **Video Calls**: Video calls with camera switching and picture-in-picture
- **Group Calls**: SFU-based group video calls (up to 8 participants) via mediasoup
- **File Sharing**: Image and document sharing with thumbnail generation
- **E2E Encryption**: End-to-end encryption using X25519 + XSalsa20-Poly1305
- **Push Notifications**: APNs (iOS) and FCM (Android) for incoming call alerts
- **TURN Server**: Bundled coturn configuration for NAT traversal
- **Security**: Rate limiting, account lockout, input sanitization, Helmet headers

## Setup

```bash
cp .env.example .env
docker compose up -d
npm install
npm run server:dev
```

In a separate terminal:

```bash
npm run mobile:start
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://voxlink:voxlink@localhost:5432/voxlink` |
| `JWT_SECRET` | Access token signing secret | `dev-secret` |
| `JWT_REFRESH_SECRET` | Refresh token signing secret | `dev-refresh-secret` |
| `PORT` | Server port | `3000` |
| `TURN_SERVER` | TURN server hostname | _(empty)_ |
| `TURN_USERNAME` | TURN credentials username | `voxlink` |
| `TURN_PASSWORD` | TURN credentials password | `voxlink-turn-password` |
| `APNS_KEY_PATH` | Path to APNs auth key (.p8) | _(empty)_ |
| `APNS_KEY_ID` | APNs key ID | _(empty)_ |
| `APNS_TEAM_ID` | Apple Team ID | _(empty)_ |
| `FCM_SERVICE_ACCOUNT_PATH` | Path to Firebase service account JSON | _(empty)_ |
| `FILE_STORAGE_PATH` | Directory for uploaded files | `server/uploads/` |
| `MAX_FILE_SIZE` | Max upload size in bytes | `26214400` (25 MB) |
| `MEDIASOUP_WORKERS` | Number of mediasoup workers | `2` |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `*` |
| `MAX_LOGIN_ATTEMPTS` | Failed logins before lockout | `5` |
| `LOCKOUT_DURATION_MS` | Account lockout duration | `900000` (15 min) |

## Architecture

- **Server**: Express + Socket.IO + Drizzle ORM (PostgreSQL)
- **Mobile**: React Native (Expo) + React Navigation
- **Calls**: WebRTC (1-on-1), mediasoup SFU (group)
- **Encryption**: tweetnacl (X25519 key exchange, XSalsa20-Poly1305)
- **TURN**: coturn (Docker)

## API Endpoints

### Auth
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Sign in
- `POST /api/auth/refresh` — Refresh tokens
- `GET /api/auth/me` — Current user profile

### Users
- `GET /api/users?search=` — Search users
- `PATCH /api/users/profile` — Update profile

### Conversations
- `GET /api/conversations` — List conversations
- `POST /api/conversations` — Create conversation
- `GET /api/conversations/:id` — Get conversation

### Messages
- `GET /api/messages/:conversationId` — Message history (cursor pagination)
- `POST /api/messages/upload` — Upload file/image (multipart)

### Calls
- `GET /api/calls/history` — Call history

### ICE / TURN
- `GET /api/ice/config` — Get ICE server configuration

### Devices (Push Notifications)
- `POST /api/devices/register` — Register device token
- `DELETE /api/devices/unregister` — Remove device token

### Encryption Keys
- `POST /api/keys` — Get public keys for users
- `PUT /api/keys/me` — Update own public key

### Monitoring
- `GET /api/health` — Health check (DB, uptime, memory)
- `GET /api/metrics` — Server metrics (WebSocket connections, active calls)
