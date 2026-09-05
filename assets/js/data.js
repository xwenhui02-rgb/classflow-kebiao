/* ==========================================================================
   ClassFlow · Data
   数据来源：学生个人课表_2024201403339.xls（广东轻工职业技术大学 2026-2027-1）
   说明：本文件为纯数据，周次以字符串保存，由 time.js 解析并缓存。
   ========================================================================== */

window.CF = window.CF || {};

/* ------------------------------------------------------------------ 学期 */
CF.SEMESTER = {
  id: '2026-2027-1',
  label: '2026–2027 学年 第一学期',
  /** 第 1 周周一（可在设置中修改） */
  start: '2026-09-07',
  /** 常规教学周总数 */
  weeks: 16,
  /** 期末集中考试周（预估，用于考试中心提示） */
  examWeeks: [17, 18]
};

/* ------------------------------------------------------------------ 学籍 */
CF.STUDENT = {
  name: '徐文辉',
  sid: '2024201403339',
  klass: '制药243',
  major: '药品生产技术',
  college: '生命健康学院',
  campus: '南海校区（北区）'
};

/* ---------------------------------------------------------------- 节次表 */
CF.SLOTS = [
  { i: 1, name: '第1-2节',   short: '1-2',   start: '08:30', end: '09:55' },
  { i: 2, name: '第3-4节',   short: '3-4',   start: '10:15', end: '11:40' },
  { i: 3, name: '第5-6节',   short: '5-6',   start: '14:00', end: '15:25' },
  { i: 4, name: '第7-8节',   short: '7-8',   start: '15:45', end: '17:10' },
  { i: 5, name: '第9-10节',  short: '9-10',  start: '18:30', end: '19:55' },
  { i: 6, name: '第11-12节', short: '11-12', start: '20:00', end: '21:25' }
];

/* ---------------------------------------------------------------- 课程目录 */
CF.COURSES = {
  smart: {
    id: 'smart', name: '智能制药设备使用与维护技术', short: '智能制药设备',
    color: 'blue', assess: '考试', kind: 'course', teacher: '梁兆明'
  },
  biop: {
    id: 'biop', name: '生物制药技术', short: '生物制药',
    color: 'green', assess: '考试', kind: 'course', teacher: '张媛媛 / 阳元娥'
  },
  elec: {
    id: 'elec', name: '制药设备电气控制技术', short: '电气控制',
    color: 'indigo', assess: '考查', kind: 'course', teacher: '毛莉娜'
  },
  device: {
    id: 'device', name: '医疗器械', short: '医疗器械',
    color: 'purple', assess: '考查', kind: 'course', teacher: '王国华'
  },
  safe: {
    id: 'safe', name: '制药安全生产与环境保护实务', short: '安全生产',
    color: 'orange', assess: '考查', kind: 'course', teacher: '叶铸明'
  },
  career: {
    id: 'career', name: '大学生就业创业指导', short: '就业指导',
    color: 'teal', assess: '考查', kind: 'course', teacher: '刘畅'
  },
  natsec: {
    id: 'natsec', name: '国家安全教育（三）', short: '国家安全',
    color: 'pink', assess: '考查', kind: 'course', teacher: '康威'
  },
  train: {
    id: 'train', name: '药品生产综合实训', short: '综合实训',
    color: 'brown', assess: '考查', kind: 'training', teacher: '轮值教师'
  },
  social: {
    id: 'social', name: '社会实践（二）', short: '社会实践',
    color: 'gray', assess: '考查', kind: 'practice', teacher: '—'
  }
};

/* ------------------------------------------------------------------ 排课
   day   : 1=周一 … 7=周日
   s / e : 起始 / 结束节次索引（对应 CF.SLOTS）；如 5-8 节连堂则 s=3,e=4
   weeks : 生效周（'2-10'、'3-5,8'、'odd'、'even'）
   kind  : course 理论 | lab 实验实训 | training 整周实训
   ------------------------------------------------------------------------ */
