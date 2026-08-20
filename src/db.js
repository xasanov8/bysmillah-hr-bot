// D1 (SQLite) ustidagi ma'lumot qatlami — hozirgi botdagi storage/staff/config
// modullarining o'rnini bosadi. Fayllar (rezyume, rasm) KV da saqlanadi.

import { hashPassword, sameHash, randomHex, encryptPassword, decryptPassword } from './crypto.js';

const json = (value, fallback) => {
  try {
    return JSON.parse(value ?? '');
  } catch {
    return fallback;
  }
};

const nowIso = () => new Date().toISOString();

/* -------------------------------- nomzodlar -------------------------------- */

function candidateFrom(row) {
  if (!row) return null;
  return {
    id: row.id,
    telegramId: row.telegram_id,
    username: row.username,
    lang: row.lang,
    answers: json(row.answers, {}),
    cv: row.cv_key ? { fileName: row.cv_name, key: row.cv_key, size: row.cv_size } : null,
    status: row.status,
    statusBy: row.status_by,
    statusAt: row.status_at,
    notified: json(row.notified, []),
    groupMessageId: row.group_msg_id,
    createdAt: row.created_at,
    editedAt: row.edited_at,
  };
}

export const candidates = {
  async all(db) {
    const { results } = await db.prepare('SELECT * FROM candidates ORDER BY created_at DESC').all();
    return results.map(candidateFrom);
  },

  async byId(db, id) {
    return candidateFrom(await db.prepare('SELECT * FROM candidates WHERE id = ?').bind(id).first());
  },

  async byTelegramId(db, telegramId) {
    const { results } = await db
      .prepare('SELECT * FROM candidates WHERE telegram_id = ? ORDER BY created_at DESC')
      .bind(String(telegramId))
      .all();
    return results.map(candidateFrom);
  },

  // Eng katta raqamdan keyingisi. COUNT(*) ishlatib bo'lmaydi: o'chirilgan
  // arizalardan keyin u mavjud ID bilan to'qnashadi.
  async nextId(db, offset = 0) {
    const row = await db
      .prepare("SELECT id FROM candidates WHERE id LIKE 'A-%' ORDER BY CAST(SUBSTR(id, 3) AS INTEGER) DESC LIMIT 1")
      .first();
    const last = Number(String(row?.id || '').slice(2));
    return 'A-' + String((Number.isFinite(last) ? last : 0) + 1 + offset).padStart(4, '0');
  },

  async create(db, data) {
    // Bir vaqtda ikki ariza kelsa ID band bo'lishi mumkin — keyingisini olamiz
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const id = await candidates.nextId(db, attempt);
      try {
        await db
          .prepare(
            `INSERT INTO candidates (id, telegram_id, username, lang, answers, cv_name, cv_key, cv_size, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'yangi', ?)`
          )
          .bind(
            id,
            String(data.telegramId),
            data.username || null,
            data.lang || 'en',
            JSON.stringify(data.answers || {}),
            data.cv?.fileName || null,
            data.cv?.key || null,
            data.cv?.size || null,
            nowIso()
          )
          .run();
        return candidates.byId(db, id);
      } catch (err) {
        if (attempt === 4 || !/UNIQUE|PRIMARY KEY|constraint/i.test(String(err?.message || err))) throw err;
      }
    }
  },

  async update(db, id, patch) {
    const map = {
      answers: ['answers', (v) => JSON.stringify(v)],
      lang: ['lang', (v) => v],
      username: ['username', (v) => v],
      status: ['status', (v) => v],
      statusBy: ['status_by', (v) => v],
      statusAt: ['status_at', (v) => v],
      notified: ['notified', (v) => JSON.stringify(v)],
      groupMessageId: ['group_msg_id', (v) => v],
      editedAt: ['edited_at', (v) => v],
    };

    const sets = [];
    const values = [];
    for (const [key, value] of Object.entries(patch)) {
      if (key === 'cv') {
        sets.push('cv_name = ?', 'cv_key = ?', 'cv_size = ?');
        values.push(value?.fileName || null, value?.key || null, value?.size || null);
        continue;
      }
      const target = map[key];
      if (!target) continue;
      sets.push(`${target[0]} = ?`);
      values.push(target[1](value));
    }
    if (!sets.length) return candidates.byId(db, id);

    await db.prepare(`UPDATE candidates SET ${sets.join(', ')} WHERE id = ?`).bind(...values, id).run();
    return candidates.byId(db, id);
  },

  async remove(db, id) {
    const target = await candidates.byId(db, id);
    if (target) await db.prepare('DELETE FROM candidates WHERE id = ?').bind(id).run();
    return target;
  },
};

