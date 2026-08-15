/* Bysmillah — ishchilar bo'limi (Staff area).
   Kirish, nomzodlar ro'yxati, filtrlar, ruxsatlar va hisoblar boshqaruvi. */

const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
const inTelegram = !!(tg && tg.platform && tg.platform !== 'unknown');

const TOKEN_KEY = 'bysmillah_staff_token';
const root = document.getElementById('app');

const state = {
  token: localStorage.getItem(TOKEN_KEY) || null,
  user: null,
  departments: [],
  statuses: [],
  view: 'candidates',
  filters: { q: '', dept: '', status: '' },
  candidates: [],
  total: 0,
  detail: null,
  team: [],
  account: null,
  accountTrail: [],
  accountQuery: '',
  accountsFrom: 'workers',
  myPassword: '',
  myApplication: null,
  created: null,
  busy: false,
};

/* --------------------------------- utilities -------------------------------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const ICONS = {
  search: 'M11 4a7 7 0 1 0 4.2 12.6l4.1 4.1 1.4-1.4-4.1-4.1A7 7 0 0 0 11 4Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z',
  back: 'M15 5l-7 7 7 7',
  download: 'M12 3v12m0 0l-4-4m4 4l4-4M4 19h16',
  logout: 'M9 5H5v14h4M15 12H8m7 0l-3-3m3 3l-3 3',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13',
  pencil: 'M4 20h4l10-10-4-4L4 16zM14 6l4 4',
  camera: 'M4 8h3l1.5-2h7L17 8h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  eye: 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Zm10 2.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z',
  eyeOff: 'M4 4l16 16M9.9 5.7A9.8 9.8 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3.3 4M6.5 7.6C3.7 9.3 2 12 2 12s3.6 6.5 10 6.5c1.4 0 2.6-.3 3.7-.8M9.9 9.9a2.6 2.6 0 0 0 3.6 3.7',
  // pastki navigatsiya
  applicants: 'M7 3h7l4 4v14H7zM14 3v5h4M10 12h5M10 16h5',
  specialists: 'M12 4l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6zM6 21h12',
  team: 'M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11Zm-6 9a6 6 0 0 1 12 0M17 11a3 3 0 1 0-1.5-5.6M21 20a5.4 5.4 0 0 0-4-5.2',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
};

function icon(name, size = 18) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.classList.add('icon');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', ICONS[name]);
  svg.appendChild(p);
  return svg;
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

function haptic(kind) {
  try {
    if (kind === 'error') tg?.HapticFeedback?.notificationOccurred('error');
    else if (kind === 'success') tg?.HapticFeedback?.notificationOccurred('success');
    else tg?.HapticFeedback?.selectionChanged();
  } catch {}
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  const res = await fetch(path, {
    ...options,
    headers,
    body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body,
  });

  if (res.status === 401 && state.token) {
    signOut();
    throw new Error('unauthorized');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'request_failed'), { data, status: res.status });
  return data;
}

/* ---------------------------------- theme ---------------------------------- */

const THEME = {
  light: { bg: '#f7f4ee', accent: '#125c44', accentText: '#fffdf9' },
  dark: { bg: '#0e1412', accent: '#4fbf93', accentText: '#08120e' },
};

function applyTheme() {
  const dark = inTelegram
    ? tg.colorScheme === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const palette = dark ? THEME.dark : THEME.light;
  try {
    tg?.setHeaderColor?.(palette.bg);
    tg?.setBackgroundColor?.(palette.bg);
  } catch {}
}

/* ---------------------------------- login ---------------------------------- */

function renderLogin(message) {
  root.innerHTML = '';
  const wrap = el('main', 'auth');

  wrap.appendChild(el('p', 'auth__eyebrow', 'BYSMILLAH'));
  wrap.appendChild(el('h1', 'auth__title', 'Staff area'));
  wrap.appendChild(el('p', 'auth__note', 'Sign in with the credentials your administrator gave you.'));

  const form = el('form', 'auth__form');

  const userField = el('label', 'input-group');
  userField.appendChild(el('span', 'input-group__label', 'Username'));
  const userInput = el('input');
  userInput.type = 'text';
  userInput.autocomplete = 'username';
  userInput.autocapitalize = 'none';
  userInput.spellcheck = false;
  userInput.required = true;
  userField.appendChild(userInput);

  const passField = el('label', 'input-group');
  passField.appendChild(el('span', 'input-group__label', 'Password'));
  const passInput = el('input');
  passInput.type = 'password';
  passInput.autocomplete = 'current-password';
  passInput.required = true;
  passField.appendChild(passInput);

  const error = el('p', 'auth__error', message || '');
  error.hidden = !message;

  const submit = el('button', 'btn btn--primary', 'Sign in');
  submit.type = 'submit';

  form.append(userField, passField, error, submit);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (state.busy) return;

    state.busy = true;
    submit.disabled = true;
    submit.textContent = 'Signing in…';
    error.hidden = true;

    try {
      const data = await api('/api/staff/login', {
        method: 'POST',
        body: { username: userInput.value, password: passInput.value },
      });
      state.token = data.token;
      localStorage.setItem(TOKEN_KEY, data.token);
      haptic('success');
      await boot();
    } catch (err) {
      haptic('error');
      const reason = err.data?.error;
      error.textContent =
        reason === 'locked'
          ? `Too many attempts. Try again in ${err.data.retryAfter || 300} seconds.`
          : 'Wrong username or password.';
      error.hidden = false;
      submit.disabled = false;
      submit.textContent = 'Sign in';
    } finally {
      state.busy = false;
    }
  });

  wrap.appendChild(form);

  const back = el('a', 'auth__back', 'Back to the application form');
  back.href = './';
  wrap.appendChild(back);

  root.appendChild(wrap);
  tg?.BackButton?.hide();
}

function signOut() {
  state.token = null;
  state.user = null;
  localStorage.removeItem(TOKEN_KEY);
  renderLogin();
}

/* ---------------------------------- shell ---------------------------------- */

function renderShell(content, { title, subtitle, onBack } = {}) {
  root.innerHTML = '';

  const header = el('header', 'admin-header');

  const top = el('div', 'admin-header__top');
  const titles = el('div', 'admin-header__titles');
  if (onBack) {
    const backBtn = el('button', 'icon-btn');
    backBtn.type = 'button';
    backBtn.title = 'Back';
    backBtn.appendChild(icon('back'));
    backBtn.addEventListener('click', onBack);
    top.appendChild(backBtn);
  }
  titles.appendChild(el('p', 'admin-header__eyebrow', subtitle || 'STAFF AREA'));
  titles.appendChild(el('h1', 'admin-header__title', title || 'Applicants'));
  top.appendChild(titles);

  const account = el('div', 'account');
  const who = el('button', 'account__name');
  who.type = 'button';
  who.textContent = state.user.username;
  who.title = 'Your profile';
  who.setAttribute('aria-current', String(state.view === 'profile'));
  who.addEventListener('click', openProfile);

  const out = el('button', 'icon-btn');
  out.type = 'button';
  out.title = 'Sign out';
  out.appendChild(icon('logout'));
  out.addEventListener('click', signOut);

  account.append(who, out);
  top.appendChild(account);
  header.appendChild(top);

  root.append(header, content, renderTabBar());
}

