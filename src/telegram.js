// Telegram Bot API bilan ishlash — Telegraf o'rniga oddiy fetch.
// Workers'da long polling ishlamaydi, shuning uchun webhook ishlatiladi.

export class Telegram {
  constructor(token) {
    this.token = token;
  }

  async call(method, body) {
    const res = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json();
    if (!data.ok) console.warn(`Telegram ${method}:`, data.description);
    return data;
  }

  sendMessage(chatId, text, extra = {}) {
    return this.call('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true, ...extra });
  }

  editMessageText(chatId, messageId, text, extra = {}) {
    return this.call('editMessageText', { chat_id: chatId, message_id: messageId, text, ...extra });
  }

  editMessageReplyMarkup(chatId, messageId, markup) {
    return this.call('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: markup });
  }

  answerCallback(id, text, alert = false) {
    return this.call('answerCallbackQuery', { callback_query_id: id, text, show_alert: alert });
  }

  getChatMember(chatId, userId) {
    return this.call('getChatMember', { chat_id: chatId, user_id: userId });
  }

  setMenuButton(url, text, chatId) {
    return this.call('setChatMenuButton', {
      ...(chatId ? { chat_id: chatId } : {}),
      menu_button: url ? { type: 'web_app', text, web_app: { url } } : { type: 'default' },
    });
  }

  setWebhook(url, secret) {
    return this.call('setWebhook', {
      url,
      secret_token: secret,
      allowed_updates: ['message', 'callback_query', 'my_chat_member'],
      drop_pending_updates: true,
    });
  }

  // Fayl yuborish uchun multipart kerak — JSON emas
  async sendDocument(chatId, file, { fileName, caption, replyTo }) {
    const form = new FormData();
    form.append('chat_id', String(chatId));
    if (caption) form.append('caption', caption);
    if (replyTo) form.append('reply_to_message_id', String(replyTo));
    form.append('document', new Blob([file]), fileName || 'file');

    const res = await fetch(`https://api.telegram.org/bot${this.token}/sendDocument`, { method: 'POST', body: form });
    const data = await res.json();
    if (!data.ok) console.warn('Telegram sendDocument:', data.description);
    return data;
  }
}

/* ------------------------------- klaviaturalar ------------------------------ */

export const statusKeyboard = (id) => ({
  inline_keyboard: [
    [
      { text: 'Shortlist', callback_data: `set:${id}:shortlist` },
      { text: 'Suhbatga taklif', callback_data: `ask:${id}:intervyu` },
    ],
    [
      { text: 'Qabul qilish', callback_data: `ask:${id}:qabul` },
      { text: 'Rad javobi', callback_data: `ask:${id}:rad` },
    ],
  ],
});

export const startKeyboard = (formUrl, openText, changeText, multiLang) => {
  const rows = [];
  if (formUrl) rows.push([{ text: openText, web_app: { url: formUrl } }]);
  if (multiLang) rows.push([{ text: changeText, callback_data: 'changelang' }]);
  return { inline_keyboard: rows };
};

export const langKeyboard = (langs) => ({
  inline_keyboard: langs.map((l) => [{ text: l.native, callback_data: `lang:${l.code}` }]),
});
