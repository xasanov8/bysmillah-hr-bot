# Bysmillah HR bot

Telegram bot va Mini App: nomzodlardan ariza yig'adi, rezyume qabul qiladi va HR jamoasi uchun boshqaruv bo'limini beradi. Butunlay Cloudflare Workers'da ishlaydi — server ham, doimiy ishlab turadigan kompyuter ham kerak emas.

Bot: [@bysmillah_hr_bot](https://t.me/bysmillah_hr_bot)

## Nima qiladi

**Nomzod uchun** — Telegram ichida ochiladigan forma: 6 bosqich, 16 ta savol va rezyume yuklash. O'zbek va ingliz tillarida. Ilgari ariza topshirgan odam formani ochsa, javoblari to'ldirilgan holda chiqadi va yangilab qayta yuborishi mumkin. Ishga olingan odam esa to'g'ridan-to'g'ri xodimlar bo'limiga o'tkaziladi.

**HR uchun** — login bilan kiriladigan bo'lim: nomzodlar ro'yxati, qidiruv va filtr, rezyume yuklab olish, xodim hisoblarini ochish va ularga soha biriktirish.

**Telegram guruhida** — har bir ariza karta bo'lib tushadi, ostida to'rtta tugma: Shortlist, Suhbatga taklif, Qabul qilish, Rad javobi. Oxirgi uchtasi nomzodga tilida yozilgan xushmuomala xabar yuboradi.

Batafsil: [QOLLANMA.txt](QOLLANMA.txt)

## Hisob turlari

| Tur | Ko'radi | Qila oladi |
|---|---|---|
| Admin | hammasini | mutaxassis va ishchi hisoblarini ochadi |
| Mutaxassis | o'z sohasidagi nomzodlarni | o'ziga ishchi qo'shadi |
| Ishchi | faqat o'z profilini | ariza javoblarini va rezyumesini yangilaydi |

## Texnik tuzilishi

| Qism | Nima ishlatiladi |
|---|---|
| Ishga tushirish | Cloudflare Workers |
| Baza | D1 (SQLite) — arizalar, hisoblar, sozlamalar |
| Fayllar | KV — rezyumelar va profil rasmlari |
| Telegram | webhook (long polling emas) |
| Parollar | PBKDF2 (WebCrypto), tokenlar HMAC bilan imzolanadi |
| Forma va bo'lim | sof HTML/CSS/JS, ramkasiz |

```
src/index.js      barcha yo'nalishlar va bot mantig'i
src/db.js         D1 ustidagi ma'lumot qatlami
src/crypto.js     parol, shifrlash, initData tekshiruvi
src/telegram.js   Telegram API mijozi
src/questions.js  savollar — forma, guruh xabari va CSV shu yerdan quriladi
src/i18n.js       barcha matnlar (uz / ru / en)
public/           ariza formasi va xodimlar bo'limi
schema.sql        D1 jadvallari
```

## Ishga tushirish

```bash
npm install
cp .dev.vars.example .dev.vars      # tokenlarni yozing

npx wrangler d1 create bysmillah-hr        # id ni wrangler.toml ga qo'ying
npx wrangler kv namespace create FILES     # id ni wrangler.toml ga qo'ying
npx wrangler d1 execute bysmillah-hr --remote --file=./schema.sql

npx wrangler secret put BOT_TOKEN
npx wrangler secret put WEBHOOK_SECRET
npx wrangler deploy
```

So'ng Telegram webhook'ini ulang:

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=<WORKER_URL>/webhook&secret_token=<WEBHOOK_SECRET>
```

Mahalliy sinash uchun `npx wrangler dev --local` — D1 va KV kompyuterda taqlid qilinadi.

## Savollarni o'zgartirish

Barcha savollar [`src/questions.js`](src/questions.js) da. Yangi savol qo'shsangiz, forma ham, guruh xabari ham, xodimlar bo'limi ham avtomatik yangilanadi.

## Xavfsizlik

- Parollar hashlanadi, ochiq matnda saqlanmaydi
- Ruxsat cheklovi serverda: begona sohadagi nomzodni havola bilan ham ochib bo'lmaydi
- Webhook maxfiy kalit bilan himoyalangan
- Mini App'dan kelgan har bir so'rov Telegram imzosi bilan tekshiriladi