// Pastdagi bo'limlar paneli — ruxsatga qarab qatorlar kamayadi
const TAB_GROUP = { candidates: 'candidates', detail: 'candidates' };

function renderTabBar() {
  const perms = state.user.permissions;
  const tabs = [{ key: 'candidates', label: 'Applicants', icon: 'applicants', need: 'viewCandidates' }];

  if (perms.manageStaff) tabs.push({ key: 'specialists', label: 'Specialists', icon: 'specialists' });
  if (perms.manageStaff || perms.addWorkers) {
    tabs.push({ key: 'workers', label: perms.manageStaff ? 'Workers' : 'My workers', icon: 'team' });
    tabs.push({ key: 'newworker', label: 'New', icon: 'plus' });
  }
  tabs.push({ key: 'profile', label: 'Profile', icon: 'profile' });

  // Hisob sahifasi qaysi ro'yxatdan ochilgan bo'lsa, o'sha bo'lim yonib turadi
  TAB_GROUP.account = state.accountsFrom;

  const bar = el('nav', 'tabbar');
  bar.setAttribute('aria-label', 'Sections');

  for (const tab of tabs) {
    if (tab.need && !state.user.permissions[tab.need]) continue;

    const item = el('button', 'tabbar__item');
    item.type = 'button';
    item.setAttribute('aria-current', String((TAB_GROUP[state.view] || state.view) === tab.key));
    item.appendChild(icon(tab.icon, 21));
    item.appendChild(el('span', 'tabbar__label', tab.label));

    item.addEventListener('click', () => {
      if (state.view === tab.key) return;
      haptic();
      if (tab.key === 'profile') return openProfile();
      state.view = tab.key;
      state.detail = null;
      state.account = null;
      state.accountTrail = [];
      state.accountQuery = '';
      if (tab.key === 'specialists' || tab.key === 'workers') state.accountsFrom = tab.key;
      if (tab.key !== 'newworker') state.created = null;
      render();
    });
    bar.appendChild(item);
  }
  return bar;
}

/* -------------------------------- candidates ------------------------------- */

function filterBar() {
  const bar = el('section', 'filters');

  bar.appendChild(
    searchBox('Search by name, @telegram, field or ID', state.filters.q, (value) => {
      state.filters.q = value;
      loadCandidates({ keepFocus: true });
    })
  );

  const makeRow = (label, items, current, onPick) => {
    const row = el('div', 'chip-row');
    row.appendChild(el('span', 'chip-row__label', label));
    const scroller = el('div', 'chip-row__items');

    const all = el('button', 'filter-chip', 'All');
    all.type = 'button';
    all.setAttribute('aria-pressed', String(!current));
    all.addEventListener('click', () => onPick(''));
    scroller.appendChild(all);

    for (const item of items) {
      const chip = el('button', 'filter-chip', item.label);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(current === item.value));
      chip.addEventListener('click', () => onPick(item.value));
      scroller.appendChild(chip);
    }
    row.appendChild(scroller);
    return row;
  };

  const allowed = state.user.permissions.departments || [];
  const depts = allowed.length ? state.departments.filter((d) => allowed.includes(d.value)) : state.departments;

  bar.appendChild(
    makeRow('Department', depts, state.filters.dept, (value) => {
      state.filters.dept = value;
      loadCandidates();
    })
  );

  return bar;
}

const STATUS_CLASS = {
  yangi: 'is-new',
  shortlist: 'is-shortlist',
  intervyu: 'is-interview',
  qabul: 'is-accepted',
  rad: 'is-declined',
};

function statusLabel(value) {
  return state.statuses.find((s) => s.value === value)?.label || value;
}

function candidateCard(item) {
  const card = el('article', `card card--applicant ${STATUS_CLASS[item.status] || ''}`);
  card.tabIndex = 0;
  card.setAttribute('role', 'button');

  const head = el('div', 'card__head');
  const name = el('h3', 'card__name', item.fullName || '—');
  head.appendChild(name);
  head.appendChild(el('span', `pill ${STATUS_CLASS[item.status] || ''}`, statusLabel(item.status)));
  card.appendChild(head);

  const meta = [item.age && `${item.age} yrs`, item.city].filter(Boolean).join(' · ');
  if (meta) card.appendChild(el('p', 'card__meta', meta));

  if (item.departments.length) {
    const tags = el('div', 'tags');
    for (const d of item.departments) tags.appendChild(el('span', 'tag', d));
    card.appendChild(tags);
  }

  const foot = el('div', 'card__foot');
  foot.appendChild(el('span', 'mono', item.id));
  foot.appendChild(el('span', null, formatDate(item.createdAt)));
  if (item.hasCv) foot.appendChild(el('span', 'card__cv', 'CV'));
  card.appendChild(foot);

  const open = () => openCandidate(item.id);
  card.addEventListener('click', open);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  });
  return card;
}

function renderCandidates({ keepFocus } = {}) {
  const main = el('main', 'admin-main');
  main.appendChild(filterBar());

  const count = el('p', 'result-count');
  count.innerHTML = '';
  count.append(el('strong', 'mono', String(state.total)), document.createTextNode(state.total === 1 ? ' applicant' : ' applicants'));
  main.appendChild(count);

  if (!state.candidates.length) {
    const empty = el('div', 'empty');
    empty.appendChild(el('h3', 'empty__title', 'Nothing here yet'));
    empty.appendChild(
      el(
        'p',
        'empty__text',
        state.filters.q || state.filters.dept || state.filters.status
          ? 'No applicants match these filters. Try clearing them.'
          : 'Applications submitted through the bot will appear here.'
      )
    );
    main.appendChild(empty);
  } else {
    const list = el('div', 'card-list');
    for (const item of state.candidates) list.appendChild(candidateCard(item));
    main.appendChild(list);
  }

  renderShell(main, { title: 'Applicants' });

  if (keepFocus) {
    const search = root.querySelector('.search input');
    if (search) {
      search.focus();
      search.setSelectionRange(search.value.length, search.value.length);
    }
  }
}

async function loadCandidates(options = {}) {
  const params = new URLSearchParams();
  if (state.filters.q) params.set('q', state.filters.q);
  if (state.filters.dept) params.set('dept', state.filters.dept);
  if (state.filters.status) params.set('status', state.filters.status);

  try {
    const data = await api('/api/staff/candidates?' + params.toString());
    state.candidates = data.items;
    state.total = data.total;
    if (!options.silent && state.view === 'candidates') renderCandidates(options);
  } catch (err) {
    if (err.message !== 'unauthorized') showToast('Could not load applicants.');
  }
}

/* ---------------------------------- detail --------------------------------- */

async function openCandidate(id) {
  haptic();
  try {
    const data = await api('/api/staff/candidates/' + encodeURIComponent(id));
    state.detail = data.candidate;
    state.view = 'detail';
    renderDetail();
  } catch (err) {
    if (err.message !== 'unauthorized') showToast('Could not open this applicant.');
  }
}

