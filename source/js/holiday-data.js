/* ==========================================================
 *  节假日数据  v1.0
 *  数据来源：国务院办公厅《关于2026年部分节假日安排的通知》
 *  （人民网 / 央广网 / 光明网 三方交叉核对）
 *
 *  设计原则：全部内置在本地，不请求任何第三方接口。
 *  原因：公开的节假日 API 普遍有速率限制（实测 apihubs.cn
 *  连续请求 3 次即返回「请求过于频繁」），放在博客上会被限流。
 * ========================================================== */
(function (global) {
  'use strict';

  /* ---------- 法定放假 / 调休上班（2026） ----------
   * h = 放假   w = 调休上班（周末要补班）
   */
  var LEGAL_2026 = {
    // 元旦：1月1日(周四)至3日(周六)放假3天；1月4日(周日)上班
    '2026-01-01': { n: '元旦', t: 'h' },
    '2026-01-02': { n: '元旦', t: 'h' },
    '2026-01-03': { n: '元旦', t: 'h' },
    '2026-01-04': { n: '元旦调休', t: 'w' },

    // 春节：2月15日(腊月廿八)至23日(正月初七)放假9天；2月14日、2月28日上班
    '2026-02-14': { n: '春节调休', t: 'w' },
    '2026-02-15': { n: '除夕', t: 'h' },
    '2026-02-16': { n: '春节', t: 'h' },
    '2026-02-17': { n: '春节', t: 'h' },
    '2026-02-18': { n: '春节', t: 'h' },
    '2026-02-19': { n: '春节', t: 'h' },
    '2026-02-20': { n: '春节', t: 'h' },
    '2026-02-21': { n: '春节', t: 'h' },
    '2026-02-22': { n: '春节', t: 'h' },
    '2026-02-23': { n: '春节', t: 'h' },
    '2026-02-28': { n: '春节调休', t: 'w' },

    // 清明：4月4日(周六)至6日(周一)放假3天
    '2026-04-04': { n: '清明节', t: 'h' },
    '2026-04-05': { n: '清明节', t: 'h' },
    '2026-04-06': { n: '清明节', t: 'h' },

    // 劳动节：5月1日(周五)至5日(周二)放假5天；5月9日上班
    '2026-05-01': { n: '劳动节', t: 'h' },
    '2026-05-02': { n: '劳动节', t: 'h' },
    '2026-05-03': { n: '劳动节', t: 'h' },
    '2026-05-04': { n: '劳动节', t: 'h' },
    '2026-05-05': { n: '劳动节', t: 'h' },
    '2026-05-09': { n: '劳动节调休', t: 'w' },

    // 端午：6月19日(周五)至21日(周日)放假3天
    '2026-06-19': { n: '端午节', t: 'h' },
    '2026-06-20': { n: '端午节', t: 'h' },
    '2026-06-21': { n: '端午节', t: 'h' },

    // 中秋：9月25日(周五)至27日(周日)放假3天
    '2026-09-20': { n: '国庆调休', t: 'w' },
    '2026-09-25': { n: '中秋节', t: 'h' },
    '2026-09-26': { n: '中秋节', t: 'h' },
    '2026-09-27': { n: '中秋节', t: 'h' },

    // 国庆：10月1日(周四)至7日(周三)放假7天；10月10日上班
    '2026-10-01': { n: '国庆节', t: 'h' },
    '2026-10-02': { n: '国庆节', t: 'h' },
    '2026-10-03': { n: '国庆节', t: 'h' },
    '2026-10-04': { n: '国庆节', t: 'h' },
    '2026-10-05': { n: '国庆节', t: 'h' },
    '2026-10-06': { n: '国庆节', t: 'h' },
    '2026-10-07': { n: '国庆节', t: 'h' },
    '2026-10-10': { n: '国庆调休', t: 'w' }
  };

  /* ---------- 每年固定的公历节日 ----------
   * 键为 MM-DD，与年份无关
   */
  var FESTIVAL_FIXED = {
    '01-01': '元旦',
    '02-14': '情人节',
    '03-08': '妇女节',
    '03-12': '植树节',
    '04-01': '愚人节',
    '05-01': '劳动节',
    '05-04': '青年节',
    '06-01': '儿童节',
    '09-10': '教师节',
    '10-01': '国庆节',
    '10-31': '万圣节',
    '11-11': '双十一',
    '12-24': '平安夜',
    '12-25': '圣诞节',
    '12-31': '跨年夜'
  };

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function md(d) { return pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  // 第 n 个星期 w（0=周日）所在日期
  function nthWeekday(year, month /* 0-11 */, weekday /* 0-6 */, n) {
    var d = new Date(year, month, 1);
    var diff = (weekday - d.getDay() + 7) % 7;
    return new Date(year, month, 1 + diff + (n - 1) * 7);
  }

  var WEEK_CN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  /* ---------- 对外接口 ---------- */

  var Holiday = {
    WEEK_CN: WEEK_CN,

    /**
     * 查询某天的信息
     * @param {Date} date
     * @returns {{legal:Object|null, festival:string, weekday:string,
     *            isWeekend:boolean, isHoliday:boolean, isWorkday:boolean}}
     */
    info: function (date) {
      var d = date || new Date();
      var key = ymd(d);
      var mkey = md(d);
      var legal = LEGAL_2026[key] || null;

      // 节日名：法定优先，其次按规则，其次固定表
      var festival = legal && legal.t === 'h' ? legal.n : '';
      if (!festival) {
        var ruleName = this._ruleFestival(d);
        festival = ruleName || FESTIVAL_FIXED[mkey] || '';
      }

      var dow = d.getDay();
      var isWeekend = dow === 0 || dow === 6;

      // 是否放假：法定标记 h = 放假；否则看周末（但调休上班除外）
      var isHoliday = legal ? legal.t === 'h' : isWeekend;
      // 是否要上班：法定 w = 补班；否则非周末即工作日
      var isWorkday = legal ? legal.t === 'w' : !isWeekend;

      return {
        date: d,
        key: key,
        legal: legal,
        festival: festival,
        weekday: WEEK_CN[dow],
        isWeekend: isWeekend,
        isHoliday: isHoliday,
        isWorkday: isWorkday,
        day: d.getDate(),
        month: d.getMonth() + 1
      };
    },

    _ruleFestival: function (d) {
      var y = d.getFullYear();
      var mkey = md(d);
      if (md(nthWeekday(y, 4, 0, 2)) === mkey) return '母亲节';   // 5月第2个周日
      if (md(nthWeekday(y, 5, 0, 3)) === mkey) return '父亲节';   // 6月第3个周日
      if (md(nthWeekday(y, 10, 4, 4)) === mkey) return '感恩节';  // 11月第4个周四
      return '';
    },

    /** 距离下一个法定假期还有多少天（返回 {name, days} 或 null） */
    nextHoliday: function (from) {
      var base = from || new Date();
      base = new Date(base.getFullYear(), base.getMonth(), base.getDate());
      var best = null;
      Object.keys(LEGAL_2026).forEach(function (k) {
        if (LEGAL_2026[k].t !== 'h') return;
        var p = k.split('-');
        var d = new Date(+p[0], +p[1] - 1, +p[2]);
        var diff = Math.round((d - base) / 86400000);
        if (diff < 0) return;

        // 找连续假期的第一天作为假期名
        var prev = new Date(d.getTime() - 86400000);
        var isStart = true;
        var pk = ymd(prev);
        if (LEGAL_2026[pk] && LEGAL_2026[pk].t === 'h') isStart = false;
        if (!isStart) return;

        if (!best || diff < best.days) best = { name: LEGAL_2026[k].n, days: diff, date: d };
      });
      return best;
    },

    /** 按时段生成问候语 */
    greeting: function (date) {
      var h = (date || new Date()).getHours();
      if (h >= 0 && h < 5) return '夜深了';
      if (h < 8) return '早上好';
      if (h < 11) return '上午好';
      if (h < 13) return '中午好';
      if (h < 18) return '下午好';
      if (h < 20) return '傍晚好';
      if (h < 23) return '晚上好';
      return '夜深了';
    },

    /** 按时段返回一句应景的话 */
    tip: function (date, holidayName) {
      if (holidayName) return '今天是' + holidayName + '，好好休息一下吧';
      var h = (date || new Date()).getHours();
      if (h >= 0 && h < 5) return '早点睡，别熬太晚';
      if (h < 8) return '新的一天，从这里开始';
      if (h < 11) return '状态最好的时候，做点难的事';
      if (h < 13) return '记得吃饭，别饿着';
      if (h < 18) return '喝口水，活动一下';
      if (h < 20) return '辛苦了，歇一会儿';
      if (h < 23) return '愿你今晚睡得踏实';
      return '夜猫子，注意身体';
    },

    /** 给日历用的：某月每一天的类型标记 */
    monthMap: function (year, month /* 1-12 */) {
      var out = {};
      for (var day = 1; day <= 31; day++) {
        var key = year + '-' + pad(month) + '-' + pad(day);
        if (LEGAL_2026[key]) out[day] = LEGAL_2026[key];
      }
      return out;
    },

    /** 数据覆盖到的年份（用于提示"数据已过期"） */
    supportedYears: [2026]
  };

  global.BlogHoliday = Holiday;
})(window);
