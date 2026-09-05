/* ==========================================================================
   ClassFlow · App
   路由 / 主题 / 事件 / 弹层 / 导出 / PWA
   ========================================================================== */

(function () {
  'use strict';

  const T = CF.t, E = CF.engine, R = CF.render, S = CF.store;
  const VIEWS = [
    { id: 'now', label: '现在', icon: 'now' },
    { id: 'today', label: '今天', icon: 'list' },
    { id: 'week', label: '周表', icon: 'grid' },
    { id: 'calendar', label: '日历', icon: 'calendar' },
    { id: 'exam', label: '考试', icon: 'exam' }
  ];

  CF.ui = { view: 'now', week: null, date: null, calDate: null, calMonth: null };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ------------------------------------------------------------- 主题 */
  const mqDark = window.matchMedia('(prefers-color-scheme: dark)');
  const mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function effectiveTheme() {
    const t = S.settings.theme;
    return t === 'auto' ? (mqDark.matches ? 'dark' : 'light') : t;
  }
  function applyTheme() {
    document.documentElement.dataset.theme = effectiveTheme();
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', effectiveTheme() === 'dark' ? '#000000' : '#f5f5f7');
  }
  function applyMotion() {
    const m = S.settings.reduceMotion;
    const on = m === 'on' || (m === 'auto' && mqMotion.matches);
    document.documentElement.dataset.reduceMotion = on ? 'true' : 'false';
  }
  mqDark.addEventListener('change', () => { if (S.settings.theme === 'auto') { applyTheme(); } });
  mqMotion.addEventListener('change', applyMotion);

  /* ------------------------------------------------------------- 路由 */
  function go(view) {
    if (!VIEWS.some((v) => v.id === view) && view !== 'settings') view = 'now';
    CF.ui.view = view;
    S.data.lastView = view === 'settings' ? S.data.lastView || 'now' : view;
    S.save();
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function render() {
    const view = CF.ui.view;
    let html = '';
    try {
      if (view === 'now') html = R.nowHTML();
      else if (view === 'today') html = R.todayHTML();
      else if (view === 'week') html = R.weekHTML();
      else if (view === 'calendar') html = R.calendarHTML();
      else if (view === 'exam') html = R.examHTML();
      else if (view === 'settings') html = R.settingsHTML();
    } catch (err) {
      console.error(err);
      html = '<div class="empty"><div class="empty__title">页面出错了</div><p class="empty__desc">' +
        R.esc(err.message) + '</p></div>';
    }
    const root = $('#view-' + view) || $('#view-now');
    root.innerHTML = html;
    $$('.view').forEach((v) => v.classList.remove('is-active'));
    root.classList.add('is-active');

    // 标签栏
    const idx = VIEWS.findIndex((v) => v.id === view);
    const bar = $('#tabbar');
    bar.style.setProperty('--tab-index', Math.max(0, idx));
    $$('#tabbar .tab').forEach((b) => {
      b.setAttribute('aria-selected', b.dataset.view === view ? 'true' : 'false');
    });
    $('#nav-settings').setAttribute('aria-selected', view === 'settings' ? 'true' : 'false');

    updateTopbar();
  }

  function updateTopbar() {
    const ref = E.now();
    const d = new Date(ref.getTime());
    const info = T.weekInfo(d, S.settings.semesterStart);
    $('#tb-date').textContent = T.fmtMonthDay(d) + ' ' + T.fmtWeekday(d);
    $('#tb-week').textContent =
      CF.preview.active ? '预览 · ' + (info.status === 'in' ? '第 ' + info.week + ' 周' : '学期外')
        : info.status === 'before' ? '距开学 ' + info.daysToStart + ' 天'
          : info.status === 'after' ? '教学周已结束'
            : '第 ' + info.week + ' 周 · ' + CF.SEMESTER.label.replace('2026–2027 学年 ', '');
    const chip = $('#datechip');
    chip.dataset.preview = CF.preview.active ? 'true' : 'false';

    // 考试红点
    const urgent = E.urgentExam();
    $('#tab-exam-dot').classList.toggle('is-on', !!urgent);
  }

  /* ------------------------------------------------------------- 弹层 */
  let sheetOpen = false;
  function openSheet(title, html, opts) {
    opts = opts || {};
    $('#sheet-title').textContent = title;
    $('#sheet-body').innerHTML = html;
    $('#sheet').classList.add('is-open');
    $('#scrim').classList.add('is-open');
    sheetOpen = true;
    if (opts.focusNote) {
      const ta = $('#note-input');
      if (ta) setTimeout(() => ta.focus(), 380);
    }
  }
  function closeSheet() {
    $('#sheet').classList.remove('is-open');
    $('#scrim').classList.remove('is-open');
    sheetOpen = false;
  }

  /* ------------------------------------------------------------- Toast */
  function toast(msg, iconName) {
    const host = $('#toast-host');
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = (iconName ? R.ic(iconName) : '') + '<span>' + R.esc(msg) + '</span>';
    host.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-out');
      setTimeout(() => el.remove(), 240);
    }, 2200);
  }

  /* --------------------------------------------------------- ICS 导出 */
  function icsEscape(s) {
    return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;')
      .replace(/,/g, '\\,').replace(/\n/g, '\\n');
  }
  function icsStamp(d) {
    return d.getUTCFullYear() + T.pad(d.getUTCMonth() + 1) + T.pad(d.getUTCDate()) + 'T' +
      T.pad(d.getUTCHours()) + T.pad(d.getUTCMinutes()) + T.pad(d.getUTCSeconds()) + 'Z';
  }
  function download(name, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function buildICS(onlyKey) {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0',
      'PRODID:-//ClassFlow//Course Schedule//ZH-CN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    const stamp = icsStamp(new Date());

    function event(uid, start, end, summary, location, desc, allDay) {
      lines.push('BEGIN:VEVENT', 'UID:' + uid, 'DTSTAMP:' + stamp);
      if (allDay) {
        lines.push('DTSTART;VALUE=DATE:' + start, 'DTEND;VALUE=DATE:' + end);
      } else {
        lines.push('DTSTART:' + start, 'DTEND:' + end);
      }
      lines.push('SUMMARY:' + icsEscape(summary));
      if (location) lines.push('LOCATION:' + icsEscape(location));
      if (desc) lines.push('DESCRIPTION:' + icsEscape(desc));
      lines.push('BEGIN:VALARM', 'TRIGGER:-PT' + (S.settings.leadTime || 20) + 'M',
        'ACTION:DISPLAY', 'DESCRIPTION:' + icsEscape(summary), 'END:VALARM');
      lines.push('END:VEVENT');
    }

    const num = (s) => s.replace(/[-:]/g, '');

    if (onlyKey) {
      const [dateStr, sid] = onlyKey.split('|');
      const s = CF.SESSIONS.find((x) => x.id === sid);
      const c = CF.COURSES[s.course];
      const start = num(dateStr) + 'T' + num(E.slotByIndex(s.s).start) + '00';
      const end = num(dateStr) + 'T' + num(E.slotByIndex(s.e).end) + '00';
      event('cf-' + sid + '-' + dateStr + '@classflow', start, end, c.name, s.room,
        '教师：' + E.sessionTeacher(s) + '\n' + E.sessionSlotText(s) + '\n第 ' +
        T.weekInfo(T.parseD(dateStr), S.settings.semesterStart).week + ' 周');
    } else {
      CF.SESSIONS.forEach((s) => {
        const c = CF.COURSES[s.course];
        T.parseWeeks(s.weeks).forEach((w) => {
          const date = T.dateOf(w, s.day, S.settings.semesterStart);
          const ds = T.dstr(date);
          if (S.data.overrides[ds + '|' + s.id] === 'cancel') return;
          if (S.settings.autoHoliday && T.holidayOn(ds)) return;
          const start = num(ds) + 'T' + num(E.slotByIndex(s.s).start) + '00';
          const end = num(ds) + 'T' + num(E.slotByIndex(s.e).end) + '00';
          event('cf-' + s.id + '-' + ds + '@classflow', start, end, c.name, s.room,
            '教师：' + E.sessionTeacher(s) + '\n' + E.sessionSlotText(s) + '\n第 ' + w + ' 周');
        });
      });
      CF.WEEKBLOCKS.forEach((b) => {
        T.parseWeeks(b.weeks).forEach((w) => {
          const mon = T.dateOf(w, 1, S.settings.semesterStart);
          const sun = T.addDays(mon, 6);
          event('cf-' + b.id + '-w' + w + '@classflow', num(T.dstr(mon)), num(T.dstr(T.addDays(sun, 1))),
            b.title, CF.STUDENT.campus, b.note, true);
        });
      });
      S.data.exams.forEach((e) => {
        const start = num(e.date) + 'T' + num(e.start || '09:00') + '00';
        const end = num(e.date) + 'T' + num(e.end || '11:00') + '00';
        event('cf-exam-' + e.id + '@classflow', start, end, '【考试】' + (e.name || '考试'), e.room, e.note);
      });
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  /* ------------------------------------------------------- 数据导入导出 */
  function exportJSON() {
    download('classflow-backup-' + T.dstr(new Date()) + '.json',
      JSON.stringify(S.load(), null, 2), 'application/json');
    toast('已导出备份', 'check');
  }
  function importJSON(file) {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const obj = JSON.parse(fr.result);
        localStorage.setItem('classflow.v1', JSON.stringify(obj));
        S.data = null; S.load();
        applyTheme(); applyMotion(); render();
        toast('已恢复数据', 'check');
      } catch (e) { toast('文件格式不正确', 'warn'); }
    };
    fr.readAsText(file);
  }

  /* ------------------------------------------------------------- 事件 */
  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-act]');
    if (!t) {
      if (ev.target.closest('#scrim')) closeSheet();
      return;
    }
    const act = t.dataset.act;

    switch (act) {
      case 'go': go(t.dataset.view); break;

      case 'detail':
        openSheet('课程详情', R.courseDetailHTML(t.dataset.key));
        break;

      case 'note': {
        const p = E.courseProgress(t.dataset.course);
        const s = CF.SESSIONS.find((x) => x.course === t.dataset.course);
        const key = p.next ? p.next.date + '|' + p.next.session.id
          : T.dstr(T.dateOf(T.parseWeeks(s.weeks)[0], s.day, S.settings.semesterStart)) + '|' + s.id;
        openSheet('课程详情', R.courseDetailHTML(key), { focusNote: true });
        break;
      }

      case 'week': {
        const cur = currentWeekIndex();
        let w = (CF.ui.week != null ? CF.ui.week : cur) + Number(t.dataset.delta);
        w = Math.max(1, Math.min(CF.SEMESTER.weeks, w));
        CF.ui.week = w;
        render();
        break;
      }
      case 'week-current': CF.ui.week = null; render(); break;

      case 'month': {
        const base = CF.ui.calMonth || (CF.ui.calDate || T.dstr(E.now())).slice(0, 7);
        const [y, m] = base.split('-').map(Number);
        const d = new Date(y, m - 1 + Number(t.dataset.delta), 1);
        CF.ui.calMonth = d.getFullYear() + '-' + T.pad(d.getMonth() + 1);
        render();
        break;
      }

      case 'pickday': {
        const ds = t.dataset.date;
        if (CF.ui.view === 'calendar') {
          CF.ui.calDate = ds;
          CF.ui.calMonth = ds.slice(0, 7);
        } else {
          CF.ui.date = ds;
          if (CF.ui.view === 'now') go('today');
        }
        render();
        if (CF.ui.view === 'calendar') {
          const box = $('#view-calendar');
          if (box) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        break;
      }

      case 'weekblock': {
        const b = CF.WEEKBLOCKS.find((x) => x.id === t.dataset.id);
        openSheet(b.title, '<div class="kv">' +
          '<div class="kv__k">周次</div><div class="kv__v">' + T.weeksText(b.weeks) + '</div>' +
          '<div class="kv__k">教师</div><div class="kv__v">' + R.esc(b.teacher || '—') + '</div>' +
          '<div class="kv__k">说明</div><div class="kv__v">' + R.esc(b.note || '整周安排') + '</div>' +
          '<div class="kv__k">校区</div><div class="kv__v">' + R.esc(CF.STUDENT.campus) + '</div>' +
          '</div><p class="small muted" style="margin-top:var(--sp-4)">整周实训/实践期间，原课表常规课程以学院通知为准。</p>');
        break;
      }

      case 'cancel':
        S.data.overrides[t.dataset.key] = 'cancel'; S.save();
        openSheet('课程详情', R.courseDetailHTML(t.dataset.key));
        render(); toast('已标记为调课', 'check');
        break;
      case 'uncancel':
        delete S.data.overrides[t.dataset.key]; S.save();
        openSheet('课程详情', R.courseDetailHTML(t.dataset.key));
        render(); toast('已恢复', 'check');
        break;

      case 'ics-one':
        download('classflow-' + t.dataset.key.replace('|', '-') + '.ics', buildICS(t.dataset.key), 'text/calendar');
        toast('已生成日历文件', 'check');
        break;

      case 'exam-add': openSheet('添加考试', R.examFormHTML(null)); break;
      case 'exam-edit': openSheet('编辑考试', R.examFormHTML(t.dataset.id)); break;
      case 'exam-save': {
        const body = $('#sheet-body');
        const val = {};
        $$('[data-f]', body).forEach((i) => { val[i.dataset.f] = i.value.trim(); });
        if (!val.name) { toast('请填写考试名称', 'warn'); break; }
        if (!val.date) { toast('请选择日期', 'warn'); break; }
        if (t.dataset.id) {
          const e = S.data.exams.find((x) => x.id === t.dataset.id);
          Object.assign(e, val);
        } else {
          val.id = 'ex' + Date.now().toString(36);
          S.data.exams.push(val);
        }
        S.save(); closeSheet(); render(); toast('已保存', 'check');
        break;
      }
      case 'exam-del': {
        S.data.exams = S.data.exams.filter((x) => x.id !== t.dataset.id);
        S.save(); closeSheet(); render(); toast('已删除', 'trash');
        break;
      }

      case 'set-seg':
        S.settings[t.dataset.key] = t.dataset.val; S.save();
        applyTheme(); applyMotion(); render();
        break;
      case 'set-sw': {
        const k = t.dataset.key;
        S.settings[k] = !S.settings[k]; S.save();
        render();
        if (k === 'notify' && S.settings[k]) askNotify();
        break;
      }

      case 'enter-preview':
        CF.preview.active = true; go('now'); toast('已进入预览模式 · ' + CF.preview.date + ' ' + CF.preview.time, 'time');
        break;
      case 'exit-preview':
        CF.preview.active = false;
        CF.preview.date = T.dstr(new Date());
        go('now'); toast('已回到今天', 'check');
        break;

      case 'export-ics':
        download('classflow-' + CF.STUDENT.klass + '-' + CF.SEMESTER.id + '.ics', buildICS(null), 'text/calendar');
        toast('已导出日历文件', 'check');
        break;
      case 'export-json': exportJSON(); break;
      case 'import-json': $('#file-input').click(); break;
      case 'reset':
        if (confirm('确定要重置所有个人设置、笔记与考试记录吗？\n（课程表原始数据不受影响）')) {
          S.reset(); applyTheme(); applyMotion(); go('now'); toast('已重置', 'check');
        }
        break;

      case 'install': if (deferredPrompt) { deferredPrompt.prompt(); } break;
    }
  });

  /* 表单类事件 */
  document.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.dataset.act === 'set-date') {
      S.settings[t.dataset.key] = t.value; S.save(); render();
      toast('学期起始日已更新', 'check');
    } else if (t.dataset.act === 'set-num') {
      S.settings[t.dataset.key] = Number(t.value); S.save(); render();
    } else if (t.dataset.act === 'preview-date') {
      CF.preview.date = t.value;
    } else if (t.dataset.act === 'preview-time') {
      CF.preview.time = t.value;
    } else if (t.id === 'file-input' && t.files && t.files[0]) {
      importJSON(t.files[0]); t.value = '';
    }
  });

  document.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.dataset.act === 'note-input') {
      S.notes[t.dataset.course] = t.value;
      S.save();
    }
  });

  /* --------------------------------------------------------- 键盘快捷键 */
  document.addEventListener('keydown', (ev) => {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const tag = (ev.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (ev.key === 'Escape') { closeSheet(); return; }
    const map = { '1': 'now', '2': 'today', '3': 'week', '4': 'calendar', '5': 'exam' };
    if (map[ev.key]) { go(map[ev.key]); return; }
    if (ev.key === '/') { go('settings'); return; }
    if (ev.key.toLowerCase() === 't') {
      CF.preview.active = false; CF.ui.date = null; CF.ui.week = null;
      go('today'); return;
    }
    if (ev.key.toLowerCase() === 'd') { go('settings'); return; }
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
      const delta = ev.key === 'ArrowLeft' ? -1 : 1;
      if (CF.ui.view === 'week') {
        const cur = currentWeekIndex();
        CF.ui.week = Math.max(1, Math.min(CF.SEMESTER.weeks, (CF.ui.week != null ? CF.ui.week : cur) + delta));
      } else if (CF.ui.view === 'calendar') {
        document.querySelector('[data-act="month"][data-delta="' + delta + '"]').click();
        return;
      } else {
        const base = CF.ui.date || T.dstr(E.now());
        CF.ui.date = T.dstr(T.addDays(T.parseD(base), delta));
        if (CF.ui.view === 'now') go('today');
      }
      render();
    }
  });

  function currentWeekIndex() {
    const info = T.weekInfo(new Date(), S.settings.semesterStart);
    return info.status === 'in' ? info.week : info.status === 'before' ? 1 : CF.SEMESTER.weeks;
  }

  /* ------------------------------------------------------------- 通知 */
  function askNotify() {
    if (!('Notification' in window)) { toast('此浏览器不支持通知', 'warn'); S.settings.notify = false; S.save(); return; }
    Notification.requestPermission().then((p) => {
      if (p !== 'granted') { S.settings.notify = false; S.save(); render(); toast('未获得通知权限', 'warn'); }
      else toast('已开启通知权限', 'check');
    });
  }

  /* --------------------------------------------------------- 自动刷新 */
  let lastMinute = -1;
  function tick() {
    const ref = E.now();
    const m = ref.getHours() * 60 + ref.getMinutes();
    if (m === lastMinute) return;
    lastMinute = m;
    if (!sheetOpen && (CF.ui.view === 'now' || CF.ui.view === 'today' || CF.ui.view === 'calendar')) {
      const y = window.scrollY;
      render();
      window.scrollTo(0, y);
    } else {
      updateTopbar();
    }
    maybeNotify(ref);
  }

  /* 上课提醒（本地） */
  const notified = {};
  function maybeNotify(ref) {
    if (!S.settings.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
    const ds = T.dstr(ref);
    const nowMin = T.minsNow(ref);
    E.sessionsOn(ds).forEach((it) => {
      const key = it.key;
      if (notified[key]) return;
      if (it.startMin - nowMin <= (S.settings.leadTime || 20) && it.startMin > nowMin) {
        notified[key] = true;
        try {
          new Notification('即将上课：' + it.title, {
            body: it.startText + ' · ' + it.room + ' · ' + it.teacher,
            tag: key
          });
        } catch (e) { /* 忽略 */ }
      }
    });
  }

  /* ------------------------------------------------------------- 顶栏滚动 */
  function onScroll() {
    $('#topbar').dataset.scrolled = window.scrollY > 4 ? 'true' : 'false';
  }

  /* ------------------------------------------------------------- PWA */
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const b = document.createElement('button');
    b.className = 'btn btn--sm';
    b.dataset.act = 'install';
    b.innerHTML = R.ic('download') + '安装到主屏';
    $('#topbar-actions').appendChild(b);
  });

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* 忽略 */ });
    });
  }

  /* ------------------------------------------------------------- 启动 */
  function boot() {
    S.load();
    applyTheme();
    applyMotion();
    $('#datechip').addEventListener('click', () => {
      go('settings');
      setTimeout(() => {
        const el = document.querySelector('[data-act="preview-date"]');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
    });
    $('#nav-settings').addEventListener('click', () => go('settings'));
    $$('#tabbar .tab[data-view]').forEach((b) => {
      b.addEventListener('click', () => go(b.dataset.view));
    });
    $('#sheet-close').addEventListener('click', closeSheet);

    // 弹层下拉关闭（移动端）
    const sheet = $('#sheet');
    let startY = 0, dragging = false;
    sheet.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; dragging = true; }, { passive: true });
    sheet.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 110) { dragging = false; closeSheet(); }
    }, { passive: true });

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

    go(S.data.lastView || 'now');
    tick();
    setInterval(tick, 15000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  CF.app = { go, render, toast, closeSheet, openSheet };
})();
