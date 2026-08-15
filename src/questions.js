// Ariza formasining yagona manbasi: Web App, guruh xabari va CSV shu yerdan quriladi.
// t(uz, ru, en) — uchala til bir joyda turadi, tarjimani yangilash oson.

const t = (uz, ru, en) => ({ uz, ru, en });

const SECTIONS = [
  { id: 'contact', title: t('Shaxsiy ma’lumotlar', 'Личные данные', 'Personal details') },
  { id: 'about', title: t('Siz haqingizda', 'О вас', 'About you') },
  { id: 'work', title: t('Ish uslubingiz', 'Как вы работаете', 'How you work') },
  { id: 'growth', title: t('Rivojlanish va ko‘nikmalar', 'Развитие и навыки', 'Growth and skills') },
  { id: 'cv', title: t('Rezyume', 'Резюме', 'Resume') },
];

const YES_NO_MAYBE = (yes, maybe, no) => [
  { value: 'yes', label: yes },
  { value: 'maybe', label: maybe },
  { value: 'no', label: no },
];

const FIELDS = [
  /* ------------------------------- shaxsiy ------------------------------- */
  {
    id: 'fullName',
    section: 'contact',
    type: 'text',
    required: true,
    max: 80,
    label: t('To‘liq ism-familiya', 'Полное имя', 'Full name'),
    placeholder: t('Ism Familiya', 'Имя Фамилия', 'First and last name'),
  },
  {
    id: 'age',
    section: 'contact',
    type: 'number',
    required: true,
    min: 14,
    max: 70,
    label: t('Yosh', 'Возраст', 'Age'),
  },
  {
    id: 'city',
    section: 'contact',
    type: 'text',
    required: true,
    max: 60,
    label: t('Shahar / mamlakat', 'Город / страна', 'City / country'),
    placeholder: t('Toshkent, O‘zbekiston', 'Ташкент, Узбекистан', 'Tashkent, Uzbekistan'),
  },
  {
    id: 'phone',
    section: 'contact',
    type: 'tel',
    required: true,
    max: 20,
    label: t('Telefon raqam', 'Номер телефона', 'Phone number'),
    placeholder: t('+998 90 123 45 67', '+998 90 123 45 67', '+998 90 123 45 67'),
  },
  {
    id: 'email',
    section: 'contact',
    type: 'email',
    required: true,
    max: 80,
    label: t('Email', 'Email', 'Email'),
    placeholder: t('ism@gmail.com', 'imya@gmail.com', 'name@gmail.com'),
  },
  {
    id: 'telegram',
    section: 'contact',
    type: 'text',
    required: true,
    max: 33,
    label: t('Telegram username', 'Имя пользователя Telegram', 'Telegram username'),
    placeholder: t('@username', '@username', '@username'),
    hint: t(
      'Biz siz bilan shu orqali bog‘lanamiz',
      'По нему мы свяжемся с вами',
      'This is how we will reach you'
    ),
  },

  /* ------------------------------ siz haqingizda ------------------------------ */
  {
    id: 'q1',
    section: 'about',
    type: 'textarea',
    required: true,
    max: 500,
    label: t(
      'Hozir qayerda ishlaysiz yoki o‘qiysiz? Haftasiga qancha vaqtingiz shunga ketadi va odatdagi kuningiz qanday o‘tadi?',
      'Где вы сейчас работаете или учитесь? Сколько часов в неделю это занимает и как проходит ваш обычный день?',
      'Where do you currently work or study, how many hours a week does it take, and what is your typical daily schedule?'
    ),
  },
  {
    id: 'q2',
    section: 'about',
    type: 'textarea',
    required: true,
    max: 500,
    label: t(
      'Nega aynan shu boshlang‘ich bosqichda {company} jamoasiga qo‘shilmoqchisiz? Bizning maqsadimizda sizni nima qiziqtiradi?',
      'Почему вы хотите присоединиться к {company} именно на раннем этапе? Что вас вдохновляет в нашей миссии?',
      'Why do you want to join {company} at this early stage, and what excites you about our mission?'
    ),
  },
  {
    id: 'q3',
    section: 'about',
    type: 'chips',
    multi: true,
    required: true,
    label: t(
      'Qaysi yo‘nalish yoki lavozim sizga yaqin?',
      'Какое направление или роль вам ближе?',
      'Which department or role do you feel drawn to?'
    ),
    hint: t('Bir nechtasini tanlash mumkin', 'Можно выбрать несколько', 'You can pick more than one'),
    options: [
      { value: 'development', label: t('Dasturlash', 'Разработка', 'Development') },
      { value: 'marketing', label: t('Marketing', 'Маркетинг', 'Marketing') },
      { value: 'hr', label: t('HR', 'HR', 'HR') },
      { value: 'social', label: t('Ijtimoiy tarmoqlar', 'Соцсети', 'Social media') },
      { value: 'legal', label: t('Yuridik', 'Юридическое', 'Legal') },
      { value: 'research', label: t('Tadqiqot', 'Исследования', 'Research') },
      { value: 'operations', label: t('Operatsiyalar', 'Операции', 'Operations') },
      { value: 'support', label: t('Mijozlarga xizmat', 'Поддержка клиентов', 'Customer support') },
      { value: 'other', label: t('Boshqa', 'Другое', 'Other') },
    ],
    otherField: true,
  },
  {
    id: 'q4',
    section: 'about',
    type: 'textarea',
    required: true,
    max: 400,
    label: t(
      'Haftasiga qancha vaqt ajrata olasiz (masalan 10 yoki 20 soat) va muntazam jamoa uchrashuvlarida qatnasha olasizmi?',
      'Сколько часов в неделю вы готовы уделять (например, 10 или 20) и сможете ли участвовать в регулярных встречах команды?',
      'How many hours per week can you commit (e.g. 10 or 20), and are you available for regular team meetings?'
    ),
  },
  {
    id: 'q5',
    section: 'about',
    type: 'chips',
    required: true,
    label: t(
      'Mustaqil ishlashni afzal ko‘rasizmi yoki jamoada yaxshiroq natija berasizmi?',
      'Вы предпочитаете работать самостоятельно или лучше раскрываетесь в команде?',
      'Do you prefer working independently, or do you thrive in a team?'
    ),
    options: [
      { value: 'independent', label: t('Mustaqil', 'Самостоятельно', 'Independently') },
      { value: 'team', label: t('Jamoada', 'В команде', 'In a team') },
      { value: 'both', label: t('Ikkalasi ham qulay', 'И так, и так', 'Comfortable with both') },
    ],
  },

  /* ------------------------------ ish uslubi ------------------------------ */
  {
    id: 'q6',
    section: 'work',
    type: 'textarea',
    required: true,
    max: 500,
    label: t(
      'Tashabbus ko‘rsatishga qanday qaraysiz? Biror ishni o‘z zimmangizga olgan holatga misol keltiring.',
      'Как вы относитесь к инициативе? Приведите пример, когда вы взяли что-то на себя.',
      'How do you approach taking initiative? Share an example of when you took the lead on something.'
    ),
  },
  {
    id: 'q7',
    section: 'work',
    type: 'chips',
    required: true,
    label: t(
      'Fikr-mulohaza (feedback) olishga va ishingizni shunga qarab o‘zgartirishga qanday qaraysiz?',
      'Как вы относитесь к обратной связи и корректировке работы по ней?',
      'Are you comfortable receiving feedback and adjusting your work based on it?'
    ),
    options: [
      { value: 'yes', label: t('Ha, bemalol qabul qilaman', 'Да, воспринимаю спокойно', 'Yes, I welcome it') },
      {
        value: 'explained',
        label: t('Ha, sababi tushuntirilsa', 'Да, если объяснят причину', 'Yes, when the reasoning is explained'),
      },
      { value: 'hard', label: t('Qiyinroq bo‘ladi', 'Бывает непросто', 'I find it challenging') },
    ],
  },
  {
    id: 'q8',
    section: 'work',
    type: 'textarea',
    required: true,
    max: 500,
    label: t(
      'Sizni ishda eng ko‘p nima harakatga keltiradi? O‘z so‘zlaringiz bilan yozing.',
      'Что вас больше всего мотивирует в работе? Своими словами.',
      'What motivates you most in your work? In your own words.'
    ),
  },
  {
    id: 'q9',
    section: 'work',
    type: 'chips',
    required: true,
    label: t(
      'Qisqa muddatli tajriba izlayapsizmi yoki pullik imkoniyat paydo bo‘lsa uzoq muddatga qolasizmi?',
      'Вы ищете краткосрочный опыт или готовы остаться надолго, если появится оплачиваемая позиция?',
      'Are you looking for short-term experience, or open to a longer-term role if a paid opportunity arises?'
    ),
    options: [
      { value: '3m', label: t('3 oy', '3 месяца', '3 months') },
      { value: '6m', label: t('6 oy', '6 месяцев', '6 months') },
      { value: '12m', label: t('12 oy', '12 месяцев', '12 months') },
      { value: 'long', label: t('Uzoq muddatga tayyorman', 'Готов(а) надолго', 'Open to long-term') },
    ],
  },
  {
    id: 'q10',
    section: 'work',
    type: 'textarea',
    required: true,
    max: 400,
    label: t(
      'Hozir, endi boshlayotgan bo‘lsangiz ham, qaysi yo‘nalishda eng katta foyda keltira olasiz?',
      'В каком направлении вы можете принести наибольшую пользу прямо сейчас, даже если только начинаете?',
      'Which department or task could you make the biggest impact in right now, even if you are just starting out?'
    ),
  },

  /* --------------------------- rivojlanish va ko'nikmalar --------------------------- */
  {
    id: 'q11',
    section: 'growth',
    type: 'chips',
    required: true,
    label: t(
      'Startap o‘sib borgani sari boshqa vazifa yoki yo‘nalishlarni olishga tayyormisiz?',
      'Готовы ли вы брать другие задачи или направления по мере роста стартапа?',
      'Are you open to flexible roles — taking on different tasks or departments as the startup evolves?'
    ),
    options: YES_NO_MAYBE(
      t('Ha, tayyorman', 'Да, готов(а)', 'Yes, fully'),
      t('Qisman', 'Частично', 'Partly'),
      t('Yo‘q, faqat o‘z yo‘nalishim', 'Нет, только своё направление', 'No, only my own area')
    ),
  },
  {
    id: 'q12',
    section: 'growth',
    type: 'textarea',
    required: true,
    max: 400,
    label: t(
      'Yaqin oylarda qanday ish yoki loyiha sizni eng ko‘p o‘stiradi deb o‘ylaysiz?',
      'Какая работа или проект, по вашему мнению, даст вам наибольший рост в ближайшие месяцы?',
      'What type of work or project do you hope will help you grow the most over the next few months?'
    ),
  },
  {
    id: 'q13tools',
    section: 'growth',
    type: 'chips',
    multi: true,
    required: true,
    label: t(
      'Qaysi AI vositalaridan foydalanasiz?',
      'Какими AI-инструментами вы пользуетесь?',
      'Which AI tools do you use?'
    ),
    options: [
      { value: 'chatgpt', label: t('ChatGPT', 'ChatGPT', 'ChatGPT') },
      { value: 'claude', label: t('Claude', 'Claude', 'Claude') },
      { value: 'gemini', label: t('Gemini', 'Gemini', 'Gemini') },
      { value: 'deepseek', label: t('DeepSeek', 'DeepSeek', 'DeepSeek') },
      { value: 'copilot', label: t('Copilot', 'Copilot', 'Copilot') },
      { value: 'other', label: t('Boshqa', 'Другое', 'Other') },
      { value: 'none', label: t('Foydalanmayman', 'Не пользуюсь', 'I do not use them') },
    ],
    otherField: true,
  },
  {
    id: 'q13',
    section: 'growth',
    type: 'textarea',
    required: true,
    max: 400,
    label: t(
      'Ularni qanchalik tez-tez ishlatasiz, AI bo‘yicha kurs o‘tganmisiz va prompt yozishga ishonchingiz komilmi?',
      'Как часто вы их используете, проходили ли курсы по AI и уверены ли вы в написании промптов?',
      'How often do you use them, have you taken any AI courses, and do you feel confident writing prompts?'
    ),
  },
  {
    id: 'q14tools',
    section: 'growth',
    type: 'chips',
    multi: true,
    required: true,
    label: t(
      'Qaysi dasturlarda bemalol ishlaysiz?',
      'В каких программах вы уверенно работаете?',
      'Which software tools are you most comfortable using?'
    ),
    options: [
      { value: 'canva', label: t('Canva', 'Canva', 'Canva') },
      { value: 'photoshop', label: t('Photoshop', 'Photoshop', 'Photoshop') },
      { value: 'figma', label: t('Figma', 'Figma', 'Figma') },
      { value: 'premiere', label: t('Premiere / CapCut', 'Premiere / CapCut', 'Premiere / CapCut') },
      { value: 'excel', label: t('Excel / Google Sheets', 'Excel / Google Sheets', 'Excel / Google Sheets') },
      { value: 'powerbi', label: t('Power BI', 'Power BI', 'Power BI') },
      { value: 'notion', label: t('Notion / Trello', 'Notion / Trello', 'Notion / Trello') },
      { value: 'code', label: t('Dasturlash muhitlari', 'Среды разработки', 'Developer tools') },
      { value: 'other', label: t('Boshqa', 'Другое', 'Other') },
    ],
    otherField: true,
  },
  {
    id: 'q15',
    section: 'growth',
    type: 'chips',
    required: true,
    label: t(
      'Brend nomidan videoga chiqish yoki kontent tayyorlashga tayyormisiz?',
      'Готовы ли вы появляться в видео или создавать контент от имени бренда?',
      'Would you feel comfortable appearing on video or creating content that represents the brand?'
    ),
    options: YES_NO_MAYBE(
      t('Ha, tayyorman', 'Да, готов(а)', 'Yes'),
      t('Sinab ko‘rsam bo‘ladi', 'Можно попробовать', 'Willing to try'),
      t('Yo‘q, ortda ishlashni afzal ko‘raman', 'Нет, предпочитаю за кадром', 'No, I prefer behind the scenes')
    ),
  },

  /* -------------------------------- rezyume -------------------------------- */
  {
    id: 'cv',
    section: 'cv',
    type: 'file',
    required: true,
    label: t('Rezyumeingizni yuklang', 'Загрузите резюме', 'Upload your resume'),
    hint: t(
      'PDF yoki Word, 15 MB gacha. Rezyume majburiy.',
      'PDF или Word, до 15 МБ. Резюме обязательно.',
      'PDF or Word, up to 15 MB. A resume is required.'
    ),
  },
];

