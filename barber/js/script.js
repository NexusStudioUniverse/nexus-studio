/* НАСТРОЙКИ РАСПИСАНИЯ. День недели: 0 = воскресенье, 1 = понедельник ... 6 = суббота.
   [начало, конец] в часах; null = выходной. */
const HOURS = {0:null, 1:[10,20], 2:[10,20], 3:[10,20], 4:[10,20], 5:[10,20], 6:[10,18]};
const STEP = 30;  // длина слота в минутах
const DAYS = 12;  // сколько ближайших дней показывать

const $ = id => document.getElementById(id);
const service = $('service'), master = $('master'), date = $('date'), time = $('time');
const dateBtn = $('dateBtn'), days = $('days'), timeBtn = $('timeBtn'), slots = $('slots'), result = $('result');
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// Если своего фото .jpg нет, подставляется заглушка .svg с тем же именем
document.querySelectorAll('img[src$=".jpg"]').forEach(img => {
  const fb = () => { img.src = img.src.replace(/\.jpg$/, '.svg'); };
  img.addEventListener('error', fb, {once: true});
  if (img.complete && img.naturalWidth === 0) fb();
});

// Услуги и мастера берутся из текста на странице
service.innerHTML = '<option value="">Выберите услугу</option>';
document.querySelectorAll('.svc h3, .svc [data-option]').forEach(h => service.add(new Option(h.dataset.option || h.textContent)));
master.innerHTML = '<option value="" data-i18n="select_a_master">Выберите мастера</option><option value="Любой свободный мастер" data-i18n="barber_select_any_master">Любой свободный мастер</option>';
const names = [...document.querySelectorAll('.master b')].map(b => b.textContent);
names.forEach((n, i) => { const o = new Option(n, n); o.setAttribute('data-i18n', 'barber_master_' + (i + 1) + '_name'); master.add(o); });

// Выпадающие панели
const pairs = [[dateBtn, days], [timeBtn, slots]];
function setOpen(btn, panel, open) { panel.hidden = !open; btn.setAttribute('aria-expanded', open); }
function closeAll() { pairs.forEach(([b, p]) => setOpen(b, p, false)); }
function toggle(btn, panel) { const o = panel.hidden; closeAll(); setOpen(btn, panel, o); }

// Занятость слотов вычисляется по формуле. Для реальных данных подключите сервер.
function busy(name, day, slot) {
  let h = 0;
  for (const ch of `${name}|${day}|${slot}`) h = (h * 31 + ch.charCodeAt(0)) % 1000;
  return h % 100 < 35;
}
const isBusy = (day, slot) => (master.value === 'Любой свободный мастер' ? names : [master.value]).every(n => busy(n, day, slot));

function resetTime() {
  time.value = '';
  timeBtn.classList.remove('has');
  { const k = date.value ? 'time_select_placeholder' : 'select_a_date_first'; timeBtn.setAttribute('data-i18n', k); timeBtn.textContent = NX.t(k); }
}

// Выбор даты: кнопки на ближайшие дни
const now = new Date();
for (let i = 0; i < DAYS; i++) {
  const d = new Date(); d.setDate(now.getDate() + i);
  const range = HOURS[d.getDay()];
  const closed = !range || (i === 0 && now.getHours() * 60 + now.getMinutes() >= range[1] * 60 - STEP);
  const wd = cap(d.toLocaleDateString(NX.locale, {weekday: 'short'}).replace('.', ''));
  const mon = d.toLocaleDateString(NX.locale, {month: 'short'}).replace('.', '');
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'slot day'; b.disabled = closed;
  if (closed) b.title = 'Недоступно';
  b.innerHTML = `<small>${wd}</small><b>${d.getDate()} ${mon}</b>`;
  b.addEventListener('click', () => {
    date.value = ymd(d);
    dateBtn.textContent = `${wd}, ${d.getDate()} ${mon}`; dateBtn.classList.add('has'); dateBtn.removeAttribute('data-i18n');
    days.querySelectorAll('.slot').forEach(s => s.classList.toggle('on', s === b));
    resetTime(); closeAll(); openSlots();
  });
  days.appendChild(b);
}

// Выбор времени: кнопки со слотами
function openSlots() {
  if (!date.value) { closeAll(); setOpen(dateBtn, days, true); return; }
  slots.innerHTML = '';
  const [y, m, d] = date.value.split('-').map(Number);
  const range = HOURS[new Date(y, m - 1, d).getDay()];
  const today = date.value === ymd(new Date()), n = new Date();
  for (let t = range[0] * 60; t < range[1] * 60; t += STEP) {
    const label = `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'slot'; b.textContent = label;
    if ((today && t <= n.getHours() * 60 + n.getMinutes()) || isBusy(date.value, label)) { b.disabled = true; b.title = 'Недоступно'; }
    b.addEventListener('click', () => {
      time.value = label; timeBtn.textContent = label; timeBtn.classList.add('has'); timeBtn.removeAttribute('data-i18n');
      slots.querySelectorAll('.slot').forEach(s => s.classList.toggle('on', s === b));
      closeAll();
    });
    slots.appendChild(b);
  }
  const note = document.createElement('p');
  note.className = 'msg'; note.textContent = 'Тёмные слоты заняты или недоступны.';
  slots.appendChild(note);
  closeAll(); setOpen(timeBtn, slots, true);
}

dateBtn.addEventListener('click', () => toggle(dateBtn, days));
timeBtn.addEventListener('click', () => (slots.hidden ? openSlots() : closeAll()));
master.addEventListener('change', () => { if (date.value) { resetTime(); closeAll(); } });
document.addEventListener('click', e => { if (!e.target.closest('.field')) closeAll(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });

// Отправка формы.
// ВАЖНО: сейчас форма никуда не отправляет данные. Чтобы заявки приходили владельцу,
// подключите сервер или сервис форм (например, Formspree) в этом месте.
$('form').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  if (!f.name.value.trim() || !f.phone.value.trim() || !service.value || !master.value || !date.value || !time.value) {
    result.textContent = 'Заполните все поля: имя, телефон, услугу, мастера, дату и время.';
    return;
  }
  result.textContent = NX.t('bar_thanks').replace('{date}', dateBtn.textContent).replace('{time}', time.value);
});
