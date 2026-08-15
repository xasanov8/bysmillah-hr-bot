/* Bysmillah — ariza formasi (Telegram Mini App) */

const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

const els = {
  main: document.getElementById('main'),
  langs: document.getElementById('langs'),
  title: document.getElementById('appTitle'),
  company: document.getElementById('companyName'),
  stepLabel: document.getElementById('stepLabel'),
  progress: document.getElementById('progress'),
  footer: document.getElementById('footer'),
  back: document.getElementById('backBtn'),
  next: document.getElementById('nextBtn'),
};

// Brend palitrasi Telegram mavzusidan qat'i nazar bir xil bo'ladi,
// faqat yorug'/qorong'i rejim foydalanuvchinikiga moslashadi.
const THEME = {
  light: { bg: '#f7f4ee', accent: '#125c44', accentText: '#fffdf9' },
  dark: { bg: '#0e1412', accent: '#4fbf93', accentText: '#08120e' },
};

// telegram-web-app.js oddiy brauzerda ham yuklanadi va colorScheme'ni doim
// 'light' deb qaytaradi — shuning uchun avval haqiqatan Telegram ichidamizmi, shuni tekshiramiz.
const inTelegram = !!(tg && tg.platform && tg.platform !== 'unknown');

function applyTheme() {
  const dark = inTelegram
    ? tg.colorScheme === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;

  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const palette = dark ? THEME.dark : THEME.light;

  try {
    tg?.setHeaderColor?.(palette.bg);
    tg?.setBackgroundColor?.(palette.bg);
    tg?.MainButton?.setParams({ color: palette.accent, text_color: palette.accentText });
  } catch {}
}

const state = {
  lang: 'uz',
  schema: null,
  ui: {},
  values: {},
  cv: null,
  previous: null, // ilgari topshirilgan ariza
  step: 0,
  screen: 'form', // form | review | success
  busy: false,
};

// Yoqilgan tillar — src/i18n.js dagi LANGS bilan mos bo'lishi kerak.
// Til qo'shish uchun: bu yerga qo'shing va LANGS ga ham qo'shing.
const SUPPORTED = ['en', 'uz'];

const MAX_CV = 15 * 1024 * 1024;
const CV_EXT = /\.(pdf|docx?|rtf|odt|txt)$/i;

/* -------------------------------- helpers -------------------------------- */

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

const fill = (str, vars) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.split('{' + k + '}').join(v), String(str || ''));

// Server qaysi tillarni berayotgan bo'lsa, shulardan tanlaymiz.
// Hozir faqat ingliz tili yoqilgan (src/i18n.js dagi LANGS).
function detectLang() {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (SUPPORTED.includes(fromUrl)) return fromUrl;

  const code = String(tg?.initDataUnsafe?.user?.language_code || navigator.language || '').toLowerCase();
  const guessed = SUPPORTED.find((lang) => code.startsWith(lang));
  return guessed || SUPPORTED[0];
}

function haptic(type) {
  try {
    if (type === 'error') tg?.HapticFeedback?.notificationOccurred('error');
    else if (type === 'success') tg?.HapticFeedback?.notificationOccurred('success');
    else tg?.HapticFeedback?.selectionChanged();
  } catch {}
}

const totalSteps = () => (state.schema ? state.schema.sections.length + 1 : 1);

/* ------------------------------ data loading ----------------------------- */

async function loadSchema(lang) {
  const res = await fetch(`/api/schema?lang=${lang}`);
  if (!res.ok) throw new Error('schema');
  const data = await res.json();
  state.schema = data;
  state.ui = data.ui;
  state.lang = data.lang;
  document.documentElement.lang = data.lang;
}

/* -------------------------------- chrome --------------------------------- */

function renderLangs() {
  els.langs.innerHTML = '';

  // Bitta til yoqilgan bo'lsa, almashtirgichni umuman ko'rsatmaymiz
  const available = (state.schema.langs || []).filter((l) => SUPPORTED.includes(l.code));
  els.langs.hidden = available.length < 2;
  if (els.langs.hidden) return;

  for (const l of available) {
    const b = el('button', null, l.code.toUpperCase());
    b.type = 'button';
    b.title = l.native;
    b.setAttribute('aria-pressed', String(l.code === state.lang));
    b.addEventListener('click', () => switchLang(l.code));
    els.langs.appendChild(b);
  }
}

