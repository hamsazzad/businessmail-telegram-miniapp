# BusinessMail - Telegram Mini App

## Overview
A temporary email service running as a Telegram Mini App with a built-in token + gem economy. Users earn tokens and gems through tasks (joining channels, daily check-ins, watching ads) and use them to manage temporary email addresses on filmcity.online. Admin has unlimited access (no token deductions) and can set restrictions globally and per-user. Includes a Pollinations.AI-powered chatbot assistant.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui (Telegram Mini App optimized)
- **Backend**: Express.js (Node.js)
- **Database**: PostgreSQL with Drizzle ORM
- **Integrations**: Telegram Bot API, Cloudflare Workers (email routing), Adsterra multi-ad, Pollinations.AI (chatbot)
- **Email Rendering**: DOMPurify for safe HTML email display

## Key Files
- `shared/schema.ts` - Database schema (users with gems/maxEmails/maxEmailDays, generated_emails, received_emails, admin_settings)
- `server/routes.ts` - API endpoints for token economy, email management, admin, deployments, chat
- `server/storage.ts` - Database storage layer with full CRUD operations (gems, per-user limits)
- `server/telegram.ts` - Telegram Bot API helpers (webhook, membership check, messages)
- `client/src/pages/dashboard.tsx` - Main Mini App UI (dashboard, inbox, earn tokens+gems, admin panel, chat bubble)
- `client/src/lib/telegram.ts` - Telegram WebApp SDK integration
- `client/src/index.css` - Styles including email-body-rendered for HTML email display

## API Endpoints
- `POST /api/auth` - Authenticate/create user (returns isAdmin, settings, gems)
- `POST /api/generate-email` - Generate email (checks per-user limit + gem bonus)
- `DELETE /api/delete-email/:emailId` - Delete an email
- `POST /api/verify-join` - Verify channel membership and reward tokens
- `POST /api/daily-checkin` - Daily check-in for tokens
- `POST /api/reward-ad` - Reward tokens only after token ad watch
- `POST /api/reward-gem-ad` - Reward gems only after gem ad watch
- `POST /api/redeem-gem` - Redeem 1 gem for 1 extra email slot
- `POST /api/extend-limit` - Extend email lifespan in days (admin bypasses token cost)
- `GET /api/inbox/:emailAddress` - Get received emails (sorted newest first)
- `POST /api/webhook/email` - Receive emails from Cloudflare Worker
- `POST /api/telegram-webhook` - Telegram bot updates
- `POST /api/chat` - AI chatbot via Pollinations.AI (system prompt trained on app features)
- `GET /api/admin/stats` - Admin statistics (includes totalGems)
- `GET /api/admin/users` - List all users with email counts, gems, per-user limits
- `POST /api/admin/gift-tokens` - Add or deduct tokens (positive or negative amount)
- `POST /api/admin/gift-gems` - Add or deduct gems (positive or negative amount)
- `POST /api/admin/gift-all` - Mass gift/deduct tokens
- `POST /api/admin/set-user-limits` - Set per-user maxEmails and maxEmailDays
- `POST /api/admin/broadcast` - Broadcast message to all users via Telegram
- `POST /api/admin/settings` - Update individual global setting
- `POST /api/admin/settings/bulk` - Update multiple settings at once
- `POST /api/setup/telegram-webhook` - Configure Telegram webhook
- `POST /api/setup/deploy-worker` - Deploy Cloudflare email worker
- `POST /api/setup/deploy-github` - Deploy frontend to GitHub Pages

## Environment Variables
- `TELEGRAM_BOT_TOKEN` - Telegram bot API token
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_ACCOUNT_ID` - Cloudflare credentials
- `GITHUB_TOKEN`, `GITHUB_USERNAME` - GitHub deployment credentials
- `DOMAIN_NAME` - Email domain (filmcity.online)
- `CHANNEL_USERNAME` - Telegram channel (@aamoviesofficial)
- `ADMIN_TELEGRAM_ID` - Admin user Telegram ID (7151673318)
- `DATABASE_URL` - PostgreSQL connection string

## Token + Gem Economy (configurable via admin settings)
- Join Channel: +20 tokens (one-time)
- Daily Check-in: +6 tokens/day
- Watch Token Ad: +20 tokens (separate ad, 10-second timer)
- Watch Gem Ad: +0.2 gems (separate ad, 10-second timer)
- Extend Email: -10 tokens (+2 days, configurable)
- Default email lifespan: 7 days
- Max emails per user: 10 (global default, overridable per-user)
- Gem System: 1 gem = 1 extra email slot beyond limit (gems earned at 0.2 per ad)

## Adsterra Multi-Ad Integration
- Social Bar + Native Banner: Displayed inside ad modals (main document context)
- Direct Link + Popunder: Triggered when ad buttons are clicked
- Separate modals for token ads and gem ads
- cleanupAdScripts() removes all ad scripts when modals close

## Admin Panel Features
- **Overview Tab**: User/token/gem/member stats, deployment buttons (2x2 grid)
- **Users Tab**: Full user list with search, tokens, gems, per-user limits. Click user to set individual restrictions
- **Tools Tab**: Add/deduct tokens (toggle), add/deduct gems (toggle), mass gift, broadcast messages via Telegram
- **Settings Tab**: All dynamic global settings (email days, token rewards, costs, limits, gems per ad)

## Admin Capabilities
- Admin bypasses channel join and token deduction
- Add or deduct tokens from individual users
- Add or deduct gems from individual users
- Set per-user email limits and email validity days (overrides global)
- Set global restrictions for all users
- Per-user limits: maxEmails (null = use global), maxEmailDays (null = use global)

## AI Chatbot (Pollinations.AI)
- Floating chat bubble in bottom-right corner of the mini app
- Opens a chat panel with conversation history
- System prompt trained with full knowledge of app features, economy, and usage
- Proxied through `/api/chat` endpoint to avoid CORS issues
- Uses `https://text.pollinations.ai/` (free, no API key needed)

## Database Schema
- `users`: id, telegramId, username, firstName, tokens, gems, hasJoinedChannel, joinRewardClaimed, lastCheckinDate, maxEmails (nullable), maxEmailDays (nullable), createdAt
- `generated_emails`: id, emailAddress, userId, createdAt, expiresAt
- `received_emails`: id, emailAddress, fromAddress, subject, body, receivedAt (sorted DESC)
- `admin_settings`: id, key, value

## Time Display
- All time displays use days format (e.g., "3 days left" instead of "72 hours left")
- Extension shown in days (e.g., "Extend +2d")
