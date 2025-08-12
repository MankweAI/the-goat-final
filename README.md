# The GOAT
WhatsApp-driven diagnostic math practice bot (Next.js + Supabase + ManyChat).

## Quick Start
1. Copy .env.local.example to .env.local and fill values.
2. npm install
3. Run migrations in Supabase (files under supabase/migrations).
4. npm run dev

## Webhook
POST /api/webhook/manychat
Body: { psid: string, message: string }

## Health
GET /api/health