async function switchLang(code) {
  if (code === state.lang || state.busy) return;
  haptic();
  await loadSchema(code);
  renderLangs();
  render();
}

function renderProgress() {
  els.progress.innerHTML = '';
  for (let i = 0; i < totalSteps(); i += 1) els.progress.appendChild(document.createElement('span'));
}

function updateChrome() {
  els.title.textContent = state.ui.appTitle;
  els.company.textContent = state.schema.company;

  const isForm = state.screen === 'form' || state.screen === 'review';
  const stepNum = state.screen === 'review' ? totalSteps() : state.step + 1;

  els.stepLabel.textContent = isForm ? fill(state.ui.step, { n: stepNum, total: totalSteps() }) : '';

  [...els.progress.children].forEach((seg, i) => {
    const done = isForm ? i < stepNum - 1 : true;
    seg.classList.toggle('is-done', done);
    seg.classList.toggle('is-current', isForm && i === stepNum - 1);
  });

  if (state.screen === 'success') {
    els.footer.classList.add('footer--hidden');
    tg?.MainButton?.hide();
    tg?.BackButton?.hide();
    return;
  }

  els.footer.classList.remove('footer--hidden');
  const isFirst = state.screen === 'form' && state.step === 0;
  const nextText = state.busy
    ? state.ui.submitting
    : state.screen === 'review'
      ? state.ui.submit
      : state.step === state.schema.sections.length - 1
        ? state.ui.review
        : state.ui.next;

  els.back.textContent = state.ui.back;
  els.back.classList.toggle('btn--hidden', isFirst);
  els.next.textContent = nextText;
  els.next.disabled = state.busy;

  if (tg?.MainButton) {
    tg.MainButton.setParams({ text: nextText, is_active: !state.busy });
    if (state.busy) tg.MainButton.showProgress(true);
    else tg.MainButton.hideProgress();
    tg.MainButton.show();
    els.footer.classList.add('footer--hidden');
  }
  if (tg?.BackButton) {
    if (isFirst) tg.BackButton.hide();
    else tg.BackButton.show();
  }
}

/* --------------------------------- fields -------------------------------- */

function fieldWrapper(field) {
  const wrap = el('div', 'field');
  wrap.dataset.field = field.id;

  const label = el('label', 'field__label');
  label.setAttribute('for', 'f_' + field.id);
  label.textContent = field.label;
  if (field.required) {
    const star = el('span', 'field__req', '*');
    label.appendChild(star);
  }
  wrap.appendChild(label);

  if (field.hint) wrap.appendChild(el('p', 'field__hint', field.hint));
  return wrap;
}

function renderTextField(field, index) {
  const wrap = fieldWrapper(field, index);
  const isArea = field.type === 'textarea';
  const input = el(isArea ? 'textarea' : 'input');
  input.id = 'f_' + field.id;
  if (!isArea) input.type = field.type === 'number' ? 'number' : field.type;
  if (field.placeholder) input.placeholder = field.placeholder;
  if (field.type === 'number') {
    input.min = field.min;
    input.max = field.max;
    input.inputMode = 'numeric';
  } else if (field.max) {
    input.maxLength = field.max;
  }
  input.value = state.values[field.id] || '';

  // Hisoblagich doim ko'rinib turmaydi — faqat chegara yaqinlashganda chiqadi,
  // shunda ekranda ortiqcha element bo'lmaydi
  const SHOW_FROM = 60;
  const updateCounter = () => {
    if (!counter) return;
    const left = field.max - input.value.length;
    counter.hidden = left > SHOW_FROM;
    counter.textContent = fill(state.ui.charsLeft, { n: left });
  };

  input.addEventListener('input', () => {
    state.values[field.id] = input.value;
    wrap.classList.remove('field--invalid');
    const err = wrap.querySelector('.field__error');
    if (err) err.remove();
    updateCounter();

    // Telegram nik — bu nik bilan kimdir ariza topshirganmi, yozayotganda tekshiramiz
    if (field.id === 'telegram') {
      clearTimeout(input._check);
      input._check = setTimeout(() => checkTelegram(wrap, input.value), 500);
    }
  });

  wrap.appendChild(input);

  let counter = null;
  if (isArea && field.max) {
    counter = el('div', 'counter');
    wrap.appendChild(counter);
    updateCounter();
  }
  return wrap;
}

