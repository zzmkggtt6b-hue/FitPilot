import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config";
import {
  acquireProcessingLock,
  addMessage,
  addTelegramUserMessage,
  getOrCreateUser,
  releaseProcessingLock,
} from "@/lib/onboarding/repository";
import { processOnboardingMessage, startOnboarding } from "@/lib/onboarding/engine";
import { sendTelegramMessage } from "@/lib/telegram/client";

type TelegramUpdate = {
  update_id?: number;
  message?: {
    message_id?: number;
    text?: string;
    chat?: { id: number };
    from?: { id: number; username?: string };
  };
};

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== env.TELEGRAM_WEBHOOK_SECRET) return NextResponse.json({ ok: false }, { status: 401 });

  const update = (await request.json()) as TelegramUpdate;
  const message = update.message;
  if (!message?.text || !message.chat?.id || !message.from?.id) return NextResponse.json({ ok: true });

  let userId: string | undefined;
  let lockToken: string | undefined;
  try {
    const user = await getOrCreateUser(message.from.id, message.from.username);
    userId = user.id;
    lockToken = await acquireProcessingLock(user.id);

    // Telegram may redeliver the same update. The unique update id makes processing idempotent.
    const isNew = await addTelegramUserMessage(user.id, message.text, update.update_id ?? message.message_id);
    if (!isNew) return NextResponse.json({ ok: true });

    const reply = message.text.trim() === "/start"
      ? await startOnboarding(user.id)
      : await processOnboardingMessage(user.id, message.text);

    await addMessage(user.id, "assistant", reply);
    await sendTelegramMessage(message.chat.id, reply);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("FitPilot Telegram webhook error", error);
    try { await sendTelegramMessage(message.chat.id, "Sorry, er ging iets mis. Probeer het over een moment opnieuw."); } catch (sendError) { console.error("FitPilot Telegram error reply failed", sendError); }
    return NextResponse.json({ ok: false }, { status: 500 });
  } finally {
    if (userId && lockToken) {
      try { await releaseProcessingLock(userId, lockToken); } catch (releaseError) { console.error("FitPilot lock release failed", releaseError); }
    }
  }
}
