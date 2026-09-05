import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config";
import { getOrCreateUser } from "@/lib/onboarding/repository";
import { processOnboardingMessage, startOnboarding } from "@/lib/onboarding/engine";
import { addMessage } from "@/lib/onboarding/repository";
import { sendTelegramMessage } from "@/lib/telegram/client";

type TelegramUpdate = {
  message?: {
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

  try {
    const user = await getOrCreateUser(message.from.id, message.from.username);
    await addMessage(user.id, "user", message.text);

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
  }
}