function renderDetail() {
  const c = state.detail;
  const main = el('main', 'admin-main');

  const head = el('section', 'detail-head');
  head.appendChild(el('span', `pill ${STATUS_CLASS[c.status] || ''}`, statusLabel(c.status)));
  head.appendChild(el('h2', 'detail-head__name', c.fullName || '—'));
  const meta = [c.age && `${c.age} yrs`, c.city].filter(Boolean).join(' · ');
  if (meta) head.appendChild(el('p', 'detail-head__meta', meta));
  if (c.departments.length) {
    const tags = el('div', 'tags');
    for (const d of c.departments) tags.appendChild(el('span', 'tag', d));
    head.appendChild(tags);
  }
  main.appendChild(head);

  if (c.phone || c.email || c.telegram) {
    const contacts = el('section', 'panel');
    contacts.appendChild(el('h3', 'panel__title', 'Contact'));
    for (const [label, value, href] of [
      ['Phone', c.phone, c.phone ? 'tel:' + c.phone.replace(/\s/g, '') : null],
      ['Email', c.email, c.email ? 'mailto:' + c.email : null],
      ['Telegram', c.telegram, c.telegram ? 'https://t.me/' + c.telegram.replace('@', '') : null],
    ]) {
      if (!value) continue;
      const row = el('div', 'row');
      row.appendChild(el('span', 'row__label', label));
      if (href) {
        const link = el('a', 'row__value row__value--link', value);
        link.href = href;
        row.appendChild(link);
      } else {
        row.appendChild(el('span', 'row__value', value));
      }
      contacts.appendChild(row);
    }
    main.appendChild(contacts);
  }

  if (c.hasCv) {
    const cv = el('section', 'panel');
    cv.appendChild(el('h3', 'panel__title', 'Resume'));
    const row = el('div', 'row');
    row.appendChild(el('span', 'row__value', c.cvFileName || 'resume'));
    if (c.canDownloadCv) {
      const link = el('a', 'btn btn--soft');
      link.href = `/api/staff/candidates/${encodeURIComponent(c.id)}/cv?token=${encodeURIComponent(state.token)}`;
      link.appendChild(icon('download', 16));
      link.appendChild(el('span', null, 'Download'));
      row.appendChild(link);
    }
    cv.appendChild(row);
    main.appendChild(cv);
  }

  // Berilgan savollar — bo'limlar bo'yicha, har bir savol javobi bilan birga
  let number = 0;
  for (const group of c.groups || []) {
    const panel = el('section', 'panel');
    panel.appendChild(el('h3', 'panel__title', group.title));

    for (const item of group.items) {
      number += 1;
      const block = el('div', 'answer');

      const head = el('div', 'answer__head');
      head.appendChild(el('span', 'answer__num mono', String(number).padStart(2, '0')));
      head.appendChild(el('p', 'answer__q', item.question));
      block.appendChild(head);

      if (item.answer) {
        block.appendChild(el('p', 'answer__a', item.answer));
      } else {
        block.appendChild(el('p', 'answer__a answer__a--empty', 'No answer'));
      }
      panel.appendChild(block);
    }
    main.appendChild(panel);
  }

  const foot = el('p', 'detail-foot');
  foot.append(el('span', 'mono', c.id), document.createTextNode(' · submitted ' + formatDate(c.createdAt)));
  main.appendChild(foot);

  renderShell(main, {
    title: 'Applicant',
    subtitle: 'DETAILS',
    onBack: () => {
      state.view = 'candidates';
      state.detail = null;
      render();
    },
  });
}

/* ------------------------------ hisoblar (staff) ----------------------------- */

const KIND_LABEL = { admin: 'Admin', specialist: 'Specialist', worker: 'Worker' };

// Ruxsatlar alohida sozlanmaydi — hisob turidan kelib chiqadi
const ACCESS_SUMMARY = {
  admin: 'Full access to every field and every account.',
  specialist:
    'Full access inside their field: applicant list, contact details, resume downloads and adding their own workers.',
  worker: 'No access to applicant data. The account exists so the specialist can keep them on the team.',
};

function departmentPicker(selected, onChange, { label, hint } = {}) {
  const wrap = el('div', 'dept-picker');
  wrap.appendChild(el('p', 'dept-picker__label', label || 'Specialisation'));
  wrap.appendChild(
    el('p', 'dept-picker__hint', hint || 'Only applicants from the selected fields appear in their search.')
  );

  const chips = el('div', 'chip-row__items');
  const paint = (current) => {
    [...chips.children].forEach((chip, i) => {
      chip.setAttribute('aria-pressed', String(current.includes(state.departments[i].value)));
    });
  };

  for (const dept of state.departments) {
    const chip = el('button', 'filter-chip', dept.label);
    chip.type = 'button';
    chip.addEventListener('click', () => {
      const now = wrap._value;
      const next = now.includes(dept.value) ? now.filter((v) => v !== dept.value) : [...now, dept.value];
      wrap._value = next;
      paint(next);
      onChange(next);
    });
    chips.appendChild(chip);
  }

  wrap._value = [...selected];
  wrap.appendChild(chips);
  paint(selected);
  return wrap;
}

// Joyida tahrirlanadigan qator: qiymat yonida qalam belgisi, bosilsa maydonga aylanadi
function editableRow(label, value, { placeholder, mono, secret, emptyText, onSave } = {}) {
  const row = el('div', 'row row--edit');
  row.appendChild(el('span', 'row__label', label));

  const right = el('div', 'row__edit');
  const text = el('span', mono ? 'row__value mono' : 'row__value');

  // Yashirin qiymat (parol) — ko'zcha tugmasi bilan ochiladi.
  // Parol saqlanmagan bo'lsa ham qator bir xil ko'rinadi: nuqtalar va ko'zcha.
  let revealed = false;
  const paint = () => {
    if (secret) text.textContent = revealed && value ? value : '•'.repeat(value ? Math.min(value.length, 10) : 8);
    else text.textContent = value || emptyText || '—';
  };
  paint();

  let eye = null;
  if (secret) {
    eye = el('button', 'row__pencil');
    eye.type = 'button';
    eye.title = 'Show';
    eye.appendChild(icon('eye', 15));
    eye.addEventListener('click', () => {
      if (!value) {
        // Bu hisobning paroli hali saqlanmagan — qalam orqali yangisini qo'yish kerak
        return showToast('This password is not stored yet — set a new one.');
      }
      revealed = !revealed;
      eye.innerHTML = '';
      eye.appendChild(icon(revealed ? 'eyeOff' : 'eye', 15));
      eye.title = revealed ? 'Hide' : 'Show';
      paint();
    });
  }

  const pencil = el('button', 'row__pencil');
  pencil.type = 'button';
  pencil.title = 'Change';
  pencil.appendChild(icon('pencil', 15));

  const input = el('input', 'row__input');
  input.type = 'text';
  input.value = value || '';
  input.placeholder = placeholder || '';
  input.autocapitalize = 'none';
  input.hidden = true;

  const confirm = el('button', 'row__save', 'Save');
  confirm.type = 'button';
  confirm.hidden = true;

  const close = () => {
    input.hidden = true;
    confirm.hidden = true;
    text.hidden = false;
    pencil.hidden = false;
    if (eye) eye.hidden = false;
  };

  const open = () => {
    text.hidden = true;
    pencil.hidden = true;
    if (eye) eye.hidden = true;
    input.hidden = false;
    confirm.hidden = false;
    input.value = value || '';
    input.focus();
    input.select();
  };

  pencil.addEventListener('click', open);
  confirm.addEventListener('click', () => {
    const next = input.value.trim();
    if (!next || next === value) return close();
    onSave(next, close);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirm.click();
    if (e.key === 'Escape') close();
  });

  right.append(text, input, confirm);
  if (eye) right.appendChild(eye);
  right.appendChild(pencil);
  row.appendChild(right);
  return row;
}