function renderChipsField(field) {
  const wrap = fieldWrapper(field);
  const box = el('div', 'chips');
  const current = () => {
    const v = state.values[field.id];
    return Array.isArray(v) ? v : v ? [v] : [];
  };

  const otherWrap = el('div', 'other-input');
  const otherInput = el('input');
  otherInput.type = 'text';
  otherInput.id = 'f_' + field.id + '_other';
  otherInput.placeholder = state.ui.otherPlaceholder;
  otherInput.maxLength = 200;
  otherInput.value = state.values[field.id + '_other'] || '';
  otherInput.addEventListener('input', () => {
    state.values[field.id + '_other'] = otherInput.value;
  });
  otherWrap.appendChild(otherInput);

  const syncOther = () => {
    const show = field.otherField && current().includes('other');
    otherWrap.style.display = show ? 'block' : 'none';
  };

  for (const opt of field.options) {
    const chip = el('button', 'chip', opt.label);
    chip.type = 'button';
    chip.setAttribute('aria-pressed', String(current().includes(opt.value)));

    chip.addEventListener('click', () => {
      haptic();
      let values = current();
      if (!field.multi) {
        values = values.includes(opt.value) ? [] : [opt.value];
      } else if (values.includes(opt.value)) {
        values = values.filter((v) => v !== opt.value);
      } else if (opt.value === 'none') {
        values = ['none'];
      } else {
        values = values.filter((v) => v !== 'none').concat(opt.value);
      }
      state.values[field.id] = field.multi ? values : values[0] || '';

      for (const node of box.children) {
        node.setAttribute('aria-pressed', String(values.includes(node.dataset.value)));
      }
      wrap.classList.remove('field--invalid');
      const err = wrap.querySelector('.field__error');
      if (err) err.remove();
      syncOther();
    });

    chip.dataset.value = opt.value;
    box.appendChild(chip);
  }

  wrap.appendChild(box);
  if (field.otherField) {
    wrap.appendChild(otherWrap);
    syncOther();
  }
  return wrap;
}

function renderFileField(field) {
  const wrap = fieldWrapper(field);

  const input = el('input');
  input.type = 'file';
  input.accept = '.pdf,.doc,.docx,.rtf,.odt,.txt';
  input.style.display = 'none';

  const button = el('button', 'file');
  button.type = 'button';
  button.innerHTML =
    '<svg class="file__icon" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>';

  const textBox = el('div');
  const name = el('div', 'file__name');
  const meta = el('div', 'file__meta');
  textBox.append(name, meta);
  button.appendChild(textBox);

  const paint = () => {
    if (state.cv) {
      button.classList.add('file--filled');
      name.textContent = state.cv.name;
      meta.textContent = `${(state.cv.size / 1024 / 1024).toFixed(1)} MB · ${state.ui.fileReplace}`;
    } else {
      button.classList.remove('file--filled');
      name.textContent = state.ui.fileChoose;
      meta.textContent = state.ui.fileTypes;
    }
  };

  button.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (!file) return;
    if (!CV_EXT.test(file.name)) return showFieldError(wrap, state.ui.fileWrongType);
    if (file.size > MAX_CV) return showFieldError(wrap, state.ui.fileTooBig);
    state.cv = file;
    wrap.classList.remove('field--invalid');
    const err = wrap.querySelector('.field__error');
    if (err) err.remove();
    paint();
    haptic('success');
  });

  paint();
  wrap.append(button, input);
  return wrap;
}

// Nik band bo'lsa darhol aytamiz — oxirida rad javob olmasin
async function checkTelegram(wrap, value) {
  const nick = String(value || '').trim();
  if (nick.replace(/^@/, '').length < 4) return;

  try {
    const res = await fetch('/api/check-telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg?.initData || '', telegram: nick }),
    });
    const data = await res.json();

    if (!data.valid) return showFieldError(wrap, state.ui.telegramInvalid);
    if (data.taken) return showFieldError(wrap, state.ui.telegramTaken);

    wrap.classList.remove('field--invalid');
    const old = wrap.querySelector('.field__error');
    if (old) old.remove();
  } catch {}
}

function showFieldError(wrap, message) {
  wrap.classList.add('field--invalid');
  const old = wrap.querySelector('.field__error');
  if (old) old.remove();
  wrap.appendChild(el('p', 'field__error', message));
}