/* --------------------------------- xodimlar -------------------------------- */

const KINDS = ['admin', 'specialist', 'worker'];

const PERMISSIONS = {
  admin: { viewCandidates: true, viewContacts: true, downloadCv: true, addWorkers: true, manageStaff: true },
  specialist: { viewCandidates: true, viewContacts: true, downloadCv: true, addWorkers: true, manageStaff: false },
  worker: { viewCandidates: false, viewContacts: false, downloadCv: false, addWorkers: false, manageStaff: false },
};

export function staffFrom(row) {
  if (!row) return null;
  const kind = KINDS.includes(row.kind) ? row.kind : 'worker';
  return {
    username: row.username,
    telegram: row.telegram || '',
    role: row.role,
    kind,
    specialist: kind === 'worker' ? row.specialist || '' : '',
    avatar: row.avatar_key || null,
    active: row.active !== 0,
    permissions: { ...PERMISSIONS[kind], departments: json(row.departments, []) },
    createdAt: row.created_at,
    createdBy: row.created_by,
    lastLoginAt: row.last_login_at,
    tokenVersion: row.token_version,
    // faqat ichkarida ishlatiladi
    _salt: row.salt,
    _hash: row.hash,
    _secret: row.secret,
  };
}

const publicStaff = (user) => {
  if (!user) return null;
  const { _salt, _hash, _secret, tokenVersion, ...rest } = user;
  return rest;
};

const nickKey = (value) => String(value || '').trim().replace(/^@+/, '').toLowerCase();

