/* ==========================================================================
   ClassFlow · Time & Week Utils
   日期一律使用本地时区，字符串格式 YYYY-MM-DD
   ========================================================================== */

window.CF = window.CF || {};

(function () {
  'use strict';

  const DAY = 86400000;
  const pad = (n) => String(n).padStart(2, '0');

  /* ------------------------------------------------------------ 基础转换 */
  function dstr(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  /** 'YYYY-MM-DD' → 本地 00:00 的 Date */
  function parseD(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  /** 带时分：'YYYY-MM-DD' + 'HH:MM' */
  function parseDT(day, hm) {
    const d = parseD(day);
    const [h, m] = (hm || '00:00').split(':').map(Number);
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
  }
  function addDays(d, n) {
    const x = new Date(d.getTime());
    x.setDate(x.getDate() + n);
    return x;
  }
  /** 1=周一 … 7=周日 */
  function weekday(d) {
    const w = d.getDay();
    return w === 0 ? 7 : w;
  }
  /** 该日所在周的周一 */
  function mondayOf(d) {
    return addDays(d, -(weekday(d) - 1));
  }
  /** 'HH:MM' → 分钟数 */
  function mins(hm) {
    const [h, m] = hm.split(':').map(Number);
    return h * 60 + (m || 0);
  }
  function minsNow(d) {
    return d.getHours() * 60 + d.getMinutes();
  }
  /** 两个 'HH:MM' 之间的分钟差 */
  function diffMin(a, b) {
    return mins(b) - mins(a);
  }

  /* -------------------------------------------------------- 周次表达式解析 */
  const weekCache = new Map();
  function parseWeeks(spec) {
    if (Array.isArray(spec)) return spec.slice();
    const key = String(spec);
    if (weekCache.has(key)) return weekCache.get(key);

    const total = CF.SEMESTER.weeks;
    let out = [];
    if (key === 'odd') {
      for (let i = 1; i <= total; i += 2) out.push(i);
    } else if (key === 'even') {
      for (let i = 2; i <= total; i += 2) out.push(i);
    } else {
      const set = new Set();
      key.split(',').forEach((part) => {
        part = part.trim();
        if (!part) return;
        const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
        if (m) {
          const a = +m[1], b = +m[2];
          for (let i = Math.min(a, b); i <= Math.max(a, b); i++) set.add(i);
        } else if (/^\d+$/.test(part)) {
          set.add(+part);
        }
      });
      out = Array.from(set).sort((a, b) => a - b);
    }
    weekCache.set(key, out);
    return out;
  }

  /** 把周次数组压缩成人类可读文本：1-10 周 / 3,4,5,8 周 / 单周 */
  function weeksText(spec) {
    const list = parseWeeks(spec);
    if (!list.length) return '未排周';
    const total = CF.SEMESTER.weeks;
    if (list.length === Math.ceil(total / 2) && list.every((w, i) => w === i * 2 + 1)) return '单周';
    if (list.length === Math.floor(total / 2) && list.every((w, i) => w === i * 2 + 2)) return '双周';

    const parts = [];
    let start = list[0], prev = list[0];
    for (let i = 1; i <= list.length; i++) {
      const cur = list[i];
      if (cur === prev + 1) { prev = cur; continue; }
      parts.push(start === prev ? String(start) : start + '-' + prev);
      start = prev = cur;
    }
    return parts.join('、');
  }

  /* ------------------------------------------------------------ 教学周计算 */
  /**
   * @returns {{week:number, index:number, status:'before'|'in'|'after', day:number}}
   *  week 从 1 开始；status=before 表示尚未开学
   */
  function weekInfo(date, semesterStart) {
    const start = parseD(semesterStart || CF.SEMESTER.start);
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diff = Math.round((d - start) / DAY);
    if (diff < 0) return { week: 0, index: 0, status: 'before', day: 0, daysToStart: -diff };
    const total = CF.SEMESTER.weeks;
    const index = Math.floor(diff / 7);          // 0-based
    const week = index + 1;
    if (week > total) return { week, index, status: 'after', day: weekday(d) };
    return { week, index, status: 'in', day: weekday(d) };
  }

  /** 第 w 周第 d 天（1=周一）的日期 */
  function dateOf(w, d, semesterStart) {
    const start = parseD(semesterStart || CF.SEMESTER.start);
    return addDays(start, (w - 1) * 7 + (d - 1));
  }

  /* --------------------------------------------------------------- 格式化 */
  const CN_WEEK = ['一', '二', '三', '四', '五', '六', '日'];
  const CN_WEEK_FULL = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];

  function fmtMonthDay(d) { return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function fmtWeekday(d) { return '星期' + CN_WEEK[weekday(d) - 1]; }
  function fmtWeekdayFull(d) { return CN_WEEK_FULL[weekday(d) - 1]; }
  function fmtFull(d) { return fmtMonthDay(d) + ' ' + fmtWeekday(d); }
  function fmtClock(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  /** 把分钟数格式化为「1 小时 20 分钟」/「38 分钟」 */
  function fmtDuration(min) {
    min = Math.max(0, Math.round(min));
    if (min < 60) return min + ' 分钟';
    const h = Math.floor(min / 60), m = min % 60;
    return m ? h + ' 小时 ' + m + ' 分' : h + ' 小时';
  }
  /** 倒计时主数字 + 单位 */
  function countdownParts(min) {
    min = Math.max(0, Math.ceil(min));
    if (min < 60) return { value: min, unit: '分钟', short: 'min' };
    const h = Math.floor(min / 60), m = min % 60;
    if (h < 24) return { value: h, unit: '小时', sub: m + ' 分', short: 'h' };
    const d = Math.floor(h / 24);
    return { value: d, unit: '天', sub: (h % 24) + ' 小时', short: 'd' };
  }

  /* ------------------------------------------------------------ 教室信息 */
  function roomInfo(room) {
    if (!room) return { building: '', room: '', floor: '', area: CF.STUDENT.campus };
    if (CF.ROOM_HINT[room]) return Object.assign({ area: CF.STUDENT.campus }, CF.ROOM_HINT[room]);
    if (/^\d{4}$/.test(room)) {
      return {
        building: '第' + room[0] + '教学楼',
        floor: room[1] + ' 层',
        room: room.slice(2) + ' 室',
        area: CF.STUDENT.campus
      };
    }
    return { building: room, floor: '', room: '', area: CF.STUDENT.campus };
  }

  /* --------------------------------------------------------------- 假日 */
  function holidayOn(dstrDate) {
    return CF.HOLIDAYS.find((h) => h.date === dstrDate) || null;
  }

  CF.t = {
    DAY, pad, dstr, parseD, parseDT, addDays, weekday, mondayOf,
    mins, minsNow, diffMin, parseWeeks, weeksText,
    weekInfo, dateOf,
    fmtMonthDay, fmtWeekday, fmtWeekdayFull, fmtFull, fmtClock,
    fmtDuration, countdownParts, roomInfo, holidayOn,
    CN_WEEK, CN_WEEK_FULL
  };
})();