const avatarUrl = (username) =>
  `/api/staff/avatar/${encodeURIComponent(username)}?token=${encodeURIComponent(state.token)}&v=${Date.now()}`;

function fieldNames(member) {
  return (member.permissions.departments || [])
    .map((v) => state.departments.find((d) => d.value === v)?.label || v)
    .join(', ');
}

function accountCard(member, { onOpen } = {}) {
  const card = el('article', `card card--${member.kind}`);
  card.tabIndex = 0;
  card.setAttribute('role', 'button');

  const head = el('div', 'card__head');
  const who = el('div', 'spec__who');

  if (member.avatar) {
    const img = el('img', 'spec__avatar spec__avatar--img');
    img.src = avatarUrl(member.username);
    img.alt = member.username;
    who.appendChild(img);
  } else {
    who.appendChild(el('div', 'spec__avatar', member.username.slice(0, 2).toUpperCase()));
  }

  const names = el('div', 'spec__names');
  names.appendChild(el('h3', 'card__name', member.username));
  const sub = [member.telegram ? '@' + member.telegram : 'no Telegram username'];
  if (member.kind === 'worker' && member.specialist) sub.push('→ ' + member.specialist);
  names.appendChild(el('p', 'spec__tg', sub.join(' · ')));
  who.appendChild(names);
  head.appendChild(who);
  head.appendChild(el('span', `pill ${member.kind === 'specialist' ? 'is-accepted' : ''}`, KIND_LABEL[member.kind]));
  card.appendChild(head);

  const fields = fieldNames(member);
  const tags = el('div', 'tags');
  if (fields) for (const f of fields.split(', ')) tags.appendChild(el('span', 'tag', f));
  else tags.appendChild(el('span', 'tag tag--wide', 'No field assigned — sees nothing'));
  card.appendChild(tags);

  if (member.workerCount) {
    const foot = el('div', 'card__foot');
    foot.appendChild(el('span', null, `${member.workerCount} ${member.workerCount === 1 ? 'worker' : 'workers'}`));
    card.appendChild(foot);
  }

  const open = onOpen || (() => openAccount(member.username));
  card.addEventListener('click', open);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  });
  return card;
}

// Qidiruv qatori — hisoblar va nomzodlar bo'limlarida bir xil ko'rinishda
function searchBox(placeholder, value, onInput, { autofocus } = {}) {
  const wrap = el('div', 'search');
  wrap.appendChild(icon('search'));

  const input = el('input');
  input.type = 'search';
  input.placeholder = placeholder;
  input.value = value || '';
  input.autocapitalize = 'none';
  input.addEventListener('input', () => {
    clearTimeout(input._timer);
    input._timer = setTimeout(() => onInput(input.value), 200);
  });

  wrap.appendChild(input);
  if (autofocus) setTimeout(() => input.focus(), 0);
  return wrap;
}

function matchesAccount(member, query) {
  if (!query) return true;
  const hay = [member.username, member.telegram, member.specialist, fieldNames(member), KIND_LABEL[member.kind]]
    .join(' ')
    .toLowerCase();
  return hay.includes(query.toLowerCase());
}

// kind: 'specialist' | 'worker' | null (mutaxassisning o'z ishchilari)
function renderAccounts(kind) {
  const main = el('main', 'admin-main');
  const isAdmin = state.user.permissions.manageStaff;
  const query = state.accountQuery;

  const source = isAdmin ? state.team.filter((u) => u.kind === kind) : state.team;
  const members = source.filter((m) => matchesAccount(m, query));

  const title = !isAdmin ? 'Your workers' : kind === 'specialist' ? 'Specialists' : 'Workers';

  main.appendChild(
    el(
      'p',
      'section-note',
      !isAdmin
        ? 'The workers you gave a login to. They see the same field as you.'
        : kind === 'specialist'
          ? 'Specialists own a field and can create their own workers.'
          : 'Workers help inside the field of the specialist who created them.'
    )
  );

  main.appendChild(
    searchBox('Search by login, @telegram or field', query, (value) => {
      state.accountQuery = value;
      renderAccounts(kind);
      const input = root.querySelector('.search input');
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    })
  );

  const count = el('p', 'result-count');
  count.append(
    el('strong', 'mono', String(members.length)),
    document.createTextNode(members.length === 1 ? ' account' : ' accounts')
  );
  main.appendChild(count);

  if (!members.length) {
    const empty = el('div', 'empty');
    empty.appendChild(el('h3', 'empty__title', query ? 'Nothing found' : 'Nobody here yet'));
    empty.appendChild(
      el(
        'p',
        'empty__text',
        query
          ? 'No account matches that username or field.'
          : 'Open the “New” section to create the first login.'
      )
    );
    main.appendChild(empty);
  } else {
    const list = el('div', 'card-list');
    for (const member of members) list.appendChild(accountCard(member));
    main.appendChild(list);
  }

  renderShell(main, { title, subtitle: 'ACCOUNTS' });
}

async function openAccount(username, { push = true } = {}) {
  haptic();
  try {
    const data = await api('/api/staff/users/' + encodeURIComponent(username));
    if (push && state.account) state.accountTrail.push(state.account.member.username);
    state.account = data;
    state.departments = data.departments || state.departments;
    state.view = 'account';
    renderAccount();
  } catch {
    showToast('Could not open this account.');
  }
}

