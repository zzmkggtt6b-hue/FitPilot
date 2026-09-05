import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config";
import {
  acquireProcessingLock,
  addMessage,
  addTelegramUserMessage,
  getOrCreateUser,
  markMessageCompleted,
  markMessageFailed,
  markMessageProcessing,
  releaseProcessingLock,
} from "@/lib/onboarding/repository";
import { startOnboarding } from "@/lib/onboarding/engine";
import { routeConversation } from "@/lib/onboarding/conversation-router";
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
  if (!message?.text || message.chat?.id == null || message.from?.id == null) return NextResponse.json({ ok: true });

  let userId: string | undefined;
  let lockToken: string | undefined;
  let messageId: string | undefined;

  try {
    const user = await getOrCreateUser(message.from.id, message.from.username);
    userId = user.id;

    const inserted = await addTelegramUserMessage(user.id, message.text, update.update_id);
    if (!inserted) return NextResponse.json({ ok: true });
    messageId = inserted;
    await markMessageProcessing(messageId);

    lockToken = await acquireProcessingLock(user.id);

    const reply = message.text.trim() === "/start"
      ? await startOnboarding(user.id)
      : await routeConversation(user.id, message.text);

    await sendTelegramMessage(message.chat.id, reply);
    await addMessage(user.id, "assistant", reply);
    await markMessageCompleted(messageId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("FitPilot Telegram webhook error", { error, userId, updateId: update.update_id });
    if (messageId) {
      try {
        await markMessageFailed(messageId, error instanceof Error ? error.message : String(error));
      } catch (statusError) {
        console.error("FitPilot message status update failed", statusError);
      }
    }
    return NextResponse.json({ ok: false }, { status: 500 });
  } finally {
    if (userId && lockToken) {
      try {
        await releaseProcessingLock(userId, lockToken);
      } catch (releaseError) {
        console.error("FitPilot lock release failed", releaseError);
      }
    }
  }
}
