// Bysmillah HR — Cloudflare Worker
// Ariza formasi, ishchilar bo'limi va Telegram webhook bitta Worker ichida.

import { candidates, staff, botUsers, settings } from './db.js';
import { verifyInitData, signToken, readToken } from './crypto.js';
import { Telegram, statusKeyboard, startKeyboard, langKeyboard } from './telegram.js';
import { FIELDS, ANSWER_FIELDS, SECTIONS, schemaFor, tr, renderAnswer, byId } from './questions.js';
import { LANGS, DEFAULT_LANG, s, uiStrings, fill } from './i18n.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

const nowIso = () => new Date().toISOString();
const nick = (value) =>
  String(value || '').trim().replace(/^https?:\/\/t\.me\//i, '').replace(/^@+/, '').toLowerCase();
const validNick = (value) => (/^[a-z0-9_]{4,32}$/.test(nick(value)) ? nick(value) : '');

const CV_EXT = /\.(pdf|docx?|rtf|odt|txt)$/i;
const CV_MAX = 15 * 1024 * 1024;
const AVATAR_MAX = 4 * 1024 * 1024;
const AVATAR_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/* --------------------------------- yordamchi -------------------------------- */

const company = (env) => env.COMPANY_NAME || 'Bysmillah';
const langOf = (value) => (LANGS.some((l) => l.code === value) ? value : DEFAULT_LANG);

const departmentsList = () =>
  (byId.q3?.options || []).map((o) => ({ value: o.value, label: tr(o.label, DEFAULT_LANG) }));

const deptsOf = (c) => {
  const raw = c.answers?.q3;
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
};

function allowedFor(user, candidate) {
  if (user.role === 'admin') return true;
  const allow = user.permissions.departments || [];
  if (!allow.length) return false;
  return deptsOf(candidate).some((d) => allow.includes(d));
}

// Server tomonda javoblarni tekshirish
function validate(answers) {
  const errors = {};
  const clean = {};

  for (const f of FIELDS) {
    if (f.type === 'file') continue;
    const raw = answers[f.id];

    if (f.type === 'chips') {
      const values = (Array.isArray(raw) ? raw : raw ? [raw] : [])
        .map(String)
        .filter((v) => (f.options || []).some((o) => o.value === v));
      if (f.required && !values.length) errors[f.id] = 'required';
      clean[f.id] = f.multi ? values : values[0] || '';

      if (f.otherField && values.includes('other')) {
        const other = String(answers[f.id + '_other'] || '').trim().slice(0, 200);
        if (!other) errors[f.id + '_other'] = 'required';
        clean[f.id + '_other'] = other;
      }
      continue;
    }

    const value = String(raw ?? '').trim();
    if (f.required && !value) {
      errors[f.id] = 'required';
      continue;
    }
    if (f.type === 'number') {
      const n = Number(value);
      if (!Number.isFinite(n) || n < (f.min ?? 0) || n > (f.max ?? 200)) errors[f.id] = 'invalid';
      clean[f.id] = value;
      continue;
    }
    if (f.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) errors[f.id] = 'invalid';
    if (f.type === 'tel' && value && value.replace(/\D/g, '').length < 9) errors[f.id] = 'invalid';

    if (f.id === 'telegram' && value) {
      const clean_ = validNick(value);
      if (!clean_) errors[f.id] = 'invalid';
      else {
        clean[f.id] = '@' + clean_;
        continue;
      }
    }
    clean[f.id] = value.slice(0, f.max && f.type !== 'number' ? f.max : 500);
  }

  return { ok: !Object.keys(errors).length, errors, clean };
}

/* ------------------------------ guruh xabarlari ----------------------------- */

const esc = (t) =>
  String(t === undefined || t === null || t === '' ? '—' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const STATUS_LABEL = {
  yangi: 'Yangi',
  shortlist: 'Shortlist',
  intervyu: 'Suhbatga taklif qilindi',
  qabul: 'Qabul qilindi',
  rad: 'Rad javobi yuborildi',
};

function cardText(c, updated) {
  const a = c.answers || {};
  const contact = c.username ? `@${esc(c.username)}` : `<a href="tg://user?id=${c.telegramId}">profil</a>`;
  return [
    `<b>${updated ? 'Ariza yangilandi' : 'Yangi ariza'}</b> · <code>${esc(c.id)}</code>`,
    '',
    `<b>${esc(a.fullName)}</b>, ${esc(a.age)} — ${esc(a.city)}`,
    `Telefon: <code>${esc(a.phone)}</code>`,
    `Email: <code>${esc(a.email)}</code>`,
    `Telegram: ${contact}`,
    '',
    `<b>Yo‘nalish:</b> ${esc(renderAnswer('q3', a))}`,
    `<b>Muddat:</b> ${esc(renderAnswer('q9', a))}`,
    `<b>Ish uslubi:</b> ${esc(renderAnswer('q5', a))}`,
    '',
    `<b>Rezyume:</b> ${c.cv ? esc(c.cv.fileName) : 'yo‘q'}`,
    `<b>Holat:</b> ${esc(STATUS_LABEL[c.status] || c.status)}${c.statusBy ? ` — ${esc(c.statusBy)}` : ''}`,
  ].join('\n');
}

function fullAnswersChunks(c, limit = 3500) {
  const blocks = [`<b>${esc(c.id)} — ${esc(c.answers?.fullName)}, to‘liq javoblar</b>`];
  for (const f of ANSWER_FIELDS) {
    if (f.section === 'contact' || f.id.endsWith('_other')) continue;
    const value = renderAnswer(f.id, c.answers || {});
    if (!value) continue;
    blocks.push(`<b>${esc(tr(f.label, 'uz', { company: 'kompaniya' }))}</b>\n${esc(value)}`);
  }

  const chunks = [];
  let current = '';
  for (const block of blocks) {
    if (current && current.length + block.length + 2 > limit) {
      chunks.push(current);
      current = '';
    }
    current += (current ? '\n\n' : '') + block;
  }
  if (current) chunks.push(current);
  return chunks;
}

async function sendToGroup(env, tg, candidate, updated) {
  const groupId = await settings.get(env.DB, 'group_id');
  if (!groupId) return false;

  const card = await tg.sendMessage(groupId, cardText(candidate, updated), {
    parse_mode: 'HTML',
    reply_markup: statusKeyboard(candidate.id),
  });
  if (!card.ok) return false;

  await candidates.update(env.DB, candidate.id, { groupMessageId: card.result.message_id });

  if (candidate.cv?.key) {
    const file = await env.FILES.get(candidate.cv.key, 'arrayBuffer');
    if (file) {
      await tg.sendDocument(groupId, file, {
        fileName: candidate.cv.fileName,
        caption: `${candidate.id} — ${candidate.answers?.fullName || ''}`,
        replyTo: card.result.message_id,
      });
    }
  }

  for (const chunk of fullAnswersChunks(candidate)) {
    await tg.sendMessage(groupId, chunk, { parse_mode: 'HTML', reply_to_message_id: card.result.message_id });
  }
  return true;
}

/* --------------------------------- webhook --------------------------------- */

const formUrl = (env, lang) => `${env.PUBLIC_URL}/?lang=${lang}`;

async function sendWelcome(env, tg, chatId, lang) {
  const previous = await candidates.byTelegramId(env.DB, chatId);
  const text =
    s(lang, 'welcome', { company: company(env) }) +
    (previous.length ? '\n\n' + s(lang, 'alreadyApplied', { id: previous[0].id }) : '');

  const sent = await tg.sendMessage(chatId, text, {
    reply_markup: startKeyboard(formUrl(env, lang), s(lang, 'openForm'), s(lang, 'changeLang'), LANGS.length > 1),
  });
  if (sent.ok) await botUsers.set(env.DB, chatId, { lang, welcomeMessageId: sent.result.message_id });
}

async function notifyCandidate(env, tg, candidate, status, presser) {
  const key = { intervyu: 'interview', qabul: 'accepted', rad: 'rejected' }[status];
  if (!key) return false;

  const lang = langOf(candidate.lang);
  const contact = env.HR_CONTACT || (presser ? '@' + presser : s(lang, 'hrTeam'));
  const textKey = key === 'interview' && !env.INTERVIEW_LINK ? 'interviewNoLink' : key;

  const res = await tg.sendMessage(
    candidate.telegramId,
    s(lang, textKey, { name: candidate.answers?.fullName || '', company: company(env), contact, link: env.INTERVIEW_LINK || '' }),
    { disable_web_page_preview: false }
  );
  return res.ok;
}

async function handleUpdate(env, tg, update) {
  const db = env.DB;

  /* --- oddiy xabarlar --- */
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const text = String(msg.text || '');

    if (msg.chat.type !== 'private') {
      // Guruhda: arizalar guruhini belgilash
      if (/^\/guruh/.test(text)) {
        const member = await tg.getChatMember(chatId, msg.from.id);
        const role = member.result?.status;
        if (role !== 'creator' && role !== 'administrator') return;

        await settings.set(db, 'group_id', chatId);
        await settings.addAdmin(db, msg.from.id);
        await tg.sendMessage(chatId, `Bu guruh arizalar guruhi qilib belgilandi.\nID: ${chatId}`);
      }
      return;
    }

    if (/^\/start/.test(text)) {
      const saved = await botUsers.get(db, chatId);
      const lang = langOf(saved?.lang);
      if (LANGS.length < 2) return sendWelcome(env, tg, chatId, DEFAULT_LANG);
      if (saved?.lang) return sendWelcome(env, tg, chatId, lang);
      return tg.sendMessage(chatId, s(DEFAULT_LANG, 'chooseLang'), { reply_markup: langKeyboard(LANGS) });
    }

    if (/^\/til/.test(text) && LANGS.length > 1) {
      return tg.sendMessage(chatId, s(DEFAULT_LANG, 'chooseLang'), { reply_markup: langKeyboard(LANGS) });
    }

    if (/^\/id/.test(text)) return tg.sendMessage(chatId, `Chat ID: ${chatId}\nUser ID: ${msg.from.id}`);

    if (/^\/sozlash/.test(text)) {
      const admins = await settings.admins(db);
      if (!admins.length) await settings.addAdmin(db, msg.from.id);
      else if (!admins.includes(String(msg.from.id))) return;

      const groupId = await settings.get(db, 'group_id');
      const all = await candidates.all(db);
      return tg.sendMessage(
        chatId,
        [
          `Kompaniya: ${company(env)}`,
          `Arizalar guruhi: ${groupId || 'sozlanmagan'}`,
          `Web App: ${env.PUBLIC_URL}`,
          `Nomzodlar: ${all.length}`,
        ].join('\n')
      );
    }

    if (/^\/stats/.test(text)) {
      const admins = await settings.admins(db);
      if (!admins.includes(String(msg.from.id))) return;
      const all = await candidates.all(db);
      const byStatus = {};
      for (const c of all) byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      return tg.sendMessage(
        chatId,
        `Jami: ${all.length}\n` + Object.entries(byStatus).map(([k, v]) => `  ${STATUS_LABEL[k] || k}: ${v}`).join('\n')
      );
    }
    return;
  }

  /* --- tugmalar --- */
  if (update.callback_query) {
    const q = update.callback_query;
    const data = String(q.data || '');
    const chatId = q.message?.chat?.id;
    const presser = q.from.username;

    if (data.startsWith('lang:')) {
      const lang = langOf(data.slice(5));
      await botUsers.set(db, q.from.id, { lang });
      await tg.answerCallback(q.id);
      await tg.call('deleteMessage', { chat_id: chatId, message_id: q.message.message_id }).catch(() => {});
      return sendWelcome(env, tg, chatId, lang);
    }

    if (data === 'changelang') {
      await tg.answerCallback(q.id);
      return tg.sendMessage(chatId, s(DEFAULT_LANG, 'chooseLang'), { reply_markup: langKeyboard(LANGS) });
    }

    const set = data.match(/^set:(.+):shortlist$/);
    if (set) {
      const updated = await candidates.update(db, set[1], {
        status: 'shortlist',
        statusBy: presser ? '@' + presser : q.from.first_name,
        statusAt: nowIso(),
      });
      if (!updated) return tg.answerCallback(q.id, 'Nomzod topilmadi', true);
      await tg.answerCallback(q.id, 'Shortlistga qo‘shildi');
      return tg.editMessageText(chatId, q.message.message_id, cardText(updated), {
        parse_mode: 'HTML',
        reply_markup: statusKeyboard(updated.id),
      });
    }

    const ask = data.match(/^ask:(.+):(intervyu|qabul|rad)$/);
    if (ask) {
      const candidate = await candidates.byId(db, ask[1]);
      if (!candidate) return tg.answerCallback(q.id, 'Nomzod topilmadi', true);
      if (candidate.notified.includes(ask[2])) return tg.answerCallback(q.id, 'Bu xabar allaqachon yuborilgan', true);

      await tg.answerCallback(q.id);
      return tg.editMessageReplyMarkup(chatId, q.message.message_id, {
        inline_keyboard: [
          [{ text: 'Ha, yuborilsin', callback_data: `do:${ask[1]}:${ask[2]}` }],
          [{ text: 'Bekor qilish', callback_data: `cancel:${ask[1]}` }],
        ],
      });
    }

    const cancel = data.match(/^cancel:(.+)$/);
    if (cancel) {
      const candidate = await candidates.byId(db, cancel[1]);
      await tg.answerCallback(q.id, 'Bekor qilindi');
      if (candidate) {
        return tg.editMessageText(chatId, q.message.message_id, cardText(candidate), {
          parse_mode: 'HTML',
          reply_markup: statusKeyboard(candidate.id),
        });
      }
      return;
    }

    const done = data.match(/^do:(.+):(intervyu|qabul|rad)$/);
    if (done) {
      const candidate = await candidates.byId(db, done[1]);
      if (!candidate) return tg.answerCallback(q.id, 'Nomzod topilmadi', true);

      const sent = await notifyCandidate(env, tg, candidate, done[2], presser);
      const updated = await candidates.update(db, candidate.id, {
        status: done[2],
        statusBy: presser ? '@' + presser : q.from.first_name,
        statusAt: nowIso(),
        notified: sent ? [...candidate.notified, done[2]] : candidate.notified,
      });

      await tg.answerCallback(q.id, sent ? 'Nomzodga xabar yuborildi' : 'Xabar yuborilmadi', !sent);
      return tg.editMessageText(chatId, q.message.message_id, cardText(updated), {
        parse_mode: 'HTML',
        reply_markup: statusKeyboard(updated.id),
      });
    }
    return;
  }

  /* --- guruhga qo'shilish --- */
  if (update.my_chat_member) {
    const chat = update.my_chat_member.chat;
    const status = update.my_chat_member.new_chat_member?.status;
    if (chat.type === 'private' || status === 'left' || status === 'kicked') return;

    if (!(await settings.admins(db)).length) await settings.addAdmin(db, update.my_chat_member.from.id);
    await settings.set(db, 'group_id', chat.id);
    await tg.sendMessage(chat.id, `${company(env)} HR boti qo‘shildi.\nBu guruh arizalar guruhi qilib belgilandi.\nID: ${chat.id}`);
  }
}

/* ------------------------------ ishchilar API ------------------------------ */

async function authOf(env, request, url) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : url.searchParams.get('token');
  const data = await readToken(token, env.BOT_TOKEN);
  if (!data) return null;

  const user = await staff.raw(env.DB, data.u);
  if (!user || !user.active || (user.tokenVersion || 1) !== data.v) return null;

  const { _salt, _hash, _secret, tokenVersion, ...rest } = user;
  return rest;
}