function renderAccount() {
  const { member, workers } = state.account;
  const main = el('main', 'admin-main');
  const isAdminViewer = state.user.permissions.manageStaff;

  const head = el('section', 'profile-head');
  if (member.avatar) {
    const img = el('img', 'profile-photo__img');
    img.src = avatarUrl(member.username);
    img.alt = member.username;
    head.appendChild(img);
  } else {
    head.appendChild(el('div', 'profile-avatar', member.username.slice(0, 2).toUpperCase()));
  }
  const names = el('div');
  names.appendChild(el('h2', 'profile-name', member.username));
  names.appendChild(el('p', 'profile-role', KIND_LABEL[member.kind] + (fieldNames(member) ? ' · ' + fieldNames(member) : '')));
  head.appendChild(names);
  main.appendChild(head);

  // --- ma'lumotlari
  const save = async (patch, done) => {
    try {
      const res = await api('/api/staff/users/' + encodeURIComponent(member.username), { method: 'PATCH', body: patch });
      showToast('Saved');
      haptic('success');
      if (done) done();
      openAccount(res.user?.username || member.username, { push: false });
    } catch (err) {
      haptic('error');
      const map = {
        username_taken: 'That login is already taken.',
        username_invalid: 'Use only letters, numbers, dot, dash or underscore.',
        telegram_invalid: 'Telegram username looks wrong.',
        password_required: 'Enter a password.',
      };
      showToast(map[err.data?.error] || 'Could not save the change.');
    }
  };

  const info = el('section', 'panel');
  info.appendChild(el('h3', 'panel__title', 'Details'));

  if (member.kind === 'admin') {
    info.appendChild(infoRow('Login', member.username));
  } else {
    info.appendChild(
      editableRow('Login', member.username, {
        mono: true,
        placeholder: 'username',
        onSave: (value, done) => save({ username: value }, done),
      })
    );
    info.appendChild(
      editableRow('Password', state.account.password, {
        mono: true,
        secret: true,
        placeholder: 'new password',
        onSave: (value, done) => save({ password: value }, done),
      })
    );
    info.appendChild(
      editableRow('Telegram', member.telegram ? '@' + member.telegram : '', {
        placeholder: '@username',
        onSave: (value, done) => save({ telegram: value }, done),
      })
    );
  }

  if (member.kind === 'worker') info.appendChild(infoRow('Specialist', member.specialist || '—'));
  info.appendChild(infoRow('Role', KIND_LABEL[member.kind]));
  info.appendChild(infoRow('Field', fieldNames(member) || 'not assigned'));
  info.appendChild(infoRow('Added by', member.createdBy || '—'));
  info.appendChild(infoRow('Created', formatDate(member.createdAt)));
  info.appendChild(infoRow('Last sign-in', member.lastLoginAt ? formatDate(member.lastLoginAt) : 'never'));
  main.appendChild(info);

  if (member.kind !== 'admin') {
    const access = el('section', 'panel');
    access.appendChild(el('h3', 'panel__title', 'Access'));
    access.appendChild(el('p', 'access-summary', ACCESS_SUMMARY[member.kind]));

    // Sohani faqat admin va faqat mutaxassisga o'zgartira oladi
    if (isAdminViewer && member.kind === 'specialist') {
      access.appendChild(
        departmentPicker(member.permissions.departments || [], (next) => save({ permissions: { departments: next } }), {
          label: 'Field',
          hint: 'Applicants from these fields are visible to this specialist and their workers.',
        })
      );
    }
    main.appendChild(access);
  }

  // --- u login-parol bergan ishchilar
  if (workers.length) {
    const box = el('section', 'panel');
    box.appendChild(el('h3', 'panel__title', `Workers they added — ${workers.length}`));
    const list = el('div', 'card-list');
    for (const worker of workers) list.appendChild(accountCard(worker, { onOpen: () => openAccount(worker.username) }));
    box.appendChild(list);
    main.appendChild(box);
  }

  // --- o'zi ariza topshirgan bo'lsa, javoblari shu yerda
  const application = state.account.application;
  if (application) {
    const box = el('section', 'panel');
    box.appendChild(el('h3', 'panel__title', 'Their application'));

    const head = el('div', 'row');
    head.appendChild(el('span', 'row__label', 'Applied as'));
    head.appendChild(el('span', 'row__value', `${application.fullName} · ${application.id}`));
    box.appendChild(head);
    box.appendChild(infoRow('Submitted', formatDate(application.createdAt)));
    if (application.hasCv) box.appendChild(infoRow('Resume', application.cvFileName || 'attached'));

    let number = 0;
    for (const group of application.groups) {
      box.appendChild(el('h4', 'answer-group', group.title));
      for (const item of group.items) {
        number += 1;
        const block = el('div', 'answer');
        const qhead = el('div', 'answer__head');
        qhead.appendChild(el('span', 'answer__num mono', String(number).padStart(2, '0')));
        qhead.appendChild(el('p', 'answer__q', item.question));
        block.appendChild(qhead);
        block.appendChild(
          item.answer ? el('p', 'answer__a', item.answer) : el('p', 'answer__a answer__a--empty', 'No answer')
        );
        box.appendChild(block);
      }
    }
    main.appendChild(box);
  }

  // --- amallar
  if (member.kind !== 'admin') {
    const actions = el('div', 'card__actions');
    const del = el('button', 'btn btn--danger');
    del.type = 'button';
    del.appendChild(icon('trash', 16));
    del.appendChild(el('span', null, 'Remove'));
    del.addEventListener('click', async () => {
      if (!confirm(`Remove ${member.username}? They will lose access immediately.`)) return;
      try {
        await api('/api/staff/users/' + encodeURIComponent(member.username), { method: 'DELETE' });
        showToast('Account removed');
        state.account = null;
        state.accountTrail = [];
        state.view = state.accountsFrom;
        loadTeam().then(render);
      } catch {
        showToast('Could not remove this account.');
      }
    });

    actions.append(del);
    main.appendChild(actions);
  }

  renderShell(main, {
    title: 'Account',
    subtitle: KIND_LABEL[member.kind].toUpperCase(),
    onBack: () => {
      const previous = state.accountTrail.pop();
      if (previous) return openAccount(previous, { push: false });
      state.account = null;
      state.view = state.accountsFrom;
      render();
    },
  });
}

/* ------------------------------- yangi ishchi ------------------------------- */

