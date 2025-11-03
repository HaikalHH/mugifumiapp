// Green API helper for WhatsApp

const GREENAPI_API_URL = process.env.GREENAPI_API_URL || "https://api.green-api.com";
const GREENAPI_ID_INSTANCE = process.env.GREENAPI_ID_INSTANCE || "";
const GREENAPI_API_TOKEN = process.env.GREENAPI_API_TOKEN || "";

export async function sendGreenMessage(chatId: string, message: string): Promise<boolean> {
  try {
    if (!GREENAPI_ID_INSTANCE || !GREENAPI_API_TOKEN) {
      console.error("Green API not configured: set GREENAPI_ID_INSTANCE and GREENAPI_API_TOKEN env vars");
      return false;
    }
    const url = `${GREENAPI_API_URL.replace(/\/$/, "")}/waInstance${GREENAPI_ID_INSTANCE}/sendMessage/${GREENAPI_API_TOKEN}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message })
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("Green API sendMessage failed:", res.status, txt);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Green API sendMessage error:", e);
    return false;
  }
}

export async function sendGreenGroupMessage(groupIdNoSuffix: string, message: string): Promise<boolean> {
  const chatId = groupIdNoSuffix.endsWith("@g.us") ? groupIdNoSuffix : `${groupIdNoSuffix}@g.us`;
  return sendGreenMessage(chatId, message);
}