CF.SESSIONS = [
  /* ——— 周一 ——— */
  { id: 'm1', course: 'elec',   day: 1, s: 2, e: 2, weeks: '1-10', room: '1202',              kind: 'course' },
  { id: 'm2', course: 'smart',  day: 1, s: 3, e: 4, weeks: '2-10', room: '第三工业实训楼C110', kind: 'lab' },
  { id: 'm3', course: 'device', day: 1, s: 5, e: 5, weeks: '6-9',  room: '2109',              kind: 'course' },
  { id: 'm4', course: 'biop',   day: 1, s: 6, e: 6, weeks: '3',    room: '2108',              kind: 'course', teacher: '阳元娥' },

  /* ——— 周二 ——— */
  { id: 't1', course: 'elec',   day: 2, s: 5, e: 5, weeks: '1-10', room: '1202', kind: 'course' },
  { id: 't2', course: 'device', day: 2, s: 6, e: 6, weeks: '4-7',  room: '2308', kind: 'course' },

  /* ——— 周三 ——— */
  { id: 'w1', course: 'smart',  day: 3, s: 1, e: 1, weeks: '1-10', room: '4201',              kind: 'course' },
  { id: 'w2', course: 'device', day: 3, s: 2, e: 2, weeks: '3',    room: '4202',              kind: 'course' },
  { id: 'w3', course: 'biop',   day: 3, s: 3, e: 4, weeks: '3-8',  room: '第三工业实训楼C206', kind: 'lab', teacher: '阳元娥' },
  { id: 'w4', course: 'biop',   day: 3, s: 4, e: 4, weeks: '1-2',  room: '2109',              kind: 'course', teacher: '张媛媛' },
  { id: 'w5', course: 'safe',   day: 3, s: 5, e: 5, weeks: '1-8',  room: '2110',              kind: 'course' },

  /* ——— 周四 ——— */
  { id: 'r1', course: 'biop',   day: 4, s: 1, e: 2, weeks: '1-2',   room: '第三工业实训楼C206', kind: 'lab', teacher: '张媛媛' },
  { id: 'r2', course: 'safe',   day: 4, s: 1, e: 2, weeks: '9-10',  room: '第三工业实训楼C205', kind: 'lab' },
  { id: 'r3', course: 'device', day: 4, s: 2, e: 2, weeks: '3-5,8', room: '2108',              kind: 'course' },
  { id: 'r4', course: 'career', day: 4, s: 4, e: 4, weeks: '1-12',  room: '2301',              kind: 'course' },
  { id: 'r5', course: 'safe',   day: 4, s: 5, e: 5, weeks: '1-8',   room: '2110',              kind: 'course' },
  { id: 'r6', course: 'biop',   day: 4, s: 6, e: 6, weeks: '3-9',   room: '2108',              kind: 'course', teacher: '阳元娥' },

  /* ——— 周五 ——— */
  { id: 'f1', course: 'device', day: 5, s: 1, e: 1, weeks: '3-9', room: '2308', kind: 'course' },
  { id: 'f2', course: 'biop',   day: 5, s: 3, e: 3, weeks: '1-2', room: '2109', kind: 'course', teacher: '张媛媛' },
  { id: 'f3', course: 'natsec', day: 5, s: 3, e: 3, weeks: '8-9', room: '4201', kind: 'course' }
];

/* ------------------------------------------------------- 整周 / 全天安排 */
CF.WEEKBLOCKS = [
  { id: 'wk-social', course: 'social', weeks: '1',  title: '社会实践（二）', note: '整周安排，具体以学院通知为准' },
  { id: 'wk-train1', course: 'train',  weeks: '10', title: '药品生产综合实训', note: '整周实训', teacher: '阳元娥、张媛媛' },
  { id: 'wk-train2', course: 'train',  weeks: '11', title: '药品生产综合实训', note: '黄敏 · 李立英', teacher: '黄敏、李立英' },
  { id: 'wk-train3', course: 'train',  weeks: '12', title: '药品生产综合实训', note: '王国华 · 叶铸明', teacher: '王国华、叶铸明' }
];

/* ------------------------------------------------------------- 国定假日
   默认按「停课」处理；可在设置中一键关闭。 */
CF.HOLIDAYS = [
  { date: '2026-09-25', label: '中秋节' },
  { date: '2026-10-01', label: '国庆节' },
  { date: '2026-10-02', label: '国庆节' },
  { date: '2026-10-03', label: '国庆节' },
  { date: '2026-10-04', label: '国庆节' },
  { date: '2026-10-05', label: '国庆节' },
  { date: '2026-10-06', label: '国庆节' },
  { date: '2026-10-07', label: '国庆节' },
  { date: '2027-01-01', label: '元旦' }
];

/* ---------------------------------------------------------------- 教室解析
   4 位纯数字教室：首位=楼栋，次位=楼层，后两位=房间号
   例：4201 → 第4教学楼 2 层 01 室 */
CF.ROOM_HINT = {
  '第三工业实训楼C110': { building: '第三工业实训楼', room: 'C110', floor: '1 层', area: '北区实训区' },
  '第三工业实训楼C205': { building: '第三工业实训楼', room: 'C205', floor: '2 层', area: '北区实训区' },
  '第三工业实训楼C206': { building: '第三工业实训楼', room: 'C206', floor: '2 层', area: '北区实训区' }
};

/* ------------------------------------------------------------------ 考试
   教务文件未给出具体考试安排，默认留空；用户可在「考试」页自行添加，
   数据保存在 localStorage，导出/重置见设置。 */
CF.EXAM_TEMPLATE = { id: '', course: '', name: '', date: '', start: '09:00', end: '11:00', room: '', seat: '', note: '' };
