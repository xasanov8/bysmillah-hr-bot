// Workers'da Node'ning crypto moduli yo'q — hammasi WebCrypto orqali.
// scrypt mavjud emas, shuning uchun parollar PBKDF2 bilan hashlanadi.

const enc = new TextEncoder();
const dec = new TextDecoder();

const PBKDF2_ITERATIONS = 25000; // Workers bepul tarifidagi CPU chekloviga mos
const KEY_BITS = 256;

const toHex = (buffer) =>
  [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

const fromHex = (hex) =>
  new Uint8Array((hex.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16)));

export const randomHex = (bytes = 16) => toHex(crypto.getRandomValues(new Uint8Array(bytes)));

export const b64url = (buffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export const fromB64url = (text) => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

/* --------------------------------- parollar -------------------------------- */

export async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    KEY_BITS
  );
  return toHex(bits);
}

export function sameHash(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ---------------------- parolning ko'rsatiladigan nusxasi --------------------- */

async function aesKey(botToken) {
  const material = await crypto.subtle.digest('SHA-256', enc.encode(String(botToken) + ':pw'));
  return crypto.subtle.importKey('raw', material, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptPassword(password, botToken) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await aesKey(botToken);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(String(password)));
  return `${b64url(iv)}.${b64url(data)}`;
}

export async function decryptPassword(blob, botToken) {
  try {
    const [iv, data] = String(blob || '').split('.');
    if (!iv || !data) return null;
    const key = await aesKey(botToken);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64url(iv) }, key, fromB64url(data));
    return dec.decode(plain);
  } catch {
    return null;
  }
}

/* ----------------------------------- HMAC ---------------------------------- */

async function hmacKey(secret) {
  const raw = typeof secret === 'string' ? enc.encode(secret) : secret;
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

export async function hmacHex(secret, data) {
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(data));
  return toHex(signature);
}

export async function hmacRaw(secret, data) {
  return new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(data)));
}

/* ------------------------- Telegram initData tekshiruvi ------------------------ */

export async function verifyInitData(initData, botToken, maxAgeSec = 24 * 60 * 60) {
  if (!initData || typeof initData !== 'string') return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const entries = [...params.entries()];
  const secret = await hmacRaw('WebAppData', botToken);

  // `signature` maydoni mijoz versiyasiga qarab hash hisobiga kirishi mumkin
  const variants = [entries.filter(([k]) => k !== 'signature'), entries];

  let matched = false;
  for (const variant of variants) {
    const check = [...variant]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    if (sameHash(await hmacHex(secret, check), hash)) {
      matched = true;
      break;
    }
  }
  if (!matched) return null;

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null;

  try {
    const user = JSON.parse(params.get('user') || 'null');
    return user?.id ? user : null;
  } catch {
    return null;
  }
}

/* ------------------------- ishchilar bo'limi tokenlari ------------------------ */

const TOKEN_TTL_SEC = 12 * 60 * 60;

export async function signToken(user, botToken) {
  const payload = b64url(
    enc.encode(JSON.stringify({ u: user.username, v: user.token_version || 1, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC }))
  );
  const secret = await crypto.subtle.digest('SHA-256', enc.encode(String(botToken) + ':staff'));
  return `${payload}.${await hmacHex(new Uint8Array(secret), payload)}`;
}

export async function readToken(token, botToken) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');

  const secret = await crypto.subtle.digest('SHA-256', enc.encode(String(botToken) + ':staff'));
  if (!sameHash(await hmacHex(new Uint8Array(secret), payload), signature)) return null;

  try {
    const data = JSON.parse(dec.decode(fromB64url(payload)));
    return data.exp && data.exp >= Math.floor(Date.now() / 1000) ? data : null;
  } catch {
    return null;
  }
}
