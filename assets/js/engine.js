/* ==========================================================================
   ClassFlow · Engine
   存储 / 设置 / 状态机 / 课程进度 / 冲突检测
   ========================================================================== */

window.CF = window.CF || {};

(function () {
  'use strict';

  const T = CF.t;

  /* ------------------------------------------------------------ 本地存储 */
  const KEY = 'classflow.v1';
  const store = {
    data: null,
    load() {
      if (this.data) return this.data;
      let raw = {};
      try { raw = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { raw = {}; }
      this.data = Object.assign(
        {
          settings: {
            theme: 'auto',               // auto | light | dark
            semesterStart: CF.SEMESTER.start,
            leadTime: 20,                // 建议出发提前量（分钟）
            showWeekend: true,
            hideNonCurrentWeek: true,
            autoHoliday: true,
            reduceMotion: 'auto',        // auto | on | off
            notify: false,
            weekEndsAtFive: true
          },
          exams: [],
          overrides: {},                 // 'YYYY-MM-DD|sessionId' -> 'cancel'
          notes: {},                     // courseId -> text
          lastView: 'now',
          installed: false
        },
        raw
      );
      this.data.settings = Object.assign(
        {
          theme: 'auto', semesterStart: CF.SEMESTER.start, leadTime: 20,
          showWeekend: true, hideNonCurrentWeek: true, autoHoliday: true,
          reduceMotion: 'auto', notify: false, weekEndsAtFive: true
        },
        raw.settings || {}
      );
      return this.data;
    },
    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.load())); }
      catch (e) { console.warn('[ClassFlow] 存储失败', e); }
    },
    get settings() { return this.load().settings; },
    get exams() { return this.load().exams; },
    get overrides() { return this.load().overrides; },
    get notes() { return this.load().notes; },
    reset() {
      localStorage.removeItem(KEY);
      this.data = null;
      this.load();
    }
  };
  CF.store = store;

  /* -------------------------------------------------------- 时间旅行/预览 */
  CF.preview = { active: false, date: T.dstr(new Date()), time: '10:00' };

  function now() {
    const p = CF.preview;
    if (p && p.active) {
      const real = new Date();
      if (T.dstr(real) === p.date) return real;
      const d = T.parseD(p.date);
      const [h, m] = (p.time || '10:00').split(':').map(Number);
      d.setHours(h || 0, m || 0, 0, 0);
      return d;
    }
    return new Date();
  }

  /* ---------------------------------------------------------- 排课工具 */
  const slotByIndex = (i) => CF.SLOTS.find((s) => s.i === i);

  function sessionStartMin(s) { return T.mins(slotByIndex(s.s).start); }
  function sessionEndMin(s) { return T.mins(slotByIndex(s.e).end); }
  function sessionTimeText(s) {
    return slotByIndex(s.s).start + '–' + slotByIndex(s.e).end;
  }
  function sessionSlotText(s) {
    return s.s === s.e ? slotByIndex(s.s).name : slotByIndex(s.s).name.replace(/节$/, '') + '–' + slotByIndex(s.e).name;
  }
  function sessionWeeks(s) { return T.parseWeeks(s.weeks); }
  function sessionTeacher(s) {
    return s.teacher || (CF.COURSES[s.course] && CF.COURSES[s.course].teacher) || '—';
  }
  function sessionCourse(s) { return CF.COURSES[s.course]; }

  /** 该 session 在指定周是否生效 */
  function isOnWeek(s, week) { return sessionWeeks(s).indexOf(week) !== -1; }

  /** 该 session 在指定日期是否生效（含周次/假日/覆盖） */
  function isOnDate(s, dateStr, opts) {
    opts = opts || {};
    const d = T.parseD(dateStr);
    const info = T.weekInfo(d, store.settings.semesterStart);
    if (info.status !== 'in') return false;
    if (T.weekday(d) !== s.day) return false;
    if (!isOnWeek(s, info.week)) return false;
    if (store.data.overrides[dateStr + '|' + s.id] === 'cancel') return false;
    if (opts.ignoreHoliday !== true && store.settings.autoHoliday && T.holidayOn(dateStr)) return false;
    return true;
  }

  /* -------------------------------------------------- 某一天的全部课程 */
  function sessionsOn(dateStr, opts) {
    const d = T.parseD(dateStr);
    const info = T.weekInfo(d, store.settings.semesterStart);
    const list = [];
    CF.SESSIONS.forEach((s) => {
      if (!isOnDate(s, dateStr, opts)) return;
      const c = sessionCourse(s);
      const startMin = sessionStartMin(s);
      const endMin = sessionEndMin(s);
      list.push({
        key: dateStr + '|' + s.id,
        id: s.id,
        session: s,
        course: c,
        courseId: s.course,
        date: dateStr,
        day: s.day,
        week: info.week,
        startMin, endMin,
        startText: slotByIndex(s.s).start,
        endText: slotByIndex(s.e).end,
        timeText: sessionTimeText(s),
        slotText: sessionSlotText(s),
        room: s.room,
        roomInfo: T.roomInfo(s.room),
        teacher: sessionTeacher(s),
        kind: s.kind || (c && c.kind) || 'course',
        color: (c && c.color) || 'gray',
        title: (c && c.name) || '未命名课程',
        short: (c && c.short) || ''
      });
    });
    list.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
    return list;
  }

  /** 某一天的整周 / 全天安排 */
  function weekBlocksOn(dateStr) {
    const d = T.parseD(dateStr);
    const info = T.weekInfo(d, store.settings.semesterStart);
    if (info.status !== 'in') return [];
    return CF.WEEKBLOCKS
      .filter((b) => sessionWeeks(b).indexOf(info.week) !== -1)
      .map((b) => Object.assign({}, b, { course: CF.COURSES[b.course], week: info.week }));
  }

  /* ------------------------------------------------------------ 状态机 */
  /**
   * @returns {Object} 当日状态快照
   *  status: before-semester | holiday | no-class | before-first | in-class
   *          | break | after-last | after-semester
   */
  function dayState(dateStr, atDate) {
    const d = T.parseD(dateStr);
    const ref = atDate || now();
    const isToday = T.dstr(ref) === dateStr;
    const nowMin = isToday ? T.minsNow(ref) : -1;

    const info = T.weekInfo(d, store.settings.semesterStart);
    const holiday = store.settings.autoHoliday ? T.holidayOn(dateStr) : null;

    const base = {
      dateStr, date: isToday ? ref : d, ref: ref, isToday, info, holiday, week: info.week,
      items: [], weekBlocks: [], current: null, next: null,
      status: 'no-class', progress: 0, remainMin: 0, elapsedMin: 0,
      conflicts: []
    };

    if (info.status === 'before') {
      base.status = 'before-semester';
      base.daysToStart = info.daysToStart;
      base.next = nextSessionFrom(dateStr, ref);
      return base;
    }
    if (info.status === 'after') {
      base.status = 'after-semester';
      return base;
    }

    base.weekBlocks = weekBlocksOn(dateStr);
    base.items = sessionsOn(dateStr);
    base.conflicts = detectConflicts(base.items);

    if (holiday) {
      base.status = 'holiday';
      base.next = nextSessionFrom(dateStr, ref);
      return base;
    }
    if (!base.items.length) {
      base.status = 'no-class';
      base.next = nextSessionFrom(dateStr, ref);
      return base;
    }

    if (isToday) {
      for (let i = 0; i < base.items.length; i++) {
        const it = base.items[i];
        if (nowMin >= it.startMin && nowMin < it.endMin) {
          it.state = 'current';
          base.status = 'in-class';
          base.current = it;
          base.next = base.items[i + 1] || null;
          base.elapsedMin = nowMin - it.startMin;
          base.remainMin = it.endMin - nowMin;
          base.progress = (nowMin - it.startMin) / Math.max(1, it.endMin - it.startMin);
          break;
        }
      }
      if (!base.current) {
        const first = base.items[0];
        const last = base.items[base.items.length - 1];
        if (nowMin < first.startMin) {
          base.status = 'before-first';
          base.next = first;
          base.remainMin = first.startMin - nowMin;
        } else if (nowMin >= last.endMin) {
          base.status = 'after-last';
          base.next = nextSessionFrom(dateStr, ref);
        } else {
          base.status = 'break';
          base.next = base.items.find((it) => it.startMin > nowMin) || null;
          base.remainMin = base.next ? base.next.startMin - nowMin : 0;
        }
      }
      base.items.forEach((it) => {
        if (!it.state) it.state = it.endMin <= nowMin ? 'past' : 'upcoming';
      });
    } else {
      base.status = nowMin < 0 ? 'upcoming-day' : 'past-day';
      base.items.forEach((it) => { it.state = 'upcoming'; });
      base.next = base.items[0] || null;
    }
    return base;
  }

  /** 从某天（含当天）向后寻找下一节课 */
  function nextSessionFrom(dateStr, ref, maxDays) {
    maxDays = maxDays || 60;
    let d = T.parseD(dateStr);
    const refDay = ref ? T.dstr(ref) : null;
    const refMin = ref ? T.minsNow(ref) : -1;
    for (let i = 0; i < maxDays; i++) {
      const ds = T.dstr(d);
      const list = sessionsOn(ds);
      // 仅在「今天」这一天才按当前时刻过滤，避免从未来日期起算时漏掉上午的课
      const pick = list.find((it) => (ds === refDay ? it.startMin > refMin : true));
      if (pick) return Object.assign({}, pick, { daysAhead: i });
      d = T.addDays(d, 1);
    }
    return null;
  }

  /** 当前时刻的下一节课（跨天） */
  function nextSession(ref) {
    const r = ref || now();
    return nextSessionFrom(T.dstr(r), r);
  }

  /* ---------------------------------------------------------- 冲突检测 */
  function detectConflicts(items) {
    const out = [];
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        if (a.startMin < b.endMin && b.startMin < a.endMin) out.push([a, b]);
      }
    }
    return out;
  }

  /* -------------------------------------------------------- 课程进度 */
  function courseProgress(courseId, dateStr, ref) {
    const r = ref || now();
    const todayStr = dateStr || T.dstr(r);
    const sessions = CF.SESSIONS.filter((s) => s.course === courseId);
    const all = [];
    sessions.forEach((s) => {
      sessionWeeks(s).forEach((w) => {
        const date = T.dateOf(w, s.day, store.settings.semesterStart);
        const ds = T.dstr(date);
        all.push({
          week: w, date: ds, session: s,
          startMin: sessionStartMin(s),
          startText: slotByIndex(s.s).start,
          room: s.room,
          teacher: sessionTeacher(s),
          cancelled: store.data.overrides[ds + '|' + s.id] === 'cancel'
        });
      });
    });
    all.sort((a, b) => (a.date === b.date ? a.startMin - b.startMin : a.date < b.date ? -1 : 1));

    const total = all.length;
    const done = all.filter((o) => o.date < todayStr).length;
    const todayIdx = all.findIndex((o) => o.date === todayStr);
    const nextOcc = all.find((o) => o.date >= todayStr && !o.cancelled);
    return {
      total, done, remain: Math.max(0, total - done),
      percent: total ? done / total : 0,
      list: all,
      todayIndex: todayIdx,
      next: nextOcc || null,
      last: all[all.length - 1] || null,
      cancelled: all.filter((o) => o.cancelled).length
    };
  }

  /* ------------------------------------------------------------ 考试 */
  function examsSorted() {
    const todayStr = T.dstr(now());
    return store.data.exams
      .slice()
      .map((e) => {
        const days = Math.round((T.parseD(e.date) - T.parseD(todayStr)) / T.DAY);
        return Object.assign({}, e, {
          days,
          past: days < 0,
          soon: days >= 0 && days <= 7,
          course: CF.COURSES[e.course] || null
        });
      })
      .sort((a, b) => (a.date === b.date ? (a.start || '').localeCompare(b.start || '') : a.date < b.date ? -1 : 1));
  }

  /** 需要重点提示的考试（7 天内，且不闪烁） */
  function urgentExam() {
    return examsSorted().find((e) => !e.past && e.days <= 7) || null;
  }

  /* ---------------------------------------------------------- 周课表数据 */
  function weekMatrix(week, semesterStart) {
    const days = [];
    const showWeekend = store.settings.showWeekend;
    const n = showWeekend ? 7 : 5;
    for (let d = 1; d <= n; d++) {
      const date = T.dateOf(week, d, semesterStart);
      const ds = T.dstr(date);
      days.push({
        day: d, date, dateStr: ds,
        items: sessionsOn(ds),
        holiday: store.settings.autoHoliday ? T.holidayOn(ds) : null,
        blocks: weekBlocksOn(ds)
      });
    }
    return days;
  }

  /* ---------------------------------------------------------------- 导出 */
  CF.engine = {
    now, dayState, sessionsOn, weekBlocksOn, nextSession, nextSessionFrom,
    courseProgress, detectConflicts, examsSorted, urgentExam, weekMatrix,
    sessionWeeks, sessionTimeText, sessionSlotText, sessionTeacher, sessionCourse,
    isOnWeek, isOnDate, slotByIndex
  };
})();