export const staff = {
  async raw(db, username) {
    return staffFrom(
      await db.prepare('SELECT * FROM staff WHERE username = ?').bind(String(username || '').toLowerCase()).first()
    );
  },

  async get(db, username) {
    return publicStaff(await staff.raw(db, username));
  },

  async list(db) {
    const { results } = await db.prepare('SELECT * FROM staff').all();
    const order = { admin: 0, specialist: 1, worker: 2 };
    return results
      .map(staffFrom)
      .map(publicStaff)
      .sort((a, b) => order[a.kind] - order[b.kind] || a.username.localeCompare(b.username));
  },

  async workersOf(db, username) {
    const { results } = await db
      .prepare("SELECT * FROM staff WHERE kind = 'worker' AND specialist = ?")
      .bind(String(username).toLowerCase())
      .all();
    return results.map(staffFrom).map(publicStaff).sort((a, b) => a.username.localeCompare(b.username));
  },

  async create(db, { username, password, telegram, role = 'staff', kind = 'worker', specialist, departments = [], createdBy, botToken }) {
    const id = String(username || '').trim().toLowerCase();
    if (!id) throw new Error('username_required');
    if (!/^[a-z0-9._-]{1,32}$/.test(id)) throw new Error('username_invalid');
    if (!password || !String(password).length) throw new Error('password_required');

    const nick = nickKey(telegram);
    if (role !== 'admin' && !/^[a-z0-9_]{4,32}$/.test(nick)) {
      throw new Error(nick ? 'telegram_invalid' : 'telegram_required');
    }

    const finalKind = role === 'admin' ? 'admin' : KINDS.includes(kind) ? kind : 'worker';
    if (finalKind === 'specialist' && !departments.length) throw new Error('department_required');

    if (await staff.raw(db, id)) throw new Error('username_taken');

    const salt = randomHex(16);
    await db
      .prepare(
        `INSERT INTO staff (username, telegram, role, kind, specialist, departments, salt, hash, secret, created_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        nick,
        role,
        finalKind,
        finalKind === 'worker' ? String(specialist || createdBy || '').toLowerCase() : null,
        JSON.stringify(departments),
        salt,
        await hashPassword(password, salt),
        await encryptPassword(password, botToken),
        nowIso(),
        createdBy || null
      )
      .run();

    return staff.get(db, id);
  },

  async update(db, username, patch, botToken) {
    const user = await staff.raw(db, username);
    if (!user) return null;

    const sets = [];
    const values = [];

    if (patch.password) {
      const salt = randomHex(16);
      sets.push('salt = ?', 'hash = ?', 'secret = ?', 'token_version = token_version + 1');
      values.push(salt, await hashPassword(patch.password, salt), await encryptPassword(patch.password, botToken));
    }
    if (patch.telegram !== undefined) {
      const nick = nickKey(patch.telegram);
      if (nick && !/^[a-z0-9_]{4,32}$/.test(nick)) throw new Error('telegram_invalid');
      sets.push('telegram = ?');
      values.push(nick);
    }
    if (patch.departments && user.role !== 'admin') {
      sets.push('departments = ?');
      values.push(JSON.stringify(patch.departments));
    }
    if (patch.avatar !== undefined) {
      sets.push('avatar_key = ?');
      values.push(patch.avatar || null);
    }
    if (patch.active !== undefined && user.role !== 'admin') {
      sets.push('active = ?');
      values.push(patch.active ? 1 : 0);
    }
    if (patch.lastLoginAt) {
      sets.push('last_login_at = ?');
      values.push(patch.lastLoginAt);
    }
    if (!sets.length) return publicStaff(user);

    await db.prepare(`UPDATE staff SET ${sets.join(', ')} WHERE username = ?`).bind(...values, user.username).run();
    return staff.get(db, user.username);
  },

  async rename(db, oldName, newName) {
    const from = String(oldName).toLowerCase();
    const to = String(newName || '').trim().toLowerCase();

    if (!to) throw new Error('username_required');
    if (!/^[a-z0-9._-]{1,32}$/.test(to)) throw new Error('username_invalid');
    if (from === to) return staff.get(db, from);
    if (await staff.raw(db, to)) throw new Error('username_taken');
    if (!(await staff.raw(db, from))) return null;

    await db.batch([
      db.prepare('UPDATE staff SET username = ?, token_version = token_version + 1 WHERE username = ?').bind(to, from),
      db.prepare('UPDATE staff SET specialist = ? WHERE specialist = ?').bind(to, from),
      db.prepare('UPDATE staff SET created_by = ? WHERE created_by = ?').bind(to, from),
    ]);
    return staff.get(db, to);
  },

  async remove(db, username) {
    const user = await staff.raw(db, username);
    if (!user || user.role === 'admin') return false;
    await db.prepare('DELETE FROM staff WHERE username = ?').bind(user.username).run();
    return true;
  },

  async password(db, username, botToken) {
    const user = await staff.raw(db, username);
    return user?._secret ? decryptPassword(user._secret, botToken) : null;
  },

  async login(db, username, password, botToken) {
    const user = await staff.raw(db, username);
    if (!user || !user.active) return { ok: false, error: 'invalid' };
    if (!sameHash(user._hash, await hashPassword(password, user._salt))) return { ok: false, error: 'invalid' };

    // Eski hisoblarda parolning ko'rsatiladigan nusxasi bo'lmasa — shu yerda saqlaymiz
    const sets = ['last_login_at = ?'];
    const values = [nowIso()];
    if (!user._secret) {
      sets.push('secret = ?');
      values.push(await encryptPassword(password, botToken));
    }
    await db.prepare(`UPDATE staff SET ${sets.join(', ')} WHERE username = ?`).bind(...values, user.username).run();

    return { ok: true, user: publicStaff(await staff.raw(db, user.username)), raw: await staff.raw(db, user.username) };
  },

  // Birinchi ishga tushirishda admin hisobi yaratiladi
  async ensureAdmin(db, botToken) {
    const row = await db.prepare('SELECT COUNT(*) AS n FROM staff').first();
    if (row?.n) return null;
    return staff.create(db, {
      username: '1',
      password: '1',
      role: 'admin',
      kind: 'admin',
      telegram: '',
      createdBy: 'system',
      botToken,
    });
  },
};

/* ------------------------- bot foydalanuvchilari ---------------------------- */

export const botUsers = {
  async get(db, telegramId) {
    return db.prepare('SELECT * FROM bot_users WHERE telegram_id = ?').bind(String(telegramId)).first();
  },

  async all(db) {
    const { results } = await db.prepare('SELECT * FROM bot_users').all();
    return results;
  },

  async set(db, telegramId, patch) {
    const id = String(telegramId);
    const current = (await botUsers.get(db, id)) || {};
    await db
      .prepare(
        `INSERT INTO bot_users (telegram_id, lang, welcome_message_id) VALUES (?, ?, ?)
         ON CONFLICT(telegram_id) DO UPDATE SET lang = excluded.lang, welcome_message_id = excluded.welcome_message_id`
      )
      .bind(
        id,
        patch.lang !== undefined ? patch.lang : current.lang || null,
        patch.welcomeMessageId !== undefined ? patch.welcomeMessageId : current.welcome_message_id || null
      )
      .run();
  },
};

/* --------------------------------- sozlamalar ------------------------------- */

export const settings = {
  async get(db, key) {
    const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
    return row?.value ?? null;
  },

  async set(db, key, value) {
    await db
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .bind(key, value === null ? null : String(value))
      .run();
  },

  async admins(db) {
    return json(await settings.get(db, 'admins'), []);
  },

  async addAdmin(db, telegramId) {
    const list = new Set(await settings.admins(db));
    list.add(String(telegramId));
    await settings.set(db, 'admins', JSON.stringify([...list]));
    return [...list];
  },
};
