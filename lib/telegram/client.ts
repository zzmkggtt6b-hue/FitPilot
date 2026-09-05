import { env } from "@/lib/config";

type TelegramResponse<T> = { ok: boolean; result?: T; description?: string };

export async function telegramRequest<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as TelegramResponse<T>;
  if (!response.ok || !data.ok || !data.result) throw new Error(data.description ?? "Telegram API error");
  return data.result;
}

export async function sendTelegramMessage(chatId: number, text: string) {
  return telegramRequest("sendMessage", { chat_id: chatId, text });
}