/* --------------------------------- screens -------------------------------- */

// Ilgari topshirgan bo'lsa — javoblarini yuklab, formani to'ldiramiz
async function loadPrevious() {
  if (!inTelegram || !tg?.initData) return;

  try {
    const res = await fetch('/api/my-application', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData }),
    });
    const data = await res.json();

    // Allaqachon ishga olingan — ariza formasi emas, ishchilar bo'limi kerak
    if (data.hired) {
      location.replace('staff.html');
      return 'hired';
    }
    if (!data.application) return;

    state.previous = data.application;
    state.values = { ...data.application.answers };
  } catch {}
}

function previousBanner() {
  const box = el('div', 'prefill');
  const date = new Date(state.previous.createdAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  box.appendChild(el('p', 'prefill__title', fill(state.ui.prefillTitle, { date })));
  box.appendChild(
    el(
      'p',
      'prefill__text',
      state.previous.cvFileName
        ? fill(state.ui.prefillText, { file: state.previous.cvFileName })
        : state.ui.prefillTextNoCv
    )
  );
  return box;
}

function renderSection() {
  const section = state.schema.sections[state.step];
  els.main.innerHTML = '';

  els.main.appendChild(el('h2', 'section__title', section.title));
  if (state.step === 0) {
    if (state.previous) els.main.appendChild(previousBanner());
    els.main.appendChild(el('p', 'section__intro', state.ui.intro));
  }

  for (const field of section.fields) {
    if (field.type === 'chips') els.main.appendChild(renderChipsField(field));
    else if (field.type === 'file') els.main.appendChild(renderFileField(field));
    else els.main.appendChild(renderTextField(field));
  }
}

function answerText(field) {
  if (field.type === 'file') return state.cv ? state.cv.name : '';
  if (field.type === 'chips') {
    const raw = state.values[field.id];
    const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const labels = values.map((v) => (field.options.find((o) => o.value === v) || {}).label || v);
    const other = state.values[field.id + '_other'];
    if (other) labels.push(other);
    return labels.join(', ');
  }
  return state.values[field.id] || '';
}

function renderReview() {
  els.main.innerHTML = '';
  els.main.appendChild(el('h2', 'section__title', state.ui.reviewTitle));

  state.schema.sections.forEach((section, index) => {
    const group = el('div', 'review-group');
    const head = el('div', 'review-group__head');
    head.appendChild(el('h3', 'review-group__title', section.title));

    const edit = el('button', 'review-group__edit', state.ui.edit);
    edit.type = 'button';
    edit.addEventListener('click', () => goTo(index));
    head.appendChild(edit);
    group.appendChild(head);

    for (const field of section.fields) {
      const value = answerText(field);
      if (!value) continue;
      const item = el('div', 'review-item');
      item.appendChild(el('div', 'review-item__label', field.label));
      item.appendChild(el('div', 'review-item__value', value));
      group.appendChild(item);
    }
    els.main.appendChild(group);
  });
}

function renderResult({ title, text, id, retry }) {
  els.main.innerHTML = '';
  const box = el('div', 'result');
  const mark = el('div', 'result__mark');
  mark.innerHTML = retry
    ? '<svg viewBox="0 0 24 24"><path d="M12 8v5"/><path d="M12 16.5v.01"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M4.5 12.5 10 18 19.5 6.5"/></svg>';
  box.appendChild(mark);
  box.appendChild(el('h2', 'result__title', title));
  box.appendChild(el('p', 'result__text', text));
  if (id) box.appendChild(el('div', 'result__id', id));

  if (retry) {
    const btn = el('button', 'btn btn--primary', state.ui.retry);
    btn.type = 'button';
    btn.style.marginTop = '26px';
    btn.addEventListener('click', () => {
      state.screen = 'review';
      render();
    });
    box.appendChild(btn);
  } else {
    const btn = el('button', 'btn btn--primary', state.ui.close);
    btn.type = 'button';
    btn.style.marginTop = '26px';
    btn.addEventListener('click', () => tg?.close());
    box.appendChild(btn);
  }
  els.main.appendChild(box);
}

function render() {
  if (state.screen === 'form') renderSection();
  else if (state.screen === 'review') renderReview();
  updateChrome();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

/* -------------------------------- validation ------------------------------- */

function validateStep() {
  const section = state.schema.sections[state.step];
  let firstBad = null;

  for (const field of section.fields) {
    const wrap = els.main.querySelector(`[data-field="${field.id}"]`);
    if (!wrap) continue;
    let message = '';

    if (field.type === 'file') {
      // Ilgari yuklangan rezyume bo'lsa, uni qayta yuklash shart emas
    if (field.required && !state.cv && !state.previous?.cvFileName) message = state.ui.fileRequired;
    } else if (field.type === 'chips') {
      const raw = state.values[field.id];
      const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
      if (field.required && !values.length) message = field.multi ? state.ui.required : state.ui.pickOne;
      else if (field.otherField && values.includes('other') && !String(state.values[field.id + '_other'] || '').trim())
        message = state.ui.required;
    } else {
      const value = String(state.values[field.id] || '').trim();
      if (field.required && !value) message = state.ui.required;
      else if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value))
        message = state.ui.invalidEmail;
      else if (field.type === 'tel' && value && value.replace(/\D/g, '').length < 9) message = state.ui.invalidPhone;
      else if (field.type === 'number' && value) {
        const n = Number(value);
        if (!Number.isFinite(n) || n < field.min || n > field.max) message = state.ui.invalidAge;
      }
    }

    if (message) {
      showFieldError(wrap, message);
      if (!firstBad) firstBad = wrap;
    }
  }

  if (firstBad) {
    haptic('error');
    firstBad.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return false;
  }
  return true;
}