function renderNewWorker() {
  const main = el('main', 'admin-main');
  const isAdmin = state.user.permissions.manageStaff;

  const box = el('section', 'panel');
  box.appendChild(el('h3', 'panel__title', 'New account'));

  const form = el('form', 'form-grid');
  const draft = { kind: 'worker', specialist: '', permissions: { departments: [] } };

  const field = (label, placeholder, { type = 'text' } = {}) => {
    const wrap = el('label', 'input-group');
    wrap.appendChild(el('span', 'input-group__label', label));
    const input = el('input');
    input.type = type;
    input.placeholder = placeholder;
    input.autocapitalize = 'none';
    input.required = true;
    wrap.appendChild(input);
    return { wrap, input };
  };

  const user = field('Login (username)', 'e.g. dilnoza');
  const pass = field('Password', 'Share this with them');
  const telegram = field('Telegram username', '@username');
  form.append(user.wrap, pass.wrap, telegram.wrap);

  // --- kim bo'lib ochiladi
  const dynamic = el('div', 'form-grid');

  if (isAdmin) {
    const kindBox = el('div', 'kind-picker');
    kindBox.appendChild(el('p', 'dept-picker__label', 'Account type'));

    const row = el('div', 'chip-row__items');
    const options = [
      ['worker', 'Worker', 'Attached to a specialist and sees that specialist’s field'],
      ['specialist', 'Specialist', 'Owns a field, gets full access to it and can add workers'],
    ];
    const hint = el('p', 'dept-picker__hint', options[0][2]);

    for (const [value, label] of options) {
      const chip = el('button', 'filter-chip', label);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(draft.kind === value));
      chip.addEventListener('click', () => {
        draft.kind = value;
        [...row.children].forEach((c, i) => c.setAttribute('aria-pressed', String(options[i][0] === value)));
        hint.textContent = options.find((o) => o[0] === value)[2];
        buildDynamic();
      });
      row.appendChild(chip);
    }
    kindBox.append(row, hint);
    form.appendChild(kindBox);
  } else {
    form.appendChild(
      el(
        'p',
        'notice-inline',
        `This worker will be attached to you and will see your field: ${fieldNames(state.user) || 'no field assigned'}.`
      )
    );
  }

  // Hisob turiga qarab o'zgaradigan qism
  function buildDynamic() {
    dynamic.innerHTML = '';

    if (isAdmin && draft.kind === 'specialist') {
      // Mutaxassis to'liq huquq bilan ochiladi — alohida tanlash kerak emas
      dynamic.appendChild(
        departmentPicker(draft.permissions.departments, (next) => {
          draft.permissions.departments = next;
        }, { label: 'Field', hint: 'The specialist will own these fields.' })
      );
      dynamic.appendChild(
        el(
          'p',
          'notice-inline',
          'Specialists are created with full access to their field: see applicants, see contact details, download resumes and add their own workers.'
        )
      );
      return;
    }

    if (isAdmin) {
      // Ishchi — qaysi mutaxassisga biriktirilishini tanlaymiz
      const specialists = state.team.filter((u) => u.kind === 'specialist');
      const note = el('p', 'notice-inline', ACCESS_SUMMARY.worker);
      const box = el('div', 'dept-picker');
      box.appendChild(el('p', 'dept-picker__label', 'Attach to specialist'));
      box.appendChild(
        el(
          'p',
          'dept-picker__hint',
          specialists.length
            ? 'The worker inherits this specialist’s field and appears in their list.'
            : 'No specialists yet — create a specialist account first.'
        )
      );

      const chips = el('div', 'chip-row__items');
      for (const spec of specialists) {
        const chip = el('button', 'filter-chip', spec.username + (fieldNames(spec) ? ` · ${fieldNames(spec)}` : ''));
        chip.type = 'button';
        chip.setAttribute('aria-pressed', String(draft.specialist === spec.username));
        chip.addEventListener('click', () => {
          draft.specialist = spec.username;
          [...chips.children].forEach((c, i) =>
            c.setAttribute('aria-pressed', String(specialists[i].username === draft.specialist))
          );
        });
        chips.appendChild(chip);
      }
      box.appendChild(chips);
      dynamic.append(box, note);
      return;
    }

    // Mutaxassis ishchi ochyapti — soha o'ziniki, ruxsat sozlanmaydi
    dynamic.appendChild(el('p', 'notice-inline', ACCESS_SUMMARY.worker));
  }

  buildDynamic();
  form.appendChild(dynamic);

  const error = el('p', 'auth__error');
  error.hidden = true;
  form.appendChild(error);

  const submit = el('button', 'btn btn--primary');
  submit.type = 'submit';
  submit.appendChild(icon('plus', 16));
  submit.appendChild(el('span', null, 'Create account'));
  form.appendChild(submit);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.hidden = true;

    if (isAdmin && draft.kind === 'specialist' && !draft.permissions.departments.length) {
      error.textContent = 'Choose the field this specialist will own.';
      error.hidden = false;
      return haptic('error');
    }
    if (isAdmin && draft.kind === 'worker' && !draft.specialist) {
      error.textContent = 'Choose which specialist this worker belongs to.';
      error.hidden = false;
      return haptic('error');
    }

    try {
      await api('/api/staff/users', {
        method: 'POST',
        body: {
          username: user.input.value,
          password: pass.input.value,
          telegram: telegram.input.value,
          kind: draft.kind,
          specialist: draft.specialist,
          permissions: draft.permissions,
        },
      });
      haptic('success');
      state.created = { username: user.input.value.trim().toLowerCase(), password: pass.input.value, kind: draft.kind };
      showToast('Account created');
      loadTeam().then(render);
    } catch (err) {
      haptic('error');
      const map = {
        username_taken: 'That login is already taken.',
        username_invalid: 'Use only letters, numbers, dot, dash or underscore.',
        username_required: 'Enter a login.',
        password_required: 'Enter a password.',
        telegram_required: 'Enter their Telegram username.',
        telegram_invalid: 'Telegram username looks wrong — 4 to 32 letters, digits or underscore.',
        department_required: 'Choose the field for this specialist.',
        specialist_required: 'Choose which specialist this worker belongs to.',
      };
      error.textContent = map[err.data?.error] || 'Could not create the account.';
      error.hidden = false;
    }
  });

  box.appendChild(form);

  // Yangi ochilgan hisob ma'lumotlari — adminga uzatish uchun
  if (state.created) {
    const done = el('section', 'panel panel--accent');
    done.appendChild(el('h3', 'panel__title', 'Ready to share'));
    done.appendChild(infoRow('Login', state.created.username));
    done.appendChild(infoRow('Password', state.created.password));
    done.appendChild(infoRow('Type', KIND_LABEL[state.created.kind]));
    done.appendChild(el('p', 'panel__note', 'Send these to the person. The password is not shown again.'));
    main.appendChild(done);
  }

  main.appendChild(box);
  renderShell(main, { title: 'New worker', subtitle: 'CREATE A LOGIN' });
}

async function loadTeam() {
  try {
    const data = await api('/api/staff/users');
    state.team = data.users;
    state.departments = data.departments || state.departments;
  } catch (err) {
    if (err.message !== 'unauthorized') showToast('Could not load accounts.');
  }
}

/* ---------------------------------- profil --------------------------------- */

function infoRow(label, value, { link } = {}) {
  const row = el('div', 'row');
  row.appendChild(el('span', 'row__label', label));
  if (link && value) {
    const a = el('a', 'row__value row__value--link', value);
    a.href = link;
    a.target = '_blank';
    a.rel = 'noreferrer';
    row.appendChild(a);
  } else {
    row.appendChild(el('span', 'row__value', value || '—'));
  }
  return row;
}