const hiredNicks = async (db) =>
  new Set((await staff.list(db)).map((u) => nick(u.telegram)).filter(Boolean));

const isHired = (c, hired) => hired.has(nick(c.answers?.telegram)) || hired.has(nick(c.username));

function briefOf(c, viewer) {
  const a = c.answers || {};
  const brief = {
    id: c.id,
    createdAt: c.createdAt,
    status: c.status,
    statusBy: c.statusBy,
    fullName: a.fullName || '',
    age: a.age || '',
    city: a.city || '',
    departments: deptsOf(c).map((v) => departmentsList().find((d) => d.value === v)?.label || v),
    hasCv: Boolean(c.cv),
    cvFileName: c.cv?.fileName || null,
  };
  if (viewer.permissions.viewContacts) {
    brief.phone = a.phone || '';
    brief.email = a.email || '';
    brief.telegram = a.telegram || (c.username ? '@' + c.username : null);
  }
  return brief;
}

function answerGroups(candidate, { editable } = {}) {
  return SECTIONS.filter((s_) => s_.id !== 'cv')
    .map((section) => ({
      id: section.id,
      title: tr(section.title, DEFAULT_LANG),
      items: ANSWER_FIELDS.filter((f) => f.section === section.id && !f.id.endsWith('_other')).map((f) => ({
        id: f.id,
        question: tr(f.label, DEFAULT_LANG, { company: 'the team' }),
        answer: renderAnswer(f.id, candidate.answers || {}, DEFAULT_LANG),
        ...(editable
          ? {
              type: f.type,
              max: f.max || null,
              multi: Boolean(f.multi),
              options: (f.options || []).map((o) => ({ value: o.value, label: tr(o.label, DEFAULT_LANG) })),
              value: candidate.answers?.[f.id] ?? (f.multi ? [] : ''),
              label: tr(f.label, DEFAULT_LANG, { company: 'the team' }),
              text: renderAnswer(f.id, candidate.answers || {}, DEFAULT_LANG),
            }
          : {}),
      })),
    }))
    .filter((g) => g.items.length);
}

