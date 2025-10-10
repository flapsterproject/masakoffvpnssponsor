// main.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const kv = await Deno.openKv();    

const TOKEN = Deno.env.get("BOT_TOKEN");
const SECRET_PATH = "/masakoffvpnssponsor"; // change this
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const CHANNELS = ["MasakoffVpns","AMERICAN_VPN", "Kesa_VPN", "POLO_SHXP"]; // your channels
const ADMIN_USERNAME = "Masakoff"; // admin username without @

async function getChannelTitle(channel: string): Promise<string> {
  try {
    const res = await fetch(`${TELEGRAM_API}/getChat?chat_id=@${channel}`);
    const data = await res.json();
    if (data.ok) {
      return data.result.title;
    }
  } catch (e) {
    console.error(e);
  }
  return channel; // fallback to username if fetch fails
}

serve(async (req: Request) => {
  const { pathname } = new URL(req.url);
  if (pathname !== SECRET_PATH) {
    return new Response("Bot is running.", { status: 200 });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const update = await req.json();
  const message = update.message;
  const callbackQuery = update.callback_query;
  const chatId = message?.chat?.id || callbackQuery?.message?.chat?.id;
  const userId = message?.from?.id || callbackQuery?.from?.id;
  const text = message?.text;
  const data = callbackQuery?.data;
  const messageId = callbackQuery?.message?.message_id;
  const username = message?.from?.username;
  const document = message?.document;
  const photo = message?.photo;

  if (!chatId || !userId) return new Response("No chat ID or user ID", { status: 200 });

  // Function to send message
  async function sendMessage(cid: number, msg: string, markup?: any) {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: cid,
        text: msg,
        reply_markup: markup
      })
    });
  }

  // Function to send document
  async function sendDocument(cid: number, fileId: string) {
    await fetch(`${TELEGRAM_API}/sendDocument`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: cid,
        document: fileId
      })
    });
  }

  // Function to check subscription
  async function isSubscribed(uid: number) {
    for (const channel of CHANNELS) {
      try {
        const res = await fetch(`${TELEGRAM_API}/getChatMember?chat_id=@${channel}&user_id=${uid}`);
        const data = await res.json();
        if (!data.ok) return false;
        const status = data.result.status;
        if (status === "left" || status === "kicked") return false;
      } catch (e) {
        console.error(e);
        return false;
      }
    }
    return true;
  }

  // Handle admin /changefile command
  if (text === "/changefile") {
    if (username !== ADMIN_USERNAME) {
      await sendMessage(chatId, "⚠️ Bu buýruga rugsadyňyz ýok! 🚫");
      return new Response("OK", { status: 200 });
    }
    await kv.set(["admin_state", chatId], "waiting_for_file");
    await sendMessage(chatId, "Maňa faýly iberiň. 📁");
    return new Response("OK", { status: 200 });
  }

  // Handle admin /setphoto command
  if (text === "/setphoto") {
    if (username !== ADMIN_USERNAME) {
      await sendMessage(chatId, "⚠️ Bu buýruga rugsadyňyz ýok! 🚫");
      return new Response("OK", { status: 200 });
    }
    await kv.set(["admin_state", chatId], "waiting_for_photo");
    await sendMessage(chatId, "Maňa suraty iberiň. 📸");
    return new Response("OK", { status: 200 });
  }

  // Handle file upload from admin
  if (document) {
    const state = await kv.get(["admin_state", chatId]);
    if (state.value === "waiting_for_file" && username === ADMIN_USERNAME) {
      const fileId = document.file_id;
      await kv.set(["current_file_id"], fileId);
      await kv.delete(["admin_state", chatId]);
      await sendMessage(chatId, "Faýl üstünlikli täzelendi! ✅📄");
      return new Response("OK", { status: 200 });
    }
  }

  // Handle photo upload from admin
  if (photo && photo.length > 0) {
    const state = await kv.get(["admin_state", chatId]);
    if (state.value === "waiting_for_photo" && username === ADMIN_USERNAME) {
      const fileId = photo[photo.length - 1].file_id;
      await kv.set(["current_photo_id"], fileId);
      await kv.delete(["admin_state", chatId]);
      await sendMessage(chatId, "Surat üstünlikli täzelendi! ✅📸");
      return new Response("OK", { status: 200 });
    }
  }

  // Handle admin /startpost command
  if (text === "/startpost") {
    if (username !== ADMIN_USERNAME) {
      await sendMessage(chatId, "⚠️ Bu buýruga rugsadyňyz ýok! 🚫");
      return new Response("OK", { status: 200 });
    }
    const photoId = await kv.get(["current_photo_id"]);
    if (!photoId.value) {
      await sendMessage(chatId, "⚠️ Ilki suraty belleň! 📸");
      return new Response("OK", { status: 200 });
    }
    const caption = "★ Botumuza taze Dark Tunnel VPN kodu yerleșdirdik!\n🔒 Indi siz has ýokaryly we çalt VPN hyzmatyndan peýdalanyň bilersiňiz.\n📱 Ulanmak üçin düňe botumuza girip, taze koduňyzy alyň bilersiňiz!";
    const inlineKeyboard = {
      inline_keyboard: [[{ text: "👉 VPN ALMAK 👉", url: "https://t.me/MasakoffVpns" }]]
    };
    for (const channel of CHANNELS) {
      try {
        await fetch(`${TELEGRAM_API}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: `@${channel}`,
            photo: photoId.value,
            caption: caption,
            reply_markup: inlineKeyboard
          })
        });
      } catch (e) {
        console.error(`Failed to post to @${channel}:`, e);
      }
    }
    await sendMessage(chatId, "Ähli kanallara ýazgy ýaýradyldy! 📢");
    return new Response("OK", { status: 200 });
  }

  // Handle /start command
  if (text?.startsWith("/start")) {
    const subscribed = await isSubscribed(userId);

    if (subscribed) {
      await sendMessage(chatId, "🎉 Ähli kanallara agza bolanyňyz üçin sag boluň! Vpnden lezzet alyň. 🤖👍");
      const file = await kv.get(["current_file_id"]);
      if (file.value) {
        await sendDocument(chatId, file.value as string);
      }
    } else {
      const channelButtons = [];
      for (const channel of CHANNELS) {
        const title = await getChannelTitle(channel);
        channelButtons.push([{ text: `${title} 🚀`, url: `https://t.me/${channel}` }]);
      }
      await sendMessage(chatId, "⚠️ Ilki ähli kanallara agza bolmaly! Agza bolanyňyzdan soň iň aşakdaky düwmä basyň. 📢", {
        inline_keyboard: [
          ...channelButtons,
          [{ text: "AGZA BOLDUM✅", callback_data: "check_sub" }]
        ]
      });
    }
  }

  // Handle inline button click
  if (data === "check_sub" && messageId) {
    const subscribed = await isSubscribed(userId);
    const textToSend = subscribed
      ? "🎉 Siz ähli kanallara agza bolduňyz! Vpnden lezzet alyň. 🤖👍"
      : "⚠️ Siz ähli kanallara agza däl. Ilki olara goşulyň! 📢";

    let replyMarkup;
    if (!subscribed) {
      const channelButtons = [];
      for (const channel of CHANNELS) {
        const title = await getChannelTitle(channel);
        channelButtons.push([{ text: `${title} 🚀`, url: `https://t.me/${channel}` }]);
      }
      replyMarkup = {
        inline_keyboard: [
          ...channelButtons,
          [{ text: "AGZA BOLDUM✅", callback_data: "check_sub" }]
        ]
      };
    }

    await fetch(`${TELEGRAM_API}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: textToSend,
        reply_markup: replyMarkup
      })
    });

    if (subscribed) {
      const file = await kv.get(["current_file_id"]);
      if (file.value) {
        await sendDocument(chatId, file.value as string);
      }
    }

    // Answer callback query to remove loading
    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQuery.id
      })
    });
  }

  return new Response("OK", { status: 200 });
});