function renderProfile() {
  const me = state.user;
  const main = el('main', 'admin-main');

  // Kim ekanligi
  // Rasm — bosilganda galereya ochiladi
  const head = el('section', 'profile-head');
  const photo = el('label', 'profile-photo');
  photo.title = 'Change photo';

  if (me.avatar) {
    const img = el('img', 'profile-photo__img');
    img.src = avatarUrl(me.username);
    img.alt = me.username;
    photo.appendChild(img);
  } else {
    photo.appendChild(el('div', 'profile-avatar', me.username.slice(0, 2).toUpperCase()));
  }

  const camera = el('span', 'profile-photo__badge');
  camera.appendChild(icon('camera', 14));
  photo.appendChild(camera);

  const picker = el('input');
  picker.type = 'file';
  picker.accept = 'image/jpeg,image/png,image/webp';
  picker.hidden = true;
  picker.addEventListener('change', async () => {
    const file = picker.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) return showToast('Photo is too large — 4 MB maximum.');

    const form = new FormData();
    form.append('photo', file, file.name);
    try {
      const data = await api('/api/staff/me/avatar', { method: 'POST', body: form });
      state.user = data.user;
      haptic('success');
      showToast('Photo updated');
      openProfile();
    } catch (err) {
      haptic('error');
      showToast(err.data?.error === 'photo_type' ? 'Use a JPG, PNG or WebP image.' : 'Could not upload the photo.');
    }
  });
  photo.appendChild(picker);
  head.appendChild(photo);

  const names = el('div');
  names.appendChild(el('h2', 'profile-name', me.username));
  const myFields = fieldNames(me);
  names.appendChild(
    el('p', 'profile-role', (KIND_LABEL[me.kind] || 'Team member') + (myFields ? ' · ' + myFields : ''))
  );
  head.appendChild(names);
  main.appendChild(head);

  // Kirish ma'lumotlari — login, parol va Telegram bir joyda, joyida tahrirlanadi
  const saveMine = async (patch, done) => {
    try {
      const data = await api('/api/staff/me', { method: 'PATCH', body: patch });
      state.user = data.user;
      if (data.token) {
        state.token = data.token;
        localStorage.setItem(TOKEN_KEY, data.token);
      }
      haptic('success');
      showToast('Saved');
      if (done) done();
      openProfile();
    } catch (err) {
      haptic('error');
      const map = {
        telegram_invalid: 'Telegram username looks wrong — 4 to 32 letters, digits or underscore.',
        password_required: 'Enter a password.',
      };
      showToast(map[err.data?.error] || 'Could not save your details.');
    }
  };

  const details = el('section', 'panel');
  details.appendChild(el('h3', 'panel__title', 'Your details'));
  details.appendChild(infoRow('Login', me.username));
  details.appendChild(
    editableRow('Password', state.myPassword, {
      mono: true,
      secret: true,
      placeholder: 'new password',
      onSave: (value, done) => saveMine({ password: value }, done),
    })
  );
  details.appendChild(
    editableRow('Telegram', me.telegram ? '@' + me.telegram : '', {
      placeholder: '@username',
      onSave: (value, done) => saveMine({ telegram: value }, done),
    })
  );
  main.appendChild(details);

  // Faqat ko'rish uchun — buni admin belgilaydi
  const access = el('section', 'panel');
  access.appendChild(el('h3', 'panel__title', 'Your access'));
  access.appendChild(infoRow('Role', KIND_LABEL[me.kind] || '—'));
  access.appendChild(infoRow('Field', me.kind === 'admin' ? 'Every field' : myFields || 'not assigned'));
  access.appendChild(el('p', 'access-summary', ACCESS_SUMMARY[me.kind]));
  access.appendChild(
    el('p', 'panel__note', 'Your role and field are set by an administrator and cannot be changed here.')
  );
  main.appendChild(access);

  // Hisob haqida
  const about = el('section', 'panel');
  about.appendChild(el('h3', 'panel__title', 'Account'));
  about.appendChild(infoRow('Username', me.username));
  if (me.telegram) about.appendChild(infoRow('Telegram', '@' + me.telegram, { link: 'https://t.me/' + me.telegram }));
  about.appendChild(infoRow('Created', formatDate(me.createdAt)));
  about.appendChild(infoRow('Added by', me.createdBy || '—'));
  about.appendChild(infoRow('Last sign-in', me.lastLoginAt ? formatDate(me.lastLoginAt) : 'This is your first visit'));
  main.appendChild(about);

  // O'zi to'ldirgan ariza — hamma javoblar, har birini o'zgartirsa bo'ladi
  if (state.myApplication) main.appendChild(myApplicationPanel());

  // O'z sohasidagi nomzodlar — mutaxassis profiliga kirganda shu ro'yxatni ko'radi
  if (me.permissions.viewCandidates && me.role !== 'admin') {
    const mine = el('section', 'panel');
    mine.appendChild(el('h3', 'panel__title', `Applicants in your field — ${state.candidates.length}`));

    if (!state.candidates.length) {
      mine.appendChild(
        el(
          'p',
          'panel__note',
          (me.permissions.departments || []).length
            ? 'No applications have arrived for your field yet.'
            : 'No field is assigned to your account yet — ask an administrator to set one.'
        )
      );
    } else {
      const list = el('div', 'card-list');
      for (const item of state.candidates) list.appendChild(candidateCard(item));
      mine.appendChild(list);
    }
    main.appendChild(mine);
  }

  // Siz login-parol bergan ishchilar
  if (me.permissions.addWorkers) {
    const myWorkers = state.team.filter((u) => String(u.createdBy || '').toLowerCase() === me.username);
    const box = el('section', 'panel');
    box.appendChild(el('h3', 'panel__title', `Workers you added — ${myWorkers.length}`));

    if (!myWorkers.length) {
      box.appendChild(el('p', 'panel__note', 'You have not created any worker logins yet.'));
    } else {
      const list = el('div', 'card-list');
      for (const worker of myWorkers) list.appendChild(accountCard(worker));
      box.appendChild(list);
    }
    main.appendChild(box);
  }

  const out = el('button', 'btn btn--danger profile-signout');
  out.type = 'button';
  out.appendChild(icon('logout', 16));
  out.appendChild(el('span', null, 'Sign out'));
  out.addEventListener('click', signOut);
  main.appendChild(out);

  renderShell(main, {
    title: 'Profile',
    subtitle: 'YOUR ACCOUNT',
    onBack: () => {
      state.view = state.user.permissions.viewCandidates ? 'candidates' : 'team';
      render();
    },
  });
}

/* --------------------- o'z arizasi: ko'rish va tahrirlash -------------------- */

async function saveAnswer(fieldId, value, done) {
  try {
    const data = await api('/api/staff/me/application', {
      method: 'PATCH',
      body: { answers: { [fieldId]: value } },
    });
    state.myApplication = data.application;
    haptic('success');
    showToast('Saved');
    if (done) done();
    renderProfile();
  } catch (err) {
    haptic('error');
    showToast(err.data?.fields ? 'Please check this answer.' : 'Could not save the answer.');
  }
}