async function applicationOf(db, member) {
  if (!member?.telegram) return null;
  const target = nick(member.telegram);
  const all = await candidates.all(db);
  return all.find((c) => nick(c.answers?.telegram) === target || nick(c.username) === target) || null;
}

/* ---------------------------------- router --------------------------------- */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const tg = new Telegram(env.BOT_TOKEN);

    try {
      /* ----------------------------- Telegram webhook ---------------------------- */
      if (path === '/webhook' && request.method === 'POST') {
        if (request.headers.get('x-telegram-bot-api-secret-token') !== env.WEBHOOK_SECRET) {
          return new Response('forbidden', { status: 403 });
        }
        const update = await request.json();
        ctx.waitUntil(handleUpdate(env, tg, update).catch((err) => console.error('update:', err.stack || err)));
        return new Response('ok');
      }

      /* -------------------------------- forma API -------------------------------- */
      if (path === '/api/schema') {
        const lang = langOf(url.searchParams.get('lang'));
        return json({ ...schemaFor(lang, { company: company(env) }), ui: uiStrings(lang), company: company(env), langs: LANGS });
      }

      if (path === '/api/my-application' && request.method === 'POST') {
        const { initData } = await request.json();
        const user = await verifyInitData(initData, env.BOT_TOKEN);
        if (!user) return json({ ok: true, application: null, hired: false });

        const previous = (await candidates.byTelegramId(env.DB, user.id))[0];
        const hired = await hiredNicks(env.DB);
        const mine = [user.username, previous?.username, previous?.answers?.telegram].map(nick).filter(Boolean);
        if (mine.some((n) => hired.has(n))) return json({ ok: true, application: null, hired: true });
        if (!previous) return json({ ok: true, application: null, hired: false });

        return json({
          ok: true,
          hired: false,
          application: {
            id: previous.id,
            createdAt: previous.createdAt,
            answers: previous.answers,
            cvFileName: previous.cv?.fileName || null,
          },
        });
      }

      if (path === '/api/check-telegram' && request.method === 'POST') {
        const body = await request.json();
        const user = await verifyInitData(body.initData, env.BOT_TOKEN);
        const target = validNick(body.telegram);
        if (!target) return json({ ok: true, valid: false, taken: false });

        const all = await candidates.all(env.DB);
        const taken = all.some(
          (c) => String(c.telegramId) !== String(user?.id) && (nick(c.answers?.telegram) === target || nick(c.username) === target)
        );
        return json({ ok: true, valid: true, taken });
      }

      if (path === '/api/apply' && request.method === 'POST') {
        const form = await request.formData();
        const user = await verifyInitData(form.get('initData'), env.BOT_TOKEN);
        if (!user) return json({ ok: false, error: 'auth' }, 401);

        const lang = langOf(form.get('lang'));
        let answers = {};
        try {
          answers = JSON.parse(form.get('answers') || '{}');
        } catch {
          return json({ ok: false, error: 'answers' }, 400);
        }

        const { ok, errors, clean } = validate(answers);
        if (!ok) return json({ ok: false, error: 'validation', fields: errors }, 400);

        const previous = (await candidates.byTelegramId(env.DB, user.id))[0];

        const all = await candidates.all(env.DB);
        const target = nick(clean.telegram);
        if (all.some((c) => String(c.telegramId) !== String(user.id) && (nick(c.answers?.telegram) === target || nick(c.username) === target))) {
          return json({ ok: false, error: 'validation', fields: { telegram: 'taken' } }, 400);
        }

        const file = form.get('cv');
        if (!file?.size && !previous?.cv) return json({ ok: false, error: 'cv_required' }, 400);
        if (file?.size) {
          if (!CV_EXT.test(file.name)) return json({ ok: false, error: 'cv_type' }, 400);
          if (file.size > CV_MAX) return json({ ok: false, error: 'cv_size' }, 400);
        }

        let candidate = previous
          ? await candidates.update(env.DB, previous.id, { answers: clean, lang, username: user.username || null, editedAt: nowIso() })
          : await candidates.create(env.DB, { telegramId: user.id, username: user.username || null, lang, answers: clean });

        if (file?.size) {
          const key = `cv/${candidate.id}-${Date.now()}`;
          await env.FILES.put(key, await file.arrayBuffer());
          candidate = await candidates.update(env.DB, candidate.id, {
            cv: { fileName: file.name, key, size: file.size },
          });
        }

        await botUsers.set(env.DB, user.id, { lang });
        ctx.waitUntil(
          (async () => {
            await sendToGroup(env, tg, candidate, Boolean(previous));
            await tg.sendMessage(
              user.id,
              s(lang, previous ? 'updated' : 'received', { name: clean.fullName, id: candidate.id })
            );
          })().catch((err) => console.error('apply:', err.stack || err))
        );

        return json({ ok: true, id: candidate.id, updated: Boolean(previous) });
      }

      /* ------------------------------ ishchilar API ------------------------------ */
      if (path === '/api/staff/login' && request.method === 'POST') {
        const { username, password } = await request.json();
        const result = await staff.login(env.DB, username, password, env.BOT_TOKEN);
        if (!result.ok) return json(result, 401);
        return json({ ok: true, user: result.user, token: await signToken(result.raw, env.BOT_TOKEN) });
      }

      if (path.startsWith('/api/staff/')) {
        const me = await authOf(env, request, url);
        if (!me) return json({ ok: false, error: 'unauthorized' }, 401);
        const db = env.DB;

        // --- o'zi haqida
        if (path === '/api/staff/me' && request.method === 'GET') {
          const own = await applicationOf(db, me);
          return json({
            ok: true,
            user: me,
            password: await staff.password(db, me.username, env.BOT_TOKEN),
            application: own
              ? {
                  id: own.id,
                  createdAt: own.createdAt,
                  status: own.status,
                  hasCv: Boolean(own.cv),
                  cvFileName: own.cv?.fileName || null,
                  sections: answerGroups(own, { editable: true }).map((g) => ({ ...g, fields: g.items })),
                }
              : null,
            departments: departmentsList(),
            statuses: [
              { value: 'yangi', label: 'New' },
              { value: 'shortlist', label: 'Shortlisted' },
              { value: 'intervyu', label: 'Interview' },
              { value: 'qabul', label: 'Accepted' },
              { value: 'rad', label: 'Declined' },
            ],
          });
        }

        if (path === '/api/staff/me' && request.method === 'PATCH') {
          const body = await request.json();
          const patch = {};
          if (body.telegram !== undefined) patch.telegram = body.telegram;
          if (body.password !== undefined) {
            if (!String(body.password).length) return json({ ok: false, error: 'password_required' }, 400);
            patch.password = body.password;
          }
          if (!Object.keys(patch).length) return json({ ok: false, error: 'nothing_to_update' }, 400);

          try {
            const updated = await staff.update(db, me.username, patch, env.BOT_TOKEN);
            const raw = await staff.raw(db, me.username);
            return json({ ok: true, user: updated, token: patch.password ? await signToken(raw, env.BOT_TOKEN) : undefined });
          } catch (err) {
            return json({ ok: false, error: err.message }, 400);
          }
        }

        if (path === '/api/staff/me/application' && request.method === 'PATCH') {
          const own = await applicationOf(db, me);
          if (!own) return json({ ok: false, error: 'no_application' }, 404);

          const body = await request.json();
          const merged = { ...(own.answers || {}), ...(body.answers || {}) };
          const { ok, errors, clean } = validate(merged);
          if (!ok) return json({ ok: false, error: 'validation', fields: errors }, 400);

          const updated = await candidates.update(db, own.id, { answers: clean, editedAt: nowIso() });
          return json({
            ok: true,
            application: {
              id: updated.id,
              createdAt: updated.createdAt,
              status: updated.status,
              hasCv: Boolean(updated.cv),
              cvFileName: updated.cv?.fileName || null,
              sections: answerGroups(updated, { editable: true }).map((g) => ({ ...g, fields: g.items })),
            },
          });
        }

        // --- profil rasmi
        if (path === '/api/staff/me/avatar' && request.method === 'POST') {
          const form = await request.formData();
          const photo = form.get('photo');
          if (!photo?.size) return json({ ok: false, error: 'photo_required' }, 400);

          const ext = AVATAR_TYPES[photo.type];
          if (!ext) return json({ ok: false, error: 'photo_type' }, 400);
          if (photo.size > AVATAR_MAX) return json({ ok: false, error: 'photo_size' }, 400);

          const current = await staff.raw(db, me.username);
          if (current?.avatar) await env.FILES.delete(current.avatar);

          const key = `avatar/${me.username}-${Date.now()}.${ext}`;
          await env.FILES.put(key, await photo.arrayBuffer(), { metadata: { type: photo.type } });
          return json({ ok: true, user: await staff.update(db, me.username, { avatar: key }, env.BOT_TOKEN) });
        }

        if (path === '/api/staff/me/avatar' && request.method === 'DELETE') {
          const current = await staff.raw(db, me.username);
          if (current?.avatar) await env.FILES.delete(current.avatar);
          return json({ ok: true, user: await staff.update(db, me.username, { avatar: null }, env.BOT_TOKEN) });
        }

        const avatarMatch = path.match(/^\/api\/staff\/avatar\/(.+)$/);
        if (avatarMatch) {
          const target = await staff.raw(db, decodeURIComponent(avatarMatch[1]));
          if (!target?.avatar) return new Response(null, { status: 404 });

          const file = await env.FILES.getWithMetadata(target.avatar, 'arrayBuffer');
          if (!file?.value) return new Response(null, { status: 404 });
          return new Response(file.value, {
            headers: { 'Content-Type': file.metadata?.type || 'image/jpeg', 'Cache-Control': 'public, max-age=86400' },
          });
        }

        // --- nomzodlar
        if (path === '/api/staff/candidates') {
          if (!me.permissions.viewCandidates) return json({ ok: false, error: 'forbidden' }, 403);

          const q = (url.searchParams.get('q') || '').trim().toLowerCase();
          const dept = url.searchParams.get('dept') || '';
          const hired = await hiredNicks(db);

          const items = (await candidates.all(db))
            .filter((c) => !isHired(c, hired))
            .filter((c) => allowedFor(me, c))
            .filter((c) => (dept ? deptsOf(c).includes(dept) : true))
            .filter((c) => {
              if (!q) return true;
              const a = c.answers || {};
              const fields = deptsOf(c).map((v) => departmentsList().find((d) => d.value === v)?.label || v);
              return [c.id, a.fullName, a.city, ...fields, me.permissions.viewContacts ? a.telegram : '', me.permissions.viewContacts ? a.phone : '', me.permissions.viewContacts ? a.email : '']
                .join(' ')
                .toLowerCase()
                .includes(q);
            })
            .map((c) => briefOf(c, me));

          return json({ ok: true, total: items.length, items });
        }

        const cvMatch = path.match(/^\/api\/staff\/candidates\/([^/]+)\/cv$/);
        if (cvMatch) {
          if (!me.permissions.downloadCv) return json({ ok: false, error: 'forbidden' }, 403);
          const candidate = await candidates.byId(db, decodeURIComponent(cvMatch[1]));
          if (!candidate || !allowedFor(me, candidate) || !candidate.cv?.key) return new Response(null, { status: 404 });

          const file = await env.FILES.get(candidate.cv.key, 'arrayBuffer');
          if (!file) return new Response(null, { status: 404 });
          return new Response(file, {
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Disposition': `attachment; filename="${candidate.cv.fileName || 'resume'}"`,
            },
          });
        }

        const detailMatch = path.match(/^\/api\/staff\/candidates\/([^/]+)$/);
        if (detailMatch) {
          if (!me.permissions.viewCandidates) return json({ ok: false, error: 'forbidden' }, 403);
          const candidate = await candidates.byId(db, decodeURIComponent(detailMatch[1]));
          if (!candidate || !allowedFor(me, candidate)) return json({ ok: false, error: 'not_found' }, 404);

          return json({
            ok: true,
            candidate: {
              ...briefOf(candidate, me),
              groups: answerGroups(candidate),
              answered: 0,
              canDownloadCv: me.permissions.downloadCv,
            },
          });
        }

        // --- hisoblar
        const canManage = async (target) => {
          if (me.permissions.manageStaff) return true;
          const other = await staff.get(db, target);
          return Boolean(other && me.permissions.addWorkers && other.specialist === me.username);
        };

        const withCounts = async (u) => {
          const hired = await hiredNicks(db);
          const all = await candidates.all(db);
          return {
            ...u,
            assignedCount: all.filter((c) => !isHired(c, hired) && allowedFor(u, c)).length,
            workerCount: (await staff.workersOf(db, u.username)).length,
          };
        };

        if (path === '/api/staff/users' && request.method === 'GET') {
          if (!me.permissions.manageStaff && !me.permissions.addWorkers) return json({ ok: false, error: 'forbidden' }, 403);
          const list = me.permissions.manageStaff ? await staff.list(db) : await staff.workersOf(db, me.username);
          return json({ ok: true, users: await Promise.all(list.map(withCounts)), departments: departmentsList() });
        }

        if (path === '/api/staff/users' && request.method === 'POST') {
          if (!me.permissions.manageStaff && !me.permissions.addWorkers) return json({ ok: false, error: 'forbidden' }, 403);
          const body = await request.json();
          const isAdmin = me.permissions.manageStaff;
          const kind = isAdmin ? (body.kind === 'specialist' ? 'specialist' : 'worker') : 'worker';

          let departments = body.permissions?.departments || [];
          let owner = null;

          if (!isAdmin) {
            owner = me.username;
            departments = me.permissions.departments || [];
          } else if (kind === 'worker') {
            const parent = await staff.get(db, body.specialist);
            if (!parent || parent.kind !== 'specialist') return json({ ok: false, error: 'specialist_required' }, 400);
            owner = parent.username;
            departments = parent.permissions.departments || [];
          }

          try {
            const created = await staff.create(db, {
              username: body.username,
              password: body.password,
              telegram: body.telegram,
              kind,
              specialist: owner,
              departments,
              createdBy: me.username,
              botToken: env.BOT_TOKEN,
            });
            return json({ ok: true, user: created });
          } catch (err) {
            return json({ ok: false, error: err.message }, 400);
          }
        }

        const userMatch = path.match(/^\/api\/staff\/users\/([^/]+)$/);
        if (userMatch) {
          const target = decodeURIComponent(userMatch[1]);
          if (!(await canManage(target))) return json({ ok: false, error: 'forbidden' }, 403);

          if (request.method === 'GET') {
            const member = await staff.get(db, target);
            if (!member) return json({ ok: false, error: 'not_found' }, 404);

            const own = await applicationOf(db, member);
            return json({
              ok: true,
              member: await withCounts(member),
              password: await staff.password(db, member.username, env.BOT_TOKEN),
              workers: await Promise.all((await staff.workersOf(db, member.username)).map(withCounts)),
              application: own
                ? {
                    id: own.id,
                    createdAt: own.createdAt,
                    status: own.status,
                    fullName: own.answers?.fullName || '',
                    hasCv: Boolean(own.cv),
                    cvFileName: own.cv?.fileName || null,
                    groups: answerGroups(own),
                  }
                : null,
              departments: departmentsList(),
            });
          }

          if (request.method === 'PATCH') {
            const body = await request.json();
            try {
              let name = target;
              if (body.username && body.username.toLowerCase() !== target.toLowerCase()) {
                const renamed = await staff.rename(db, target, body.username);
                if (!renamed) return json({ ok: false, error: 'not_found' }, 404);
                name = renamed.username;
              }
              const patch = {};
              if (body.password !== undefined) patch.password = body.password;
              if (body.telegram !== undefined) patch.telegram = body.telegram;
              if (body.active !== undefined) patch.active = body.active;
              if (body.permissions?.departments && me.permissions.manageStaff) patch.departments = body.permissions.departments;

              const updated = await staff.update(db, name, patch, env.BOT_TOKEN);
              return json({ ok: true, user: updated });
            } catch (err) {
              return json({ ok: false, error: err.message }, 400);
            }
          }

          if (request.method === 'DELETE') {
            if (target.toLowerCase() === me.username) return json({ ok: false, error: 'self_delete' }, 400);
            const removed = await staff.remove(db, target);
            return removed ? json({ ok: true }) : json({ ok: false, error: 'not_removable' }, 400);
          }
        }

        return json({ ok: false, error: 'not_found' }, 404);
      }

      /* ------------------------------- statik fayllar ----------------------------- */
      if (path === '/staff') return Response.redirect(url.origin + '/staff.html', 302);

      const asset = await env.ASSETS.fetch(request);
      if (/\.(html|css|js)$/.test(path) || path === '/') {
        const headers = new Headers(asset.headers);
        headers.set('Cache-Control', 'no-store');
        return new Response(asset.body, { status: asset.status, headers });
      }
      return asset;
    } catch (err) {
      console.error('worker:', err.stack || err);
      return json({ ok: false, error: 'server' }, 500);
    }
  },
};
