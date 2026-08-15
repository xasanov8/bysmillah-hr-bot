// Interfeys matnlari va nomzodga yuboriladigan xabarlar — uch tilda.
// {company}, {name}, {contact}, {link}, {id} o'rinbosarlari almashtiriladi.

// Nomzodlar uchun yoqilgan tillar: ingliz va o'zbek.
// Rus tili matnlari quyida saqlanib turibdi — qaytarish uchun shu ro'yxatga
// { code: 'ru', ... } qatorini qo'shish va public/app.js dagi SUPPORTED ni yangilash kifoya.
const LANGS = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'uz', name: "O'zbekcha", native: "O'zbekcha" },
];

const DEFAULT_LANG = 'en';

const STRINGS = {
  uz: {
    // --- bot ---
    chooseLang: 'Tilni tanlang / Выберите язык / Choose a language',
    welcome:
      '{company} jamoasiga qo‘shilish uchun ariza\n\n' +
      'Quyidagi tugma orqali ariza formasi ochiladi. Bir necha savolga javob berasiz va rezyumeingizni yuklaysiz. Bu taxminan 10 daqiqa vaqt oladi.\n\n' +
      'Barcha arizalar HR bo‘limi tomonidan ko‘rib chiqiladi. Natija shu bot orqali sizga xabar qilinadi.',
    openForm: 'Ariza formasini ochish',
    menuButton: 'Ariza',
    changeLang: 'Tilni o‘zgartirish',
    notConfigured:
      'Ariza formasi hozircha texnik sozlanmoqda. Iltimos, birozdan so‘ng qayta urinib ko‘ring.',
    alreadyApplied:
      'Sizda avval yuborilgan ariza bor ({id}). Yangi ariza yuborsangiz, u alohida ariza sifatida qabul qilinadi.',
    received:
      'Rahmat, {name}. Arizangiz qabul qilindi.\n\nAriza raqami: {id}\n\n' +
      'Ma’lumotlaringiz va rezyumeingiz HR bo‘limiga yuborildi. Ko‘rib chiqilgach, natija shu bot orqali sizga ma’lum qilinadi.',
    updated:
      'Rahmat, {name}. Arizangiz yangilandi.\n\nAriza raqami: {id}\n\n' +
      'Yangilangan ma’lumotlaringiz HR bo‘limiga qayta yuborildi.',
    helpUser: '/start — ariza topshirish\n/til — tilni o‘zgartirish\n/id — chat ID',

    // --- nomzodga natija xabarlari ---
    interviewTitle: 'Suhbatga taklif',
    interview:
      'Hurmatli {name},\n\n' +
      '{company} jamoasiga bildirgan qiziqishingiz uchun minnatdormiz. Arizangiz va rezyumeingiz ko‘rib chiqildi va sizni jamoamiz bilan suhbatga taklif qilishdan mamnunmiz.\n\n' +
      'Iltimos, o‘zingizga qulay vaqtni quyidagi havola orqali band qiling:\n{link}\n\n' +
      'Savollaringiz bo‘lsa, {contact} bilan bog‘lanishingiz mumkin.\n\n' +
      'Suhbatda ko‘rishguncha.\n{company} HR bo‘limi',
    // Uchrashuv havolasi sozlanmagan bo'lsa shu matn ketadi
    interviewNoLink:
      'Hurmatli {name},\n\n' +
      '{company} jamoasiga bildirgan qiziqishingiz uchun minnatdormiz. Arizangiz va rezyumeingiz ko‘rib chiqildi va sizni jamoamiz bilan suhbatga taklif qilishdan mamnunmiz.\n\n' +
      'Iltimos, {contact} bilan bog‘lanib, o‘zingizga qulay kun va vaqtni ayting — biz video-uchrashuv havolasini yuboramiz.\n\n' +
      'Suhbatda ko‘rishguncha.\n{company} HR bo‘limi',
    acceptedTitle: 'Ariza ma’qullandi',
    accepted:
      'Hurmatli {name},\n\n' +
      'Sizni {company} jamoasiga qabul qilinganingizni mamnuniyat bilan ma’lum qilamiz.\n\n' +
      'Keyingi qadamlarni muhokama qilish uchun iltimos {contact} bilan bog‘laning.\n\n' +
      'Jamoamizga xush kelibsiz — birga ishlashni intiqlik bilan kutamiz.\n{company} HR bo‘limi',
    hrTeam: 'HR bo‘limimiz',
    rejectedTitle: 'Ariza haqida',
    rejected:
      'Hurmatli {name},\n\n' +
      '{company} jamoasiga bildirgan qiziqishingiz va ariza to‘ldirishga ajratgan vaqtingiz uchun samimiy minnatdorchilik bildiramiz.\n\n' +
      'Ayni paytda mavjud o‘rinlar to‘ldirilgan. Shu bilan birga, arizangizni bazamizda saqlab qolamiz va sizga mos vakansiya ochilishi bilan albatta bog‘lanamiz.\n\n' +
      'Bizga ko‘rsatgan qiziqishingiz uchun rahmat va faoliyatingizda muvaffaqiyat tilaymiz.\n{company} HR bo‘limi',

    // --- web app ---
    appTitle: 'Jamoaga qo‘shilish',
    appSubtitle: 'Ariza formasi',
    intro:
      'Savollarga o‘z so‘zlaringiz bilan, qisqa javob bering. Formani yuborishdan oldin javoblaringizni tekshirib chiqasiz.',
    start: 'Boshlash',
    next: 'Davom etish',
    back: 'Orqaga',
    review: 'Javoblarni tekshirish',
    submit: 'Arizani yuborish',
    submitting: 'Yuborilmoqda…',
    step: '{n} / {total}-bosqich',
    required: 'Bu maydon to‘ldirilishi shart',
    invalidEmail: 'Email manzil noto‘g‘ri kiritilgan',
    invalidPhone: 'Telefon raqam noto‘g‘ri kiritilgan',
    invalidAge: 'Yoshni 14 dan 70 gacha kiriting',
    pickOne: 'Bitta variantni tanlang',
    otherPlaceholder: 'Iltimos, aniqlashtiring',
    fileChoose: 'Faylni tanlash',
    fileReplace: 'Faylni almashtirish',
    fileTypes: 'PDF, DOC, DOCX',
    fileTooBig: 'Fayl hajmi 15 MB dan oshmasligi kerak',
    fileWrongType: 'Faqat PDF yoki Word fayl yuklang',
    fileRequired: 'Rezyume yuklash majburiy',
    telegramInvalid: 'Telegram nik noto‘g‘ri: 4–32 ta harf, raqam yoki pastki chiziq',
    telegramTaken: 'Bu Telegram nik bilan allaqachon ariza topshirilgan',
    prefillTitle: 'Siz {date} kuni ariza topshirgansiz',
    prefillText:
      'Javoblaringiz shu yerga qo‘yildi — o‘zgartirib, qaytadan yuborsangiz bo‘ladi. Rezyume ({file}) saqlanib turibdi, yangisini yuklamasangiz ham bo‘ladi.',
    prefillTextNoCv: 'Javoblaringiz shu yerga qo‘yildi — o‘zgartirib, qaytadan yuborsangiz bo‘ladi.',
    reviewTitle: 'Javoblaringiz',
    edit: 'Tahrirlash',
    successTitle: 'Ariza yuborildi',
    successText:
      'Rahmat. Arizangiz HR bo‘limiga yetib bordi. Natija Telegram orqali sizga xabar qilinadi.',
    close: 'Yopish',
    errorTitle: 'Yuborishda xatolik',
    errorText: 'Iltimos, internet aloqasini tekshirib, qayta urinib ko‘ring.',
    retry: 'Qayta urinish',
    charsLeft: '{n} ta belgi qoldi',
  },

  ru: {
    chooseLang: 'Tilni tanlang / Выберите язык / Choose a language',
    welcome:
      'Заявка на вступление в команду {company}\n\n' +
      'Нажмите кнопку ниже, чтобы открыть форму. Вы ответите на несколько вопросов и загрузите резюме. Это займёт около 10 минут.\n\n' +
      'Все заявки рассматриваются HR-отделом. О результате мы сообщим вам через этого бота.',
    openForm: 'Открыть форму заявки',
    menuButton: 'Анкета',
    changeLang: 'Сменить язык',
    notConfigured: 'Форма заявки сейчас настраивается. Пожалуйста, попробуйте немного позже.',
    alreadyApplied:
      'У вас уже есть отправленная заявка ({id}). Новая заявка будет принята как отдельная.',
    received:
      'Спасибо, {name}. Ваша заявка принята.\n\nНомер заявки: {id}\n\n' +
      'Ваши данные и резюме переданы в HR-отдел. После рассмотрения мы сообщим вам результат через этого бота.',
    updated:
      'Спасибо, {name}. Ваша заявка обновлена.\n\nНомер заявки: {id}\n\n' +
      'Обновлённые данные повторно переданы в HR-отдел.',
    helpUser: '/start — подать заявку\n/til — сменить язык\n/id — chat ID',

    interviewTitle: 'Приглашение на собеседование',
    interview:
      'Уважаемый(ая) {name},\n\n' +
      'Благодарим вас за интерес к команде {company}. Мы рассмотрели вашу заявку и резюме и рады пригласить вас на собеседование с нашей командой.\n\n' +
      'Пожалуйста, выберите удобное для вас время по ссылке:\n{link}\n\n' +
      'Если у вас возникнут вопросы, напишите нам: {contact}\n\n' +
      'Будем рады встрече.\nHR-отдел {company}',
    interviewNoLink:
      'Уважаемый(ая) {name},\n\n' +
      'Благодарим вас за интерес к команде {company}. Мы рассмотрели вашу заявку и резюме и рады пригласить вас на собеседование с нашей командой.\n\n' +
      'Пожалуйста, свяжитесь с {contact} и укажите удобные день и время — мы пришлём ссылку на видеовстречу.\n\n' +
      'Будем рады встрече.\nHR-отдел {company}',
    hrTeam: 'нашей HR-командой',
    acceptedTitle: 'Заявка одобрена',
    accepted:
      'Уважаемый(ая) {name},\n\n' +
      'С радостью сообщаем, что вы приняты в команду {company}.\n\n' +
      'Для обсуждения следующих шагов, пожалуйста, свяжитесь с нами: {contact}\n\n' +
      'Добро пожаловать в команду — мы рады работать вместе.\nHR-отдел {company}',
    rejectedTitle: 'О вашей заявке',
    rejected:
      'Уважаемый(ая) {name},\n\n' +
      'Искренне благодарим вас за интерес к {company} и за время, которое вы уделили заполнению заявки.\n\n' +
      'На данный момент открытые позиции уже заполнены. При этом мы сохраним вашу заявку в нашей базе и обязательно свяжемся с вами, как только появится подходящая вакансия.\n\n' +
      'Спасибо за проявленный интерес и успехов вам.\nHR-отдел {company}',

    appTitle: 'Присоединиться к команде',
    appSubtitle: 'Форма заявки',
    intro:
      'Отвечайте своими словами и по возможности кратко. Перед отправкой вы сможете проверить свои ответы.',
    start: 'Начать',
    next: 'Продолжить',
    back: 'Назад',
    review: 'Проверить ответы',
    submit: 'Отправить заявку',
    submitting: 'Отправляем…',
    step: 'Шаг {n} из {total}',
    required: 'Это поле обязательно',
    invalidEmail: 'Некорректный email',
    invalidPhone: 'Некорректный номер телефона',
    invalidAge: 'Укажите возраст от 14 до 70',
    pickOne: 'Выберите один вариант',
    otherPlaceholder: 'Пожалуйста, уточните',
    fileChoose: 'Выбрать файл',
    fileReplace: 'Заменить файл',
    fileTypes: 'PDF, DOC, DOCX',
    fileTooBig: 'Размер файла не должен превышать 15 МБ',
    fileWrongType: 'Загрузите файл в формате PDF или Word',
    fileRequired: 'Резюме обязательно',
    telegramInvalid: 'Неверное имя: 4–32 буквы, цифры или подчёркивание',
    telegramTaken: 'С этим именем Telegram заявка уже подана',
    prefillTitle: 'Вы подавали заявку {date}',
    prefillText:
      'Ваши ответы уже заполнены — измените их и отправьте снова. Резюме ({file}) сохранено, загружать заново не обязательно.',
    prefillTextNoCv: 'Ваши ответы уже заполнены — измените их и отправьте снова.',
    reviewTitle: 'Ваши ответы',
    edit: 'Изменить',
    successTitle: 'Заявка отправлена',
    successText: 'Спасибо. Ваша заявка передана в HR-отдел. О результате мы сообщим в Telegram.',
    close: 'Закрыть',
    errorTitle: 'Ошибка отправки',
    errorText: 'Проверьте соединение с интернетом и попробуйте ещё раз.',
    retry: 'Повторить',
    charsLeft: 'Осталось символов: {n}',
  },

  en: {
    chooseLang: 'Tilni tanlang / Выберите язык / Choose a language',
    welcome:
      'Application to join the {company} team\n\n' +
      'Tap the button below to open the application form. You will answer a few questions and upload your resume. It takes about 10 minutes.\n\n' +
      'Every application is reviewed by our HR team, and we will let you know the outcome through this bot.',
    openForm: 'Open application form',
    menuButton: 'Apply',
    changeLang: 'Change language',
    notConfigured: 'The application form is being set up. Please try again shortly.',
    alreadyApplied:
      'You already have a submitted application ({id}). A new one will be recorded separately.',
    received:
      'Thank you, {name}. Your application has been received.\n\nApplication ID: {id}\n\n' +
      'Your details and resume have been sent to our HR team. We will inform you of the outcome through this bot.',
    updated:
      'Thank you, {name}. Your application has been updated.\n\nApplication ID: {id}\n\n' +
      'Your new details have been sent to our HR team again.',
    helpUser: '/start — apply\n/til — change language\n/id — chat ID',

    interviewTitle: 'Interview invitation',
    interview:
      'Dear {name},\n\n' +
      'Thank you for your interest in joining {company}. Having reviewed your application and resume, we would be glad to invite you to an interview with our team.\n\n' +
      'Please book a time that works best for you here:\n{link}\n\n' +
      'If you have any questions, feel free to reach out to {contact}.\n\n' +
      'We look forward to speaking with you.\n{company} HR Team',
    interviewNoLink:
      'Dear {name},\n\n' +
      'Thank you for your interest in joining {company}. Having reviewed your application and resume, we would be glad to invite you to an interview with our team.\n\n' +
      'Please get in touch with {contact} and let us know which day and time suit you — we will send you the video call link.\n\n' +
      'We look forward to speaking with you.\n{company} HR Team',
    hrTeam: 'our HR team',
    acceptedTitle: 'Application approved',
    accepted:
      'Dear {name},\n\n' +
      'We are pleased to let you know that you have been accepted to the {company} team.\n\n' +
      'To proceed with the next steps, please get in touch with {contact}.\n\n' +
      'Welcome aboard — we are looking forward to working with you.\n{company} HR Team',
    rejectedTitle: 'About your application',
    rejected:
      'Dear {name},\n\n' +
      'Thank you sincerely for your interest in {company} and for the time you invested in your application.\n\n' +
      'At this moment in time, the positions we had open have been filled. We will keep your application on record and will be in touch as soon as a suitable opening arises.\n\n' +
      'We truly appreciate your interest and wish you every success.\n{company} HR Team',

    appTitle: 'Join the team',
    appSubtitle: 'Application form',
    intro:
      'Answer in your own words and keep it brief. You will be able to review everything before submitting.',
    start: 'Start',
    next: 'Continue',
    back: 'Back',
    review: 'Review answers',
    submit: 'Submit application',
    submitting: 'Submitting…',
    step: 'Step {n} of {total}',
    required: 'This field is required',
    invalidEmail: 'Please enter a valid email address',
    invalidPhone: 'Please enter a valid phone number',
    invalidAge: 'Please enter an age between 14 and 70',
    pickOne: 'Select one option',
    otherPlaceholder: 'Please specify',
    fileChoose: 'Choose file',
    fileReplace: 'Replace file',
    fileTypes: 'PDF, DOC, DOCX',
    fileTooBig: 'The file must be under 15 MB',
    fileWrongType: 'Please upload a PDF or Word file',
    fileRequired: 'A resume is required',
    telegramInvalid: 'Username looks wrong — 4 to 32 letters, digits or underscore',
    telegramTaken: 'An application with this Telegram username already exists',
    prefillTitle: 'You applied on {date}',
    prefillText:
      'Your answers are filled in below — change what you need and send it again. Your resume ({file}) is kept, so uploading a new one is optional.',
    prefillTextNoCv: 'Your answers are filled in below — change what you need and send it again.',
    reviewTitle: 'Your answers',
    edit: 'Edit',
    successTitle: 'Application submitted',
    successText:
      'Thank you. Your application has reached our HR team. We will let you know the outcome via Telegram.',
    close: 'Close',
    errorTitle: 'Could not submit',
    errorText: 'Please check your internet connection and try again.',
    retry: 'Try again',
    charsLeft: '{n} characters left',
  },
};

function fill(text, vars = {}) {
  let out = String(text || '');
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, v);
  return out;
}

function s(lang, key, vars = {}) {
  const pack = STRINGS[lang] || STRINGS[DEFAULT_LANG];
  return fill(pack[key] !== undefined ? pack[key] : STRINGS[DEFAULT_LANG][key], vars);
}

function uiStrings(lang) {
  return STRINGS[lang] || STRINGS[DEFAULT_LANG];
}

export { LANGS, DEFAULT_LANG, STRINGS, s, uiStrings, fill };