// Bitta savol: javob matni va uni o'zgartirish uchun qalam
function answerEditor(field) {
  const block = el('div', 'answer');

  const head = el('div', 'answer__head');
  head.appendChild(el('p', 'answer__q', field.label));

  const pencil = el('button', 'row__pencil');
  pencil.type = 'button';
  pencil.title = 'Change';
  pencil.appendChild(icon('pencil', 15));
  head.appendChild(pencil);
  block.appendChild(head);

  const shown = field.text
    ? el('p', 'answer__a', field.text)
    : el('p', 'answer__a answer__a--empty', 'No answer');
  block.appendChild(shown);

  const editor = el('div', 'answer__editor');
  editor.hidden = true;
  block.appendChild(editor);

  const close = () => {
    editor.hidden = true;
    editor.innerHTML = '';
    shown.hidden = false;
    pencil.hidden = false;
  };

  pencil.addEventListener('click', () => {
    shown.hidden = true;
    pencil.hidden = true;
    editor.hidden = false;
    editor.innerHTML = '';

    let read = () => '';

    if (field.type === 'chips') {
      const current = Array.isArray(field.value) ? [...field.value] : field.value ? [field.value] : [];
      const chips = el('div', 'chips');

      for (const option of field.options) {
        const chip = el('button', 'chip', option.label);
        chip.type = 'button';
        chip.setAttribute('aria-pressed', String(current.includes(option.value)));
        chip.addEventListener('click', () => {
          if (field.multi) {
            const at = current.indexOf(option.value);
            if (at >= 0) current.splice(at, 1);
            else current.push(option.value);
          } else {
            current.length = 0;
            current.push(option.value);
          }
          [...chips.children].forEach((c, i) =>
            c.setAttribute('aria-pressed', String(current.includes(field.options[i].value)))
          );
        });
        chips.appendChild(chip);
      }
      editor.appendChild(chips);
      read = () => (field.multi ? [...current] : current[0] || '');
    } else {
      const isLong = field.type === 'textarea';
      const input = el(isLong ? 'textarea' : 'input', 'answer__input');
      if (!isLong) input.type = field.type === 'number' ? 'number' : field.type;
      if (field.max && !isLong) input.maxLength = field.max;
      if (field.max && isLong) input.maxLength = field.max;
      input.value = Array.isArray(field.value) ? field.value.join(', ') : field.value || '';
      editor.appendChild(input);
      setTimeout(() => input.focus(), 0);
      read = () => input.value.trim();
    }

    const actions = el('div', 'answer__actions');
    const save = el('button', 'btn btn--primary', 'Save');
    save.type = 'button';
    save.addEventListener('click', () => saveAnswer(field.id, read(), close));

    const cancel = el('button', 'btn btn--soft', 'Cancel');
    cancel.type = 'button';
    cancel.addEventListener('click', close);

    actions.append(save, cancel);
    editor.appendChild(actions);
  });

  return block;
}

function myApplicationPanel() {
  const app = state.myApplication;
  const box = el('section', 'panel');
  box.appendChild(el('h3', 'panel__title', 'Your application'));

  box.appendChild(infoRow('Application', app.id));
  box.appendChild(infoRow('Submitted', formatDate(app.createdAt)));
  if (app.hasCv) box.appendChild(infoRow('Resume', app.cvFileName || 'attached'));
  box.appendChild(el('p', 'panel__note', 'These are the answers you gave. Tap the pencil to change any of them.'));

  for (const section of app.sections) {
    box.appendChild(el('h4', 'answer-group', section.title));
    for (const field of section.fields) box.appendChild(answerEditor(field));
  }
  return box;
}

async function openProfile() {
  haptic();
  try {
    const me = await api('/api/staff/me');
    state.user = me.user;
    state.departments = me.departments;
    state.myPassword = me.password || '';
    state.myApplication = me.application || null;

    // Profilda ko'rsatish uchun: o'z sohasidagi nomzodlar va o'zi ochgan ishchilar
    if (me.user.permissions.viewCandidates) await loadCandidates({ silent: true });
    if (me.user.permissions.addWorkers || me.user.permissions.manageStaff) await loadTeam();
  } catch {}
  state.view = 'profile';
  renderProfile();
}

/* ------------------------------ jonli yangilash ----------------------------- */

// Ochiq ekranni fon rejimida yangilab turadi: yangi ariza yoki hisob paydo
// bo'lsa o'zi qo'shiladi, o'chirilgani yo'qoladi. Ma'lumot o'zgarmasa
// ekranga tegilmaydi — shunda qidiruv va yozuv jarayoni buzilmaydi.
const LIVE_INTERVAL = 12000;
let liveTimer = null;

const signature = (value) => JSON.stringify(value);

async function liveTick() {
  if (!state.user || document.hidden) return;

  // Foydalanuvchi biror maydonga yozayotgan bo'lsa, tegmaymiz
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;

  try {
    if (state.view === 'candidates' && state.user.permissions.viewCandidates) {
      const before = signature(state.candidates.map((c) => c.id + c.status));
      await loadCandidates({ silent: true });
      if (before !== signature(state.candidates.map((c) => c.id + c.status))) {
        renderCandidates();
        showToast('List updated');
      }
      return;
    }

    if (state.view === 'specialists' || state.view === 'workers') {
      const before = signature(state.team.map((u) => u.username + u.kind + u.workerCount + u.avatar));
      await loadTeam();
      if (before !== signature(state.team.map((u) => u.username + u.kind + u.workerCount + u.avatar))) {
        renderAccounts(state.view === 'specialists' ? 'specialist' : 'worker');
        showToast('List updated');
      }
      return;
    }

    // Ochiq turgan hisob sahifasi
    if (state.view === 'account' && state.account) {
      const before = signature(state.account);
      const data = await api('/api/staff/users/' + encodeURIComponent(state.account.member.username));
      if (before !== signature(data)) {
        state.account = data;
        renderAccount();
        showToast('Updated');
      }
      return;
    }

    // O'z profili
    if (state.view === 'profile') {
      const before = signature([state.user, state.myApplication, state.myPassword]);
      const me = await api('/api/staff/me');
      state.user = me.user;
      state.myPassword = me.password || '';
      state.myApplication = me.application || null;
      if (before !== signature([state.user, state.myApplication, state.myPassword])) {
        renderProfile();
        showToast('Updated');
      }
    }
  } catch {}
}

function startLive() {
  clearInterval(liveTimer);
  liveTimer = setInterval(liveTick, LIVE_INTERVAL);
}

// Ilova ekranga qaytganda darhol yangilaymiz
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) liveTick();
});

/* ---------------------------------- toast ---------------------------------- */

let toastTimer = null;
function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = el('div', 'toast');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

/* ---------------------------------- router --------------------------------- */

function render() {
  if (!state.user) return renderLogin();
  if (state.view === 'profile') return renderProfile();
  if (state.view === 'detail' && state.detail) return renderDetail();
  if (state.view === 'account' && state.account) return renderAccount();
  if (state.view === 'specialists') return loadTeam().then(() => renderAccounts('specialist'));
  if (state.view === 'workers') return loadTeam().then(() => renderAccounts('worker'));
  // Mutaxassislar ro'yxati kerak — ishchi qaysi biriga biriktirilishini tanlash uchun
  if (state.view === 'newworker') return loadTeam().then(renderNewWorker);
  if (!state.user.permissions.viewCandidates) return renderProfile();
  return renderCandidates();
}

async function boot() {
  if (!state.token) return renderLogin();
  try {
    const me = await api('/api/staff/me');
    state.user = me.user;
    state.departments = me.departments;
    state.statuses = me.statuses;

    // Nomzodlarni ko'ra olmaydigan hisob (oddiy ishchi) darhol o'z profilini ochadi
    if (!state.user.permissions.viewCandidates) {
      state.view = 'profile';
      renderProfile();
      startLive();
      return;
    }

    await loadCandidates();
    startLive();
  } catch (err) {
    if (err.message !== 'unauthorized') renderLogin('Connection problem. Please try again.');
  }
}

function noAccessView() {
  const main = el('main', 'admin-main');
  const empty = el('div', 'empty');
  empty.appendChild(el('h3', 'empty__title', 'No access yet'));
  empty.appendChild(
    el('p', 'empty__text', 'Your account cannot view applicant data. Ask an administrator to enable it.')
  );
  main.appendChild(empty);
  return main;
}

tg?.onEvent?.('themeChanged', applyTheme);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

tg?.ready();
tg?.expand();
applyTheme();
boot();
