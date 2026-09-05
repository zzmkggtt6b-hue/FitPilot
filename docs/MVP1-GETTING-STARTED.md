# FitPilot MVP1 — Getting Started

This document takes the repository from code to a working Telegram onboarding bot.

## 1. Create the external services

You need:

- A Supabase project
- A Telegram bot created with BotFather
- An OpenAI API key
- A Vercel project connected to this GitHub repository

## 2. Configure Supabase

Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL editor.

MVP1 uses the server-side service-role client only. Keep the service-role key out of the browser and out of Git.

## 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in:

```text
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5
APP_URL=http://localhost:3000
```

Use a random secret of at least 16 characters for `TELEGRAM_WEBHOOK_SECRET`.

## 4. Install and run

```bash
npm install
npm run dev
```

Open `http://localhost:3000` to verify the Next.js app is running.

## 5. Deploy to Vercel

Push the repository to GitHub, import it into Vercel, and add the same environment variables in the Vercel project settings.

Set `APP_URL` to the production HTTPS URL.

## 6. Configure the Telegram webhook

Telegram must send updates to:

```text
https://YOUR_DOMAIN/api/telegram/webhook
```

The webhook request must include Telegram's secret token header. The application validates `x-telegram-bot-api-secret-token` against `TELEGRAM_WEBHOOK_SECRET`.

You can configure the webhook using Telegram's `setWebhook` API, supplying the production webhook URL and the same secret token.

## 7. Test the complete flow

In Telegram:

1. Send `/start`.
2. Select `Nederlands` or `English`.
3. Accept consent.
4. Send a natural-language profile message such as `Ik ben 27, 181 cm en 82 kilo.`
5. Continue with training experience, location, availability, goals, and preferences.
6. Review the generated profile summary.
7. Confirm with `ja`.

Expected result: the onboarding session becomes `COMPLETED` and the structured profile is stored in Supabase.

## 8. MVP1 boundaries

The current implementation intentionally stops after profile onboarding. It does not yet generate workouts, nutrition plans, scientific RAG answers, or progress tracking.

## 9. Next implementation steps

After the end-to-end onboarding flow works in production:

- Add stronger safety classification and referral rules.
- Add richer correction handling and explicit language switching.
- Add an AI evaluation dataset.
- Add CI for type-check, lint, and tests.
- Start Phase 2 with deterministic training rules plus AI presentation.
