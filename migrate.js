// Hozirgi botdagi ma'lumotlarni Cloudflare uchun tayyorlaydi:
//   migration.sql   — D1 ga yuklanadigan SQL
//   files.json      — KV ga yuklanadigan fayllar ro'yxati
//
// Parollar scrypt'dan PBKDF2 ga o'tkaziladi. Ochiq nusxasi saqlangan hisoblar
// avtomatik ko'chadi, qolganlariga yangi parol beriladi va ekranga chiqariladi.

import fs from 'node:fs';
import path from 'node:path';
import nodeCrypto from 'node:crypto';
import { hashPassword, encryptPassword, randomHex } from './src/crypto.js';

const OLD = path.join('..', 'hr-bot', 'data');
const readJson = (name, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(OLD, name), 'utf8'));
  } catch {
    return fallback;
  }
};

const env = Object.fromEntries(
  fs
    .readFileSync(path.join('..', 'hr-bot', '.env'), 'utf8')
    .split('\n')
    .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
    .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()])
);

const BOT_TOKEN = env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error('BOT_TOKEN topilmadi');

// Eski tizimdagi shifrlangan parolni ochish (Node aes-256-gcm)
function decryptOld(blob) {
  try {
    const [iv, tag, data] = String(blob || '').split('.');
    if (!iv || !tag || !data) return null;
    const key = nodeCrypto.createHash('sha256').update(BOT_TOKEN + ':pw').digest();
    const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

const q = (value) => (value === null || value === undefined ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`);

const lines = ['-- Bysmillah HR — ma\'lumotlarni ko\'chirish', 'PRAGMA foreign_keys = OFF;', ''];
const files = [];
const newPasswords = [];

/* --------------------------------- nomzodlar -------------------------------- */

const candidates = readJson('candidates.json', []);
for (const c of candidates) {
  const cvKey = c.cv?.path ? `cv/${c.id}-${Date.now()}${path.extname(c.cv.fileName || '.pdf')}` : null;
  if (cvKey && fs.existsSync(c.cv.path)) files.push({ key: cvKey, file: path.resolve(c.cv.path) });

  lines.push(
    `INSERT OR REPLACE INTO candidates (id, telegram_id, username, lang, answers, cv_name, cv_key, cv_size, status, status_by, status_at, notified, group_msg_id, created_at, edited_at) VALUES (` +
      [
        q(c.id),
        q(c.telegramId),
        q(c.username),
        q(c.lang || 'en'),
        q(JSON.stringify(c.answers || {})),
        q(c.cv?.fileName),
        q(cvKey),
        c.cv?.size || 'NULL',
        q(c.status || 'yangi'),
        q(c.statusBy),
        q(c.statusAt),
        q(JSON.stringify(c.notified || [])),
        c.groupMessageId || 'NULL',
        q(c.createdAt),
        q(c.editedAt),
      ].join(', ') +
      ');'
  );
}

/* ---------------------------------- xodimlar -------------------------------- */

const staffData = readJson('staff.json', {});
for (const [username, u] of Object.entries(staffData)) {
  let password = decryptOld(u.secret);
  if (!password) {
    password = username === '1' ? '1' : randomHex(4);
    newPasswords.push({ username, password });
  }

  const salt = randomHex(16);
  const hash = await hashPassword(password, salt);
  const secret = await encryptPassword(password, BOT_TOKEN);

  const kind = u.role === 'admin' ? 'admin' : u.kind || ((u.permissions?.departments || []).length ? 'specialist' : 'worker');

  const avatarKey = u.avatar ? `avatar/${username}-${Date.now()}${path.extname(u.avatar)}` : null;
  const avatarPath = u.avatar ? path.join(OLD, 'avatars', u.avatar) : null;
  if (avatarKey && avatarPath && fs.existsSync(avatarPath)) files.push({ key: avatarKey, file: path.resolve(avatarPath) });

  lines.push(
    `INSERT OR REPLACE INTO staff (username, telegram, role, kind, specialist, departments, salt, hash, secret, avatar_key, active, token_version, created_at, created_by, last_login_at) VALUES (` +
      [
        q(username),
        q(u.telegram || ''),
        q(u.role || 'staff'),
        q(kind),
        q(kind === 'worker' ? u.specialist || u.createdBy || '' : null),
        q(JSON.stringify(u.permissions?.departments || [])),
        q(salt),
        q(hash),
        q(secret),
        q(avatarKey),
        u.active === false ? 0 : 1,
        1,
        q(u.createdAt || new Date().toISOString()),
        q(u.createdBy),
        q(u.lastLoginAt),
      ].join(', ') +
      ');'
  );
}

/* ------------------------- foydalanuvchilar va sozlamalar ---------------------- */

for (const [id, u] of Object.entries(readJson('users.json', {}))) {
  lines.push(
    `INSERT OR REPLACE INTO bot_users (telegram_id, lang, welcome_message_id) VALUES (${q(id)}, ${q(u.lang)}, ${u.welcomeMessageId || 'NULL'});`
  );
}

const config = readJson('config.json', {});
if (config.hrGroupId) lines.push(`INSERT OR REPLACE INTO settings (key, value) VALUES ('group_id', ${q(config.hrGroupId)});`);
if (config.admins?.length) {
  lines.push(`INSERT OR REPLACE INTO settings (key, value) VALUES ('admins', ${q(JSON.stringify(config.admins))});`);
}

fs.writeFileSync('migration.sql', lines.join('\n') + '\n', 'utf8');
fs.writeFileSync('files.json', JSON.stringify(files, null, 2), 'utf8');

console.log(`migration.sql  — ${candidates.length} ta nomzod, ${Object.keys(staffData).length} ta hisob`);
console.log(`files.json     — ${files.length} ta fayl KV ga yuklanadi`);
if (newPasswords.length) {
  console.log('\nYangi parol berilgan hisoblar (eskisini tiklab bo\'lmadi):');
  for (const { username, password } of newPasswords) console.log(`   ${username} → ${password}`);
}