/* --------------------------------- actions -------------------------------- */

function goTo(step) {
  state.step = step;
  state.screen = 'form';
  render();
}

function onNext() {
  if (state.busy) return;

  if (state.screen === 'form') {
    if (!validateStep()) return;
    if (state.step < state.schema.sections.length - 1) {
      state.step += 1;
      render();
    } else {
      state.screen = 'review';
      render();
    }
    return;
  }
  submit();
}

function onBack() {
  if (state.busy) return;
  if (state.screen === 'review') {
    state.screen = 'form';
    state.step = state.schema.sections.length - 1;
  } else if (state.step > 0) {
    state.step -= 1;
  }
  render();
}

async function submit() {
  state.busy = true;
  updateChrome();

  const answers = { ...state.values };
  const form = new FormData();
  form.append('initData', tg?.initData || '');
  form.append('lang', state.lang);
  form.append('answers', JSON.stringify(answers));
  if (state.cv) form.append('cv', state.cv, state.cv.name);

  try {
    const res = await fetch('/api/apply', { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      if (data.fields) {
        const firstId = Object.keys(data.fields)[0];
        const index = state.schema.sections.findIndex((s) => s.fields.some((f) => f.id === firstId.replace('_other', '')));
        state.busy = false;
        if (index >= 0) {
          goTo(index);
          validateStep();

          // Nik band bo'lsa, sababi aniq ko'rsatilsin
          if (data.fields.telegram === 'taken') {
            const wrap = els.main.querySelector('[data-field="telegram"]');
            if (wrap) showFieldError(wrap, state.ui.telegramTaken);
          }
          return;
        }
      }
      throw new Error(data.error || 'submit');
    }

    haptic('success');
    state.screen = 'success';
    state.busy = false;
    updateChrome();
    renderResult({ title: state.ui.successTitle, text: state.ui.successText, id: data.id });
  } catch (err) {
    console.error(err);
    haptic('error');
    state.busy = false;
    state.screen = 'error';
    updateChrome();
    renderResult({ title: state.ui.errorTitle, text: state.ui.errorText, retry: true });
    els.footer.classList.add('footer--hidden');
    tg?.MainButton?.hide();
  }
}

/* ---------------------------------- init ---------------------------------- */

els.next.addEventListener('click', onNext);
els.back.addEventListener('click', onBack);
tg?.MainButton?.onClick(onNext);
tg?.BackButton?.onClick(onBack);

tg?.onEvent?.('themeChanged', applyTheme);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

(async function init() {
  els.main.innerHTML = '<p class="loader">…</p>';
  try {
    tg?.ready();
    tg?.expand();
    applyTheme();
    await loadSchema(detectLang());
    if ((await loadPrevious()) === 'hired') return; // ishchilar bo'limiga o'tildi
    renderLangs();
    renderProgress();
    render();
  } catch (err) {
    console.error(err);
    els.main.innerHTML = '<p class="loader">Connection error. Please reopen the form.</p>';
  }
})();
