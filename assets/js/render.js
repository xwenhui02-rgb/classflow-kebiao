/* ==========================================================================
   ClassFlow · Render
   所有视图的 HTML 生成（模板字符串 + 事件委托）
   ========================================================================== */

window.CF = window.CF || {};

(function () {
  'use strict';

  const T = CF.t;
  const E = CF.engine;
  const S = CF.store;

  /* ------------------------------------------------------------- 工具 */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function ic(name, cls) {
    return '<svg class="icon ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }
  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function colorVar(color) { return 'course-' + (color || 'gray'); }
  /** 统一的周次文案：不在教学周内时给出明确说法而不是「—」 */
  function weekText(info) {
    if (info.status === 'in') return '第 ' + info.week + ' 周';
    if (info.status === 'before') return '开学前';
    return '教学周已结束';
  }

  const KIND_TEXT = { course: '理论', lab: '实验实训', training: '整周实训', practice: '实践', exam: '考试' };

  /* ============================================================ 时间轴 */
  function timelineHTML(state, opts) {
    opts = opts || {};
    const items = state.items;
    if (!items.length) {
      const msg = state.status === 'holiday'
        ? (state.holiday.label + ' · 按节假日停课处理')
        : state.status === 'before-semester'
          ? '本学期尚未开始'
          : state.status === 'after-semester'
            ? '本学期教学周已结束'
            : '这一天没有课，好好休息';
      return '<div class="empty">' +
        '<div class="empty__icon">' + ic('coffee') + '</div>' +
        '<div class="empty__title">' + (state.status === 'no-class' ? '今日无课' : '没有安排') + '</div>' +
        '<p class="empty__desc">' + esc(msg) + '</p></div>';
    }

    const nowMin = state.isToday ? T.minsNow(state.date) : -1;
    const rows = [];

    // 整周实训 / 全天安排
    state.weekBlocks.forEach((b) => {
      rows.push({ type: 'block', at: -1, b });
    });

    items.forEach((it, idx) => {
      // 课间隙（≥45 分钟插入休息行）
      if (idx > 0) {
        const gap = it.startMin - items[idx - 1].endMin;
        if (gap >= 45) rows.push({ type: 'gap', from: items[idx - 1].endMin, to: it.startMin, gap });
      }
      rows.push({ type: 'item', at: it.startMin, it });
    });

    // NOW 指示行
    let nowInserted = false;
    if (state.isToday && nowMin >= 0) {
      const place = () => {
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          if (r.type === 'item' && nowMin >= r.it.startMin && nowMin < r.it.endMin) return i + 1;
          if (r.type === 'gap' && nowMin >= r.from && nowMin < r.to) return i;
          if (r.at > nowMin) return i;
        }
        return rows.length;
      };
      rows.splice(place(), 0, { type: 'now' });
      nowInserted = true;
    }

    const html = rows.map((r) => {
      if (r.type === 'now') {
        return '<div class="tl__row is-nowrow">' +
          '<div class="tl__time"><b class="nowclock num">' + T.fmtClock(state.date) + '</b></div>' +
          '<div class="tl__rail"><span class="tl__node tl__node--now"></span></div>' +
          '<div class="tl__nowbar"><span class="tl__now-tag">NOW</span><i class="tl__now-line"></i></div>' +
          '</div>';
      }
      if (r.type === 'gap') {
        const label = r.from >= 690 && r.to <= 860 ? '午休'
          : r.from >= 1020 && r.to <= 1120 ? '晚餐 / 休息'
            : '空档';
        return '<div class="tl__row is-lunch">' +
          '<div class="tl__time"><b class="num">' + T.fmtDuration(r.gap) + '</b></div>' +
          '<div class="tl__rail"></div>' +
          '<div class="tl__card" style="padding:6px 12px"><div class="tiny muted">' + label +
          ' · ' + minToHM(r.from) + '–' + minToHM(r.to) + '</div></div>' +
          '</div>';
      }
      if (r.type === 'block') {
        const c = r.b.course || {};
        return '<div class="tl__row"><div class="tl__time"><b>全天</b></div>' +
          '<div class="tl__rail"><span class="tl__node" style="box-shadow:0 0 0 2.5px var(--c-' + (c.color || 'gray') + ')"></span></div>' +
          '<div class="tl__card ' + colorVar(c.color) + '" data-act="weekblock" data-id="' + esc(r.b.id) + '">' +
          '<div class="tl__card-title">' + esc(r.b.title) + '</div>' +
          '<div class="tl__card-meta"><span>' + ic('pin', 'icon--sm') + esc(r.b.note || '整周安排') + '</span>' +
          '<span class="chip chip--tinted">第 ' + r.b.week + ' 周</span></div>' +
          '</div></div>';
      }
      const it = r.it;
      const st = it.state || 'upcoming';
      return '<div class="tl__row is-' + st + ' ' + colorVar(it.color) + '">' +
        '<div class="tl__time"><b class="num">' + it.startText + '</b>' + it.endText + '</div>' +
        '<div class="tl__rail"><span class="tl__node"></span></div>' +
        '<button class="tl__card" data-act="detail" data-key="' + esc(it.key) + '">' +
        '<div class="tl__card-title">' + esc(it.title) + '</div>' +
        '<div class="tl__card-meta">' +
        '<span>' + ic('pin', 'icon--sm') + esc(it.room) + '</span>' +
        '<span>' + ic('user', 'icon--sm') + esc(it.teacher) + '</span>' +
        '<span>' + ic('clock', 'icon--sm') + esc(it.slotText) + '</span>' +
        '</div>' +
        (st === 'current' ? '<div class="cluster" style="margin-top:8px"><span class="chip chip--tinted">正在上课 · 剩 ' + Math.max(0, Math.round(it.endMin - nowMin)) + ' 分钟</span></div>' : '') +
        (it.hidden ? '<span class="chip chip--exam" style="margin-top:6px">已调课</span>' : '') +
        '</button></div>';
    }).join('');

    return '<div class="tl">' + html + '</div>';
  }

  function minToHM(m) {
    return T.pad(Math.floor(m / 60)) + ':' + T.pad(m % 60);
  }

  /* ============================================================ NOW 视图 */
  function nowHTML() {
    const ref = E.now();
    const ds = T.dstr(ref);
    const st = E.dayState(ds, ref);
    const urgent = E.urgentExam();

    let banner = '';
    if (CF.preview.active) {
      banner += '<div class="banner"><span class="icon">' + ic('time') + '</span>' +
        '<span class="banner__text">预览模式 · 正在查看 <b>' + T.fmtFull(st.date) + ' ' + (T.dstr(ref) === T.dstr(new Date()) ? '真实时间' : CF.preview.time) + '</b></span>' +
        '<button class="btn btn--sm" data-act="exit-preview">回到今天</button></div>';
    }
    if (st.holiday) {
      banner += '<div class="banner"><span>' + ic('coffee') + '</span><span class="banner__text">' +
        esc(st.holiday.label) + ' · 已按节假日停课处理（设置中可关闭）</span></div>';
    }
    if (urgent) {
      banner += examBannerHTML(urgent);
    }
    if (st.conflicts.length) {
      banner += '<div class="banner banner--info"><span>' + ic('warn') + '</span><span class="banner__text">检测到 ' +
        st.conflicts.length + ' 处课程时间冲突，请核对教务通知</span></div>';
    }

    return banner +
      '<div class="now-grid">' +
      '<div>' +
      heroHTML(st, ref) +
      overviewHTML(st) +
      '</div>' +
      '<div>' +
      '<section class="section"><div class="section__head">' +
      '<h2 class="section__title">今天</h2>' +
      '<span class="section__sub">' + T.fmtFull(st.date) + ' · ' + weekText(st.info) + '</span>' +
      '</div><div class="card card--md">' + timelineHTML(st) + '</div></section>' +
      '</div>' +
      '</div>';
  }

  function examBannerHTML(e) {
    const c = e.course;
    return '<div class="banner" style="background:color-mix(in srgb,var(--danger) 14%,transparent);color:var(--danger)">' +
      '<span>' + ic('exam') + '</span>' +
      '<span class="banner__text"><b>' + esc(e.name || (c && c.name) || '考试') + '</b> · ' +
      (e.days === 0 ? '就在今天' : e.days === 1 ? '明天' : '还有 ' + e.days + ' 天') +
      (e.room ? ' · ' + esc(e.room) : '') + '</span>' +
      '<button class="btn btn--sm" data-act="go" data-view="exam">查看</button></div>';
  }

  /* ------------------------------------------------------------ 主卡片 */
  function heroHTML(st, ref) {
    const lead = S.settings.leadTime;
    let cls = 'hero hero--idle', status = '', name = '', meta = '', timer = '', progress = '', actions = '';
    let color = 'blue';

    if (st.status === 'before-semester') {
      color = 'teal';
      status = '<span class="hero__status"><i class="pulse"></i>假期中</span>';
      name = '距离开学还有 ' + st.daysToStart + ' 天';
      meta = '<span>' + ic('calendar', 'icon--sm') + '第 1 周 ' + (T.fmtMonthDay(T.parseD(S.settings.semesterStart))) + ' 开学</span>' +
        '<span>' + ic('book', 'icon--sm') + CF.SEMESTER.label + '</span>';
      const first = E.nextSessionFrom(S.settings.semesterStart, ref);
      timer = '<div><div class="hero__count num">' + st.daysToStart + '<span class="hero__count-unit">天后</span></div>' +
        '<div class="hero__count-sub">' + T.fmtMonthDay(T.parseD(S.settings.semesterStart)) + ' 开学</div></div>' +
        (first ? '<div class="hero__range">第一堂课<br>' + T.fmtMonthDay(T.parseD(first.date)) + ' ' + first.startText +
          '<br>' + esc(first.title) + '</div>' : '');
      actions = first
        ? '<button class="btn" data-act="detail" data-key="' + esc(first.key) + '">' + ic('info') + '第一堂课详情</button>' +
          '<button class="btn" data-act="go" data-view="week">' + ic('grid') + '看周课表</button>'
        : '';
      cls = 'hero hero--idle hero--free';
    } else if (st.status === 'after-semester') {
      color = 'gray';
      status = '<span class="hero__status">学期已结束</span>';
      name = '本学期教学周已完成';
      meta = '<span>' + ic('check') + '共 ' + CF.SEMESTER.weeks + ' 周</span>';
      cls = 'hero hero--idle hero--free';
    } else if (st.status === 'holiday') {
      color = 'orange';
      status = '<span class="hero__status"><i class="pulse"></i>' + esc(st.holiday.label) + '</span>';
      name = '今天放假';
      const nx = st.next;
      meta = nx ? '<span>' + ic('clock', 'icon--sm') + '下一节：' + esc(nx.title) + '（' + nx.date + '）</span>' : '<span>好好休息</span>';
      if (nx) {
        timer = '<div class="hero__count num">' + (nx.daysAhead || 0) + '<span class="hero__count-unit">天后</span></div>' +
          '<div class="hero__range">' + T.fmtMonthDay(T.parseD(nx.date)) + '<br>' + nx.startText + ' ' + esc(nx.room) + '</div>';
      }
      cls = 'hero hero--idle hero--free';
    } else if (st.status === 'no-class') {
      color = 'teal';
      status = '<span class="hero__status"><i class="pulse"></i>今日无课</span>';
      const nx = st.next;
      name = '今天没有安排';
      meta = '<span>' + ic('coffee', 'icon--sm') + '享受属于自己的时间</span>';
      if (nx) {
        meta += '<span>' + ic('clock', 'icon--sm') + '下一节：' + esc(nx.title) + '</span>';
        const cp = T.countdownParts((nx.daysAhead || 0) * 1440 + nx.startMin - T.minsNow(ref));
        timer = '<div><div class="hero__count num">' + cp.value + '<span class="hero__count-unit">' + cp.unit + (cp.sub ? ' ' + cp.sub : '') + '</span></div>' +
          '<div class="hero__count-sub">' + (nx.daysAhead === 0 ? '今天' : nx.daysAhead === 1 ? '明天' : nx.daysAhead + ' 天后') + ' ' + nx.startText + ' 上课</div></div>' +
          '<div class="hero__range">' + T.fmtMonthDay(T.parseD(nx.date)) + '<br>' + esc(nx.room) + ' · ' + esc(nx.teacher) + '</div>';
        actions = '<button class="btn" data-act="detail" data-key="' + esc(nx.key) + '">' + ic('info') + '课程详情</button>';
      }
      cls = 'hero hero--idle hero--free';
    } else if (st.status === 'in-class') {
      const c = st.current;
      color = c.color;
      cls = 'hero hero--live';
      status = '<span class="hero__status"><i class="pulse"></i>正在上课</span>';
      name = c.title;
      meta = '<span>' + ic('user', 'icon--sm') + esc(c.teacher) + '</span>' +
        '<span>' + ic('pin', 'icon--sm') + esc(c.room) + ' · ' + esc(c.roomInfo.building) + '</span>' +
        '<span>' + ic('clock', 'icon--sm') + esc(c.slotText) + '</span>';
      const cp = T.countdownParts(st.remainMin);
      timer = '<div><div class="hero__count num">' + cp.value + '<span class="hero__count-unit">' + cp.unit + (cp.sub ? ' ' + cp.sub : '') + '</span></div>' +
        '<div class="hero__count-sub">后下课</div></div>' +
        '<div class="hero__range">' + c.startText + ' – ' + c.endText + '<br>已上 ' + Math.round(st.elapsedMin) + ' 分钟</div>';
      const pct = Math.max(0, Math.min(1, st.progress));
      progress = '<div class="hero__progress"><div class="hero__progress-meta">' +
        '<span>课堂进度</span><span class="num">' + Math.round(pct * 100) + '%</span></div>' +
        '<div class="progress progress--lg"><div class="progress__fill" style="width:' + (pct * 100).toFixed(1) + '%"></div></div></div>';
      actions = '<button class="btn btn--primary" data-act="detail" data-key="' + esc(c.key) + '">' + ic('info') + '课程详情</button>' +
        '<button class="btn" data-act="note" data-course="' + esc(c.courseId) + '">' + ic('edit') + '笔记</button>';
    } else if (st.status === 'before-first' || st.status === 'break') {
      const nx = st.next;
      color = nx ? nx.color : 'blue';
      cls = 'hero hero--idle';
      status = '<span class="hero__status"><i class="pulse"></i>' + (st.status === 'break' ? '课间休息' : '即将上课') + '</span>';
      name = nx ? nx.title : '暂无安排';
      if (nx) {
        meta = '<span>' + ic('user', 'icon--sm') + esc(nx.teacher) + '</span>' +
          '<span>' + ic('pin', 'icon--sm') + esc(nx.room) + ' · ' + esc(nx.roomInfo.building) + '</span>' +
          '<span>' + ic('clock', 'icon--sm') + nx.startText + '–' + nx.endText + ' · ' + esc(nx.slotText) + '</span>';
        const cp = T.countdownParts(st.remainMin);
        timer = '<div><div class="hero__count num">' + cp.value + '<span class="hero__count-unit">' + cp.unit + (cp.sub ? ' ' + cp.sub : '') + '</span></div>' +
          '<div class="hero__count-sub">后开始</div></div>' +
          '<div class="hero__range">建议 <b class="num">' + minToHM(Math.max(0, nx.startMin - lead)) + '</b> 出发<br>提前 ' + lead + ' 分钟</div>';
        progress = '<div class="hero__progress"><div class="hero__progress-meta">' +
          '<span>今日进度</span><span class="num">' + st.items.filter((i) => i.state === 'past').length + ' / ' + st.items.length + ' 节</span></div>' +
          '<div class="progress"><div class="progress__fill" style="width:' +
          (st.items.length ? (st.items.filter((i) => i.state === 'past').length / st.items.length * 100).toFixed(1) : 0) + '%"></div></div></div>';
        actions = '<button class="btn btn--primary" data-act="detail" data-key="' + esc(nx.key) + '">' + ic('info') + '课程详情</button>' +
          '<button class="btn" data-act="note" data-course="' + esc(nx.courseId) + '">' + ic('edit') + '笔记</button>';
      }
    } else if (st.status === 'after-last') {
      const nx = st.next;
      color = 'green';
      cls = 'hero hero--idle hero--free';
      status = '<span class="hero__status">' + ic('check') + '今日课程已结束</span>';
      name = '今天上完了 ' + st.items.length + ' 节课';
      meta = '<span>' + ic('coffee', 'icon--sm') + '好好休息，明天见</span>';
      if (nx) {
        meta += '<span>' + ic('clock', 'icon--sm') + '下一节：' + esc(nx.title) + '</span>';
        timer = '<div><div class="hero__count num">' + (nx.daysAhead || 0) + '<span class="hero__count-unit">天后</span></div>' +
          '<div class="hero__count-sub">' + T.fmtMonthDay(T.parseD(nx.date)) + ' ' + nx.startText + '</div></div>' +
          '<div class="hero__range">' + esc(nx.room) + '<br>' + esc(nx.teacher) + '</div>';
        actions = '<button class="btn" data-act="detail" data-key="' + esc(nx.key) + '">' + ic('info') + '课程详情</button>';
      }
      progress = '<div class="hero__progress"><div class="hero__progress-meta">' +
        '<span>今日完成度</span><span class="num">100%</span></div>' +
        '<div class="progress"><div class="progress__fill" style="width:100%"></div></div></div>';
    }

    return '<section class="hero ' + cls.replace('hero ', '') + ' ' + colorVar(color) + '" data-hero>' +
      status +
      '<div class="hero__course">' +
      '<h1 class="hero__name">' + esc(name) + '</h1>' +
      '<div class="hero__meta">' + meta + '</div>' +
      '</div>' +
      (timer ? '<div class="hero__timer">' + timer + '</div>' : '') +
      progress +
      (actions ? '<div class="hero__actions">' + actions + '</div>' : '') +
      '</section>';
  }

  /* ------------------------------------------------------- 今日概览三格 */
  function overviewHTML(st) {
    const items = st.items || [];
    const totalMin = items.reduce((a, b) => a + (b.endMin - b.startMin), 0);
    const done = items.filter((i) => i.state === 'past' || i.state === 'current').length;
    const hours = (totalMin / 60).toFixed(1).replace(/\.0$/, '');
    return '<div class="overview" style="margin-top:var(--sp-4)">' +
      '<div class="stat"><div class="stat__value num">' + items.length + '</div><div class="stat__label">今日课程</div></div>' +
      '<div class="stat"><div class="stat__value num">' + done + '<span style="font-size:var(--fs-15);color:var(--text-3)"> / ' + items.length + '</span></div><div class="stat__label">已进行</div></div>' +
      '<div class="stat"><div class="stat__value num">' + hours + '<span style="font-size:var(--fs-15);color:var(--text-3)"> h</span></div><div class="stat__label">在堂时长</div></div>' +
      '</div>';
  }

  /* ============================================================ TODAY 视图 */
  function todayHTML() {
    const ref = E.now();
    const todayStr = T.dstr(ref);
    const sel = CF.ui.date || todayStr;
    const wInfo = T.weekInfo(T.parseD(sel), S.settings.semesterStart);
    const anchorWeek = wInfo.status === 'in' ? wInfo.week
      : wInfo.status === 'before' ? 1 : CF.SEMESTER.weeks;
    const anchorMon = T.dateOf(anchorWeek, 1, S.settings.semesterStart);

    let strip = '<div class="daypick">';
    for (let i = 0; i < 7; i++) {
      const d = T.addDays(anchorMon, i);
      const ds = T.dstr(d);
      strip += '<button data-act="pickday" data-date="' + ds + '" class="' + (ds === sel ? 'is-active' : '') + '">' +
        '<span>' + T.CN_WEEK[i] + '</span><b class="num">' + d.getDate() + '</b>' +
        (ds === todayStr ? '<span style="font-size:9px;color:var(--c-blue)">今天</span>' : '') +
        '</button>';
    }
    strip += '</div>';

    const st = E.dayState(sel, ref);
    return strip +
      '<section class="section"><div class="section__head">' +
      '<h2 class="section__title">' + T.fmtMonthDay(st.date) + '</h2>' +
      '<span class="section__sub">' + T.fmtWeekdayFull(st.date) + ' · ' + weekText(st.info) + '</span>' +
      '</div><div class="card card--md" id="today-body">' + timelineHTML(st) + '</div></section>';
  }

  /* ============================================================ WEEK 视图 */
  function weekHTML() {
    const ref = E.now();
    const todayStr = T.dstr(ref);
    const info = T.weekInfo(T.parseD(todayStr), S.settings.semesterStart);
    const curWeek = info.status === 'in' ? info.week : info.status === 'before' ? 1 : CF.SEMESTER.weeks;
    const week = CF.ui.week != null ? CF.ui.week : curWeek;
    const days = E.weekMatrix(week, S.settings.semesterStart);
    const showWeekend = S.settings.showWeekend;
    const slotCount = CF.SLOTS.length;

    // {(day,slot): sessionItem|null}
    const cover = {};
    days.forEach((dd) => {
      dd.items.forEach((it) => {
        for (let s = it.session.s; s <= it.session.e; s++) cover[dd.day + '-' + s] = it;
      });
    });

    let head = '<div class="weekbar">' +
      '<button class="iconbtn" data-act="week" data-delta="-1" aria-label="上一周">' + ic('left') + '</button>' +
      '<span class="weekbar__label">第 <b class="num">' + week + '</b> 周' +
      (week === curWeek ? ' · 本周' : '') + '</span>' +
      '<button class="iconbtn" data-act="week" data-delta="1" aria-label="下一周">' + ic('right') + '</button>' +
      '<span class="weekbar__spacer"></span>' +
      (week !== curWeek ? '<button class="btn btn--sm" data-act="week-current">回到本周</button>' : '') +
      '</div>';

    let grid = '<div class="wk__scroll"><div class="wk__grid' + (showWeekend ? '' : ' is-hide-weekend') + '">' +
      '<div class="wk__corner"></div>';

    days.forEach((dd) => {
      const isToday = dd.dateStr === todayStr;
      grid += '<div class="wk__day' + (isToday ? ' is-today' : '') + (dd.day > 5 ? ' is-weekend' : '') + '">' +
        '<span>' + T.CN_WEEK[dd.day - 1] + '</span><small class="num">' + dd.date.getDate() + '</small></div>';
    });

    for (let si = 1; si <= slotCount; si++) {
      const slot = E.slotByIndex(si);
      grid += '<div class="wk__slot"><b class="num">' + slot.start + '</b><span class="num">' + slot.end + '</span><span>' + slot.short + ' 节</span></div>';
      days.forEach((dd) => {
        const key = dd.day + '-' + si;
        const it = cover[key];
        const startedHere = it && it.session.s === si;
        if (it && !startedHere) return;                     // 被跨节块覆盖
        if (!it) {
          grid += '<div class="wk__cell is-empty"></div>';
          return;
        }
        const span = it.session.e - it.session.s + 1;
        const isNow = dd.dateStr === todayStr && T.minsNow(ref) >= it.startMin && T.minsNow(ref) < it.endMin;
        const dim = S.settings.hideNonCurrentWeek && dd.holiday;
        grid += '<button class="wk__block ' + colorVar(it.color) + (it.kind === 'lab' ? ' wk__block--lab' : '') +
          (isNow ? ' is-now' : '') + (dim ? ' is-dim' : '') + '"' +
          ' style="grid-column:' + (dd.day + 1) + ';grid-row:' + (si + 1) + ' / span ' + span + '"' +
          ' data-act="detail" data-key="' + esc(it.key) + '">' +
          '<span class="wk__block-title">' + esc(it.short || it.title) + '</span>' +
          '<span class="wk__block-room">' + esc(it.room) + '</span>' +
          '<span class="wk__block-week">' + T.weeksText(it.session.weeks) + '</span>' +
          '</button>';
      });
    }
    grid += '</div></div>';

    // 整周安排与假日（按周聚合，避免逐日重复）
    const uniqBlocks = E.weekBlocksOn(days[0].dateStr);
    let blocks = '';
    uniqBlocks.forEach((b) => {
      const from = days[0].date, to = days[days.length - 1].date;
      blocks += '<div class="cluster" style="padding:6px 0">' +
        '<span class="dot" style="--c:var(--c-' + (b.course.color || 'gray') + ')"></span>' +
        '<span class="small"><b>' + esc(b.title) + '</b> · ' + T.fmtMonthDay(from) + '–' + T.fmtMonthDay(to) +
        '（' + esc(b.teacher || b.note || '整周安排') + '）</span>' +
        '<span class="chip chip--tinted ' + colorVar(b.course.color) + '">第 ' + b.week + ' 周</span></div>';
    });
    const hols = new Map();
    days.forEach((dd) => { if (dd.holiday) hols.set(dd.holiday.date + dd.holiday.label, dd); });
    hols.forEach((dd, k) => {
      blocks += '<div class="cluster" style="padding:6px 0">' +
        '<span class="chip chip--exam">' + esc(dd.holiday.label) + '</span>' +
        '<span class="small muted">' + T.fmtMonthDay(dd.date) + '（' + T.CN_WEEK[dd.day - 1] + '）停课</span></div>';
    });

    return head + '<div class="card card--md">' + grid + '</div>' +
      (blocks ? '<div class="card card--md" style="margin-top:var(--sp-4)"><div class="section__title" style="font-size:var(--fs-15);margin-bottom:6px">本周特别安排</div>' + blocks + '</div>' : '');
  }

  /* ============================================================ CALENDAR */
  function calendarHTML() {
    const ref = E.now();
    const todayStr = T.dstr(ref);
    const sel = CF.ui.calDate || todayStr;
    const ym = CF.ui.calMonth || sel.slice(0, 7);

    const [y, m] = ym.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const start = T.mondayOf(first);
    const monthLabel = y + ' 年 ' + m + ' 月';

    let head = '<div class="cal__head">' +
      '<button class="iconbtn" data-act="month" data-delta="-1" aria-label="上个月">' + ic('left') + '</button>' +
      '<h2 class="cal__month">' + monthLabel + '</h2>' +
      '<button class="iconbtn" data-act="month" data-delta="1" aria-label="下个月">' + ic('right') + '</button>' +
      '</div>';

    let grid = '<div class="cal__grid">';
    for (let i = 0; i < 7; i++) grid += '<div class="cal__dow">' + T.CN_WEEK[i] + '</div>';
    for (let i = 0; i < 42; i++) {
      const d = T.addDays(start, i);
      const ds = T.dstr(d);
      const out = d.getMonth() !== m - 1;
      const items = E.sessionsOn(ds);
      const hol = S.settings.autoHoliday ? T.holidayOn(ds) : null;
      const wb = E.weekBlocksOn(ds);
      const all = items.concat(wb.map((b) => ({ color: b.course.color })));
      const seen = [];
      const dots = all.filter((it) => (seen.includes(it.color) ? false : (seen.push(it.color), true))).slice(0, 6);
      grid += '<button class="cal__cell ' + colorVar(items[0] ? items[0].color : 'gray') +
        (out ? ' is-out' : '') + (ds === todayStr ? ' is-today' : '') + (ds === sel ? ' is-selected' : '') +
        (hol ? ' is-rest' : '') + '" data-act="pickday" data-date="' + ds + '">' +
        '<span class="cal__num num">' + d.getDate() + (hol ? '<small>' + esc(hol.label) + '</small>' : '') + '</span>' +
        '<span class="cal__dots">' + dots.map((it) => '<i style="--c:var(--c-' + it.color + ')"></i>').join('') + '</span>' +
        (all.length > 6 ? '<span class="cal__more">+' + (all.length - 6) + '</span>' : '') +
        '</button>';
      if (i >= 34 && d.getMonth() !== m - 1 && T.weekday(d) === 7) break;
    }
    grid += '</div>';

    const st = E.dayState(sel, ref);
    return head + '<div class="card card--md">' + grid + '</div>' +
      '<section class="section" style="margin-top:var(--sp-5)">' +
      '<div class="section__head"><h2 class="section__title">' + T.fmtMonthDay(st.date) + '</h2>' +
      '<span class="section__sub">' + T.fmtWeekdayFull(st.date) + ' · ' + weekText(st.info) +
      (sel === todayStr ? ' · 今天' : '') + '</span></div>' +
      '<div class="card card--md">' + timelineHTML(st) + '</div></section>';
  }

  /* ============================================================ EXAM */
  function examHTML() {
    const list = E.examsSorted();
    const ref = E.now();
    const todo = list.filter((e) => !e.past);
    const done = list.filter((e) => e.past);

    let head = '<div class="section__head"><h2 class="section__title">考试中心</h2>' +
      '<button class="btn btn--sm btn--primary" data-act="exam-add">' + ic('plus') + '添加考试</button></div>';

    let body = '';
    if (!todo.length) {
      body = '<div class="empty"><div class="empty__icon">' + ic('exam') + '</div>' +
        '<div class="empty__title">还没有考试安排</div>' +
        '<p class="empty__desc">教务系统暂未提供具体考试日程。你可以在这里手动添加，数据保存在本机浏览器。</p>' +
        '<button class="btn btn--primary" data-act="exam-add">' + ic('plus') + '添加一场考试</button></div>';
    } else {
      body = todo.map((e) => {
        const c = e.course;
        return '<div class="exam ' + (e.soon ? 'is-soon' : '') + ' ' + colorVar(c ? c.color : 'gray') + '" data-act="exam-edit" data-id="' + esc(e.id) + '">' +
          '<div class="exam__cd"><b class="num">' + (e.days === 0 ? '今天' : e.days) + '</b><span>' + (e.days === 0 ? '' : '天后') + '</span></div>' +
          '<div class="exam__main"><div class="exam__name">' + esc(e.name || (c && c.name) || '考试') + '</div>' +
          '<div class="exam__meta">' +
          '<span>' + ic('calendar', 'icon--sm') + T.fmtMonthDay(T.parseD(e.date)) + ' ' + T.fmtWeekday(T.parseD(e.date)) + '</span>' +
          (e.start ? '<span>' + ic('clock', 'icon--sm') + esc(e.start) + '–' + esc(e.end || '') + '</span>' : '') +
          (e.room ? '<span>' + ic('pin', 'icon--sm') + esc(e.room) + '</span>' : '') +
          (e.seat ? '<span>' + ic('user', 'icon--sm') + '座位 ' + esc(e.seat) + '</span>' : '') +
          '</div>' +
          (e.note ? '<div class="small muted" style="margin-top:4px">' + esc(e.note) + '</div>' : '') +
          '</div></div>';
      }).join('');
      body = '<div class="stack stack--3">' + body + '</div>';
    }

    // 考核方式
    const methods = Object.keys(CF.COURSES).map((k) => CF.COURSES[k]);
    const examCourses = methods.filter((c) => c.assess === '考试');
    const checkCourses = methods.filter((c) => c.assess === '考查' && c.kind === 'course');

    let methodHtml = '<section class="section" style="margin-top:var(--sp-6)">' +
      '<div class="section__head"><h2 class="section__title">考核方式</h2>' +
      '<span class="section__sub">来自教务课表</span></div>' +
      '<div class="card card--md">' +
      '<div class="small muted" style="margin-bottom:8px">考试（' + examCourses.length + '）</div>' +
      examCourses.map((c) => '<div class="method ' + colorVar(c.color) + '"><span class="method__dot"></span>' +
        '<span class="method__name">' + esc(c.name) + '</span><span class="chip chip--tinted">考试</span></div>').join('') +
      '<div class="small muted" style="margin:14px 0 8px">考查（' + checkCourses.length + '）</div>' +
      checkCourses.map((c) => '<div class="method ' + colorVar(c.color) + '"><span class="method__dot"></span>' +
        '<span class="method__name">' + esc(c.name) + '</span><span class="chip">考查</span></div>').join('') +
      '</div></section>';

    let planBanner = '<div class="banner banner--info"><span>' + ic('info') + '</span><span class="banner__text">' +
      '预计期末集中考试：第 ' + CF.SEMESTER.examWeeks.join('、') + ' 周（' +
      T.fmtMonthDay(T.dateOf(CF.SEMESTER.examWeeks[0], 1, S.settings.semesterStart)) + ' 起）。具体安排以教务通知为准。' +
      '</span></div>';

    if (done.length) {
      methodHtml += '<section class="section"><div class="section__head"><h2 class="section__title">已结束</h2></div>' +
        '<div class="stack stack--3">' + done.map((e) =>
          '<div class="exam" style="opacity:.6" data-act="exam-edit" data-id="' + esc(e.id) + '">' +
          '<div class="exam__cd" style="background:var(--fill-quiet);color:var(--text-3)"><b class="num">✓</b><span>已考</span></div>' +
          '<div class="exam__main"><div class="exam__name">' + esc(e.name) + '</div>' +
          '<div class="exam__meta"><span>' + T.fmtMonthDay(T.parseD(e.date)) + '</span></div></div></div>').join('') +
        '</div></section>';
    }

    return planBanner + head + body + methodHtml;
  }

  /* ============================================================ SETTINGS */
  function settingsHTML() {
    const s = S.settings;
    const st = CF.STUDENT;
    const preview = CF.preview;

    const seg = (name, val, opts) => '<div class="segmented">' + opts.map((o) =>
      '<button data-act="set-seg" data-key="' + name + '" data-val="' + o.v + '" aria-pressed="' + (val === o.v) + '">' + o.t + '</button>').join('') + '</div>';

    const sw = (name, val, label) => '<button class="switch" role="switch" aria-checked="' + (val ? 'true' : 'false') +
      '" data-act="set-sw" data-key="' + name + '" aria-label="' + esc(label) + '"></button>';

    const row = (title, desc, control) => '<div class="row"><div class="row__main">' +
      '<div class="row__title">' + title + '</div>' + (desc ? '<div class="row__desc">' + desc + '</div>' : '') +
      '</div>' + control + '</div>';

    return '' +
      '<div class="card"><div class="about">' +
      '<div class="about__mark">课</div>' +
      '<div><div class="about__name">ClassFlow · 课时</div>' +
      '<div class="about__desc">' + esc(st.name) + ' · ' + esc(st.klass) + ' · ' + esc(st.major) + '<br>' +
      esc(st.college) + ' · ' + esc(st.campus) + ' · ' + esc(st.sid) + '</div></div></div></div>' +

      '<div class="set-group"><div class="set-group__title">外观</div><div class="set-card">' +
      row('主题', '浅色 / 深色 / 跟随系统', seg('theme', s.theme, [{ v: 'auto', t: '自动' }, { v: 'light', t: '浅色' }, { v: 'dark', t: '深色' }])) +
      row('减少动态效果', '开启后关闭位移与弹簧动画', seg('reduceMotion', s.reduceMotion, [{ v: 'auto', t: '跟随系统' }, { v: 'off', t: '标准' }, { v: 'on', t: '减少' }])) +
      '</div></div>' +

      '<div class="set-group"><div class="set-group__title">学期与周次</div><div class="set-card">' +
      row('第 1 周起始日', '影响教学周与所有周次判断',
        '<input class="input" type="date" style="width:auto;min-width:150px" data-act="set-date" data-key="semesterStart" value="' + esc(s.semesterStart) + '">') +
      row('教学周总数', '当前 ' + CF.SEMESTER.weeks + ' 周', '<span class="chip">' + CF.SEMESTER.weeks + ' 周</span>') +
      row('上课前提醒', '主卡片据此计算建议出发时间',
        '<select class="select" style="width:auto" data-act="set-num" data-key="leadTime">' +
        [5, 10, 15, 20, 30, 45].map((v) => '<option value="' + v + '"' + (s.leadTime === v ? ' selected' : '') + '>提前 ' + v + ' 分钟</option>').join('') +
        '</select>') +
      '</div></div>' +

      '<div class="set-group"><div class="set-group__title">课表显示</div><div class="set-card">' +
      row('周课表显示周末', '', sw('showWeekend', s.showWeekend, '显示周末')) +
      row('国定假日自动停课', '中秋 / 国庆 / 元旦等按停课处理', sw('autoHoliday', s.autoHoliday, '假日停课')) +
      row('浏览器通知提醒', '需授权，暂为本地提示', sw('notify', s.notify, '通知提醒')) +
      '</div></div>' +

      '<div class="set-group"><div class="set-group__title">时间旅行</div><div class="set-card">' +
      row('预览任意一天', '用于提前查看某天的课表',
        '<input class="input" type="date" style="width:auto;min-width:150px" data-act="preview-date" value="' + esc(preview.date) + '">' +
        '<input class="input" type="time" style="width:auto;min-width:110px;margin-left:6px" data-act="preview-time" value="' + esc(preview.time) + '">') +
      '<div style="padding-bottom:var(--sp-4)">' +
      (preview.active
        ? '<button class="btn btn--block" data-act="exit-preview">' + ic('check') + '退出预览，回到今天</button>'
        : '<button class="btn btn--block btn--primary" data-act="enter-preview">' + ic('time') + '进入预览模式</button>') +
      '</div></div></div>' +

      '<div class="set-group"><div class="set-group__title">数据与导出</div><div class="set-card">' +
      row('导出到系统日历', '生成 .ics 文件，含全部课时',
        '<button class="btn btn--sm" data-act="export-ics">' + ic('download') + '导出 .ics</button>') +
      row('备份个人数据', '考试、笔记、调课记录',
        '<button class="btn btn--sm" data-act="export-json">' + ic('download') + '导出</button>') +
      row('恢复数据', '从备份 JSON 恢复',
        '<button class="btn btn--sm" data-act="import-json">' + ic('upload') + '导入</button>') +
      row('重置全部设置', '不会删除课程表原始数据',
        '<button class="btn btn--sm btn--danger" data-act="reset">' + ic('trash') + '重置</button>') +
      '</div></div>' +

      '<div class="set-group"><div class="set-group__title">快捷键</div><div class="set-card" style="padding:var(--sp-4)">' +
      '<div class="cluster" style="gap:var(--sp-3)">' +
      '<span class="small muted"><span class="kbd">1</span>–<span class="kbd">5</span> 切换视图</span>' +
      '<span class="small muted"><span class="kbd">←</span><span class="kbd">→</span> 上/下一天</span>' +
      '<span class="small muted"><span class="kbd">T</span> 回到今天</span>' +
      '<span class="small muted"><span class="kbd">D</span> 时间旅行</span>' +
      '<span class="small muted"><span class="kbd">/</span> 打开设置</span>' +
      '</div></div></div>' +

      '<p class="tiny muted" style="text-align:center;padding:var(--sp-4) 0">ClassFlow V2.0 · 数据来自教务个人课表<br>' +
      '课程表以学校教务系统最终通知为准</p>';
  }

  /* ============================================================ 课程详情 */
  function courseDetailHTML(key) {
    const [dateStr, sid] = key.split('|');
    const s = CF.SESSIONS.find((x) => x.id === sid);
    if (!s) return '<p class="muted">未找到该课程</p>';
    const c = CF.COURSES[s.course];
    const info = T.weekInfo(T.parseD(dateStr), S.settings.semesterStart);
    const prog = E.courseProgress(s.course, dateStr, E.now());
    const note = S.notes[s.course] || '';
    const cancelled = S.data.overrides[dateStr + '|' + s.id] === 'cancel';
    const weeks = T.parseWeeks(s.weeks);
    const ri = T.roomInfo(s.room);
    const ref = E.now();

    const upcoming = prog.list.slice(Math.max(0, prog.todayIndex), Math.max(0, prog.todayIndex) + 6);

    return '<div class="detail__hero ' + colorVar(c.color) + '">' +
      '<div class="detail__name">' + esc(c.name) + '</div>' +
      '<div class="detail__tags">' +
      '<span class="chip chip--tinted">' + (KIND_TEXT[s.kind] || KIND_TEXT[c.kind] || '课程') + '</span>' +
      '<span class="chip">' + esc(c.assess) + '</span>' +
      '<span class="chip">' + T.fmtWeekday(T.parseD(dateStr)) + ' ' + E.sessionSlotText(s) + '</span>' +
      '</div></div>' +

      '<div class="kv" style="margin-bottom:var(--sp-5)">' +
      '<div class="kv__k">时间</div><div class="kv__v num">' + esc(dateStr) + ' · ' + E.sessionTimeText(s) + '</div>' +
      '<div class="kv__k">教师</div><div class="kv__v">' + esc(E.sessionTeacher(s)) + '</div>' +
      '<div class="kv__k">地点</div><div class="kv__v">' + esc(s.room) +
      (ri.building ? ' <span class="muted small">· ' + esc(ri.building) + (ri.floor ? ' ' + esc(ri.floor) : '') + '</span>' : '') + '</div>' +
      '<div class="kv__k">校区</div><div class="kv__v">' + esc(ri.area || CF.STUDENT.campus) + '</div>' +
      '<div class="kv__k">周次</div><div class="kv__v">' + T.weeksText(s.weeks) + '（第 ' + info.week + ' 周）' + '</div>' +
      '</div>' +

      '<div class="card card--flat" style="margin-bottom:var(--sp-5)">' +
      '<div class="cluster" style="justify-content:space-between">' +
      '<span class="small bold">本学期进度</span>' +
      '<span class="small muted num">已上 ' + prog.done + ' / 共 ' + prog.total + ' 次</span></div>' +
      '<div class="progress" style="margin:10px 0"><div class="progress__fill" style="width:' + (prog.percent * 100).toFixed(1) + '%"></div></div>' +
      '<div class="progressline ' + ('course-' + c.color) + '">' +
      weeks.map((w, i) => {
        const occ = prog.list.filter((o) => o.week === w)[0];
        const cls = !occ ? '' : occ.date < dateStr ? 'done' : occ.date === dateStr ? 'next' : '';
        return '<i class="' + cls + '" title="第 ' + w + ' 周 ' + (occ ? occ.date : '') + '"></i>';
      }).join('') + '</div>' +
      '<div class="tiny muted" style="margin-top:8px">色块 = 本节排课的每次上课 · 深色=已上 · 描边=这一次</div>' +
      (prog.next ? '<div class="small" style="margin-top:8px">下次：<b>' + esc(prog.next.date) + ' ' + esc(prog.next.startText) + '</b> · ' + esc(prog.next.room) + '</div>' : '') +
      '</div>' +

      (upcoming.length ? '<div class="small muted" style="margin-bottom:8px">接下来的课次</div><div class="stack stack--3" style="margin-bottom:var(--sp-5)">' +
        upcoming.map((o) => '<div class="cluster" style="justify-content:space-between">' +
          '<span class="small">第 ' + o.week + ' 周 · ' + esc(o.date) + ' ' + T.fmtWeekday(T.parseD(o.date)) + '</span>' +
          '<span class="small muted num">' + esc(o.startText) + ' · ' + esc(o.room) + '</span></div>').join('') + '</div>' : '') +

      '<div class="field"><label class="field__label" for="note-input">课程笔记 / 备注</label>' +
      '<textarea class="textarea" id="note-input" data-act="note-input" data-course="' + esc(s.course) + '" placeholder="记下作业、要带的器材、重点…">' + esc(note) + '</textarea>' +
      '<span class="field__hint">保存在本机浏览器，仅你可见</span></div>' +

      '<div class="cluster">' +
      '<button class="btn" data-act="ics-one" data-key="' + esc(key) + '">' + ic('calendar') + '加入日历</button>' +
      (cancelled
        ? '<button class="btn" data-act="uncancel" data-key="' + esc(key) + '">' + ic('undo') + '恢复这次课</button>'
        : '<button class="btn btn--danger" data-act="cancel" data-key="' + esc(key) + '">' + ic('close') + '标记本次调课</button>') +
      '</div>' +
      (cancelled ? '<div class="banner banner--info" style="margin-top:var(--sp-4)"><span>' + ic('info') + '</span><span class="banner__text">本次已标记为调课/停课</span></div>' : '');
  }

  /* ============================================================ 考试表单 */
  function examFormHTML(id) {
    const e = id ? S.data.exams.find((x) => x.id === id) : null;
    const v = e || Object.assign({}, CF.EXAM_TEMPLATE, { date: T.dstr(E.now()) });
    const courseOpts = Object.keys(CF.COURSES).map((k) =>
      '<option value="' + k + '"' + (v.course === k ? ' selected' : '') + '>' + esc(CF.COURSES[k].name) + '</option>').join('');

    return '<div class="field"><label class="field__label" for="ex-name">考试名称</label>' +
      '<input class="input" id="ex-name" data-f="name" value="' + esc(v.name) + '" placeholder="如：生物制药技术 期末"></div>' +
      '<div class="field"><label class="field__label" for="ex-course">关联课程</label>' +
      '<select class="select" id="ex-course" data-f="course"><option value="">不关联</option>' + courseOpts + '</select></div>' +
      '<div class="field"><label class="field__label" for="ex-date">日期</label>' +
      '<input class="input" id="ex-date" type="date" data-f="date" value="' + esc(v.date) + '"></div>' +
      '<div class="cluster" style="gap:var(--sp-3)">' +
      '<div class="field" style="flex:1"><label class="field__label" for="ex-start">开始</label>' +
      '<input class="input" id="ex-start" type="time" data-f="start" value="' + esc(v.start) + '"></div>' +
      '<div class="field" style="flex:1"><label class="field__label" for="ex-end">结束</label>' +
      '<input class="input" id="ex-end" type="time" data-f="end" value="' + esc(v.end) + '"></div></div>' +
      '<div class="cluster" style="gap:var(--sp-3)">' +
      '<div class="field" style="flex:1"><label class="field__label" for="ex-room">考场</label>' +
      '<input class="input" id="ex-room" data-f="room" value="' + esc(v.room) + '" placeholder="如：4201"></div>' +
      '<div class="field" style="flex:1"><label class="field__label" for="ex-seat">座位号</label>' +
      '<input class="input" id="ex-seat" data-f="seat" value="' + esc(v.seat) + '"></div></div>' +
      '<div class="field"><label class="field__label" for="ex-note">备注</label>' +
      '<input class="input" id="ex-note" data-f="note" value="' + esc(v.note) + '" placeholder="如：带学生证、闭卷"></div>' +
      '<div class="cluster" style="margin-top:var(--sp-4)">' +
      '<button class="btn btn--primary btn--block" data-act="exam-save" data-id="' + esc(e ? e.id : '') + '">' + ic('check') + '保存</button>' +
      (e ? '<button class="btn btn--danger" data-act="exam-del" data-id="' + esc(e.id) + '">' + ic('trash') + '删除</button>' : '') +
      '</div>';
  }

  CF.render = {
    esc, ic, el, timelineHTML, weekText, nowHTML, todayHTML, weekHTML, calendarHTML,
    examHTML, settingsHTML, courseDetailHTML, examFormHTML, colorVar, minToHM
  };
})();