const ANSWER_FIELDS = FIELDS.filter((f) => f.type !== 'file');

function tr(value, lang, vars = {}) {
  if (!value) return '';
  let text = value[lang] || value.uz || '';
  for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, v);
  return text;
}

// Web App uchun bitta tilga tarjima qilingan sxema
function schemaFor(lang, vars = {}) {
  return {
    lang,
    sections: SECTIONS.map((s) => ({
      id: s.id,
      title: tr(s.title, lang, vars),
      fields: FIELDS.filter((f) => f.section === s.id).map((f) => ({
        id: f.id,
        type: f.type,
        required: !!f.required,
        multi: !!f.multi,
        min: f.min,
        max: f.max,
        otherField: !!f.otherField,
        label: tr(f.label, lang, vars),
        hint: tr(f.hint, lang, vars),
        placeholder: tr(f.placeholder, lang, vars),
        options: (f.options || []).map((o) => ({ value: o.value, label: tr(o.label, lang, vars) })),
      })),
    })),
  };
}

const byId = Object.fromEntries(FIELDS.map((f) => [f.id, f]));

// Javobni odam o'qiydigan matnga aylantiradi (HR uchun — o'zbekcha yorliqlar)
function renderAnswer(fieldId, answers, lang = 'uz') {
  const field = byId[fieldId];
  if (!field) return '';
  const raw = answers[fieldId];

  if (field.type === 'chips') {
    const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const labels = values.map((v) => {
      const opt = (field.options || []).find((o) => o.value === v);
      return opt ? tr(opt.label, lang) : v;
    });
    const other = answers[fieldId + '_other'];
    if (other) labels.push(String(other));
    return labels.join(', ');
  }
  return raw === undefined || raw === null ? '' : String(raw);
}

export { FIELDS, ANSWER_FIELDS, SECTIONS, schemaFor, tr, renderAnswer, byId };
