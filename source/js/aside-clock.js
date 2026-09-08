/* ==========================================================
 *  侧边栏「时光问候」卡片
 *  日历 + 实时时钟 + 节假日/调休 + 按时段问候 + 访问者 IP 归属地
 *
 *  依赖：holiday-data.js（提供 window.BlogHoliday）
 *  挂在 #aside-content 下，PJAX 环境只初始化一次
 * ========================================================== */
(function () {
  'use strict';

  var CFG = {
    showIP: true,          // 是否显示 IP 归属地
    maskIP: false,         // true = 隐藏 IP 最后一段（如 1.2.3.*）
    showCalendar: true,    // 是否显示日历
    ipCacheMinutes: 30,    // IP 查询结果缓存时长
    apis: [                // 依次尝试，第一个成功的生效
      {
        url: 'https://myip.ipip.net/json',
        parse: function (r) {
          var L = r.data && r.data.location || [];
          return { ip: r.data && r.data.ip, country: L[0] || '', region: L[1] || '', city: L[2] || '', isp: L[4] || L[3] || '' };
        }
      },
      {
        url: 'https://ipapi.co/json/',
        parse: function (r) {
          return { ip: r.ip, country: r.country_name || '', region: r.region || '', city: r.city || '', isp: r.org || '' };
        }
      },
      {
        url: 'https://api.ipify.org?format=json',
        parse: function (r) { return { ip: r.ip, country: '', region: '', city: '', isp: '' }; }
      }
    ]
  };

  var H = window.BlogHoliday;
  if (!H) { console.warn('[aside-card] 缺少 holiday-data.js'); return; }
  var icon = window.BlogIcon || function () { return ''; };

  var WEEK_SHORT = ['日', '一', '二', '三', '四', '五', '六'];
  var timer = null;

  /* ---------------- 工具 ---------------- */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function isPrivate(ip) {
    return !ip || /^(127\.|10\.|192\.168\.|169\.254\.|::1$|localhost)/.test(ip) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
  }
  function mask(ip) {
    if (!ip) return '';
    var p = ip.split('.');
    if (p.length === 4) return p[0] + '.' + p[1] + '.' + p[2] + '.*';
    return ip.replace(/([0-9a-f]{0,4}):.*/, '$1:***');
  }
  function fetchJSON(url, timeout) {
    if (typeof fetch === 'undefined' || typeof AbortController === 'undefined') {
      return Promise.reject(new Error('浏览器不支持 fetch'));
    }
    var c = new AbortController();
    var t = setTimeout(function () { c.abort(); }, timeout || 5000);
    return fetch(url, { signal: c.signal, cache: 'no-store' })
      .then(function (r) {
        clearTimeout(t);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .catch(function (e) { clearTimeout(t); throw e; });
  }

  /* ---------------- IP 查询 ---------------- */
  function queryIP() {
    var cache = null;
    try { cache = JSON.parse(localStorage.getItem('blog_ip_cache') || 'null'); } catch (e) {}
    if (cache && cache.t && Date.now() - cache.t < CFG.ipCacheMinutes * 60000) {
      return Promise.resolve(cache.d);
    }

    var p = Promise.reject();
    CFG.apis.forEach(function (api) {
      p = p.catch(function () { return fetchJSON(api.url, 4500).then(api.parse); });
    });
    return p.then(function (d) {
      try { localStorage.setItem('blog_ip_cache', JSON.stringify({ t: Date.now(), d: d })); } catch (e) {}
      return d;
    }).catch(function () {
      return { ip: '', country: '', region: '', city: '', isp: '', failed: true };
    });
  }

  /* ---------------- 日历 ---------------- */
  function renderCalendar(wrap, year, month) {
    wrap.innerHTML = '';
    var info = H.info(new Date());
    var today = new Date();
    var isCur = (today.getFullYear() === year && today.getMonth() + 1 === month);

    // 表头
    var head = el('div', 'ac-cal-head');
    head.appendChild(el('button', 'ac-nav', icon('chevL', 14)));
    head.appendChild(el('span', 'ac-cal-title', year + ' 年 ' + month + ' 月'));
    head.appendChild(el('button', 'ac-nav', icon('chevR', 14)));
    wrap.appendChild(head);

    head.querySelector('.ac-nav:first-child').onclick = function () {
      var m = month - 1, y = year; if (m < 1) { m = 12; y--; }
      renderCalendar(wrap, y, m);
    };
    head.querySelector('.ac-nav:last-child').onclick = function () {
      var m = month + 1, y = year; if (m > 12) { m = 1; y++; }
      renderCalendar(wrap, y, m);
    };

    // 星期行
    var wrow = el('div', 'ac-cal-week');
    WEEK_SHORT.forEach(function (w, i) {
      var c = el('span', 'ac-w' + (i === 0 || i === 6 ? ' ac-weekend' : ''), w);
      wrow.appendChild(c);
    });
    wrap.appendChild(wrow);

    // 日期格
    var grid = el('div', 'ac-cal-grid');
    var first = new Date(year, month - 1, 1).getDay();
    var days = new Date(year, month, 0).getDate();
    var map = H.monthMap(year, month);

    for (var i = 0; i < first; i++) grid.appendChild(el('span', 'ac-cell ac-empty'));
    for (var d = 1; d <= days; d++) {
      var cls = 'ac-cell';
      var dow = new Date(year, month - 1, d).getDay();
      if (dow === 0 || dow === 6) cls += ' ac-weekend';
      var m = map[d];
      if (m && m.t === 'h') cls += ' ac-holiday';
      if (m && m.t === 'w') cls += ' ac-workday';
      if (isCur && d === today.getDate()) cls += ' ac-today';

      var cell = el('span', cls, '<em>' + d + '</em>');
      var mark = '';
      if (m && m.t === 'h') mark = '休';
      else if (m && m.t === 'w') mark = '班';
      if (mark) {
        var b = el('i', 'ac-mark' + (m.t === 'h' ? ' ac-mark-h' : ''), mark);
        cell.appendChild(b);
      }
      grid.appendChild(cell);
    }
    wrap.appendChild(grid);
  }

  /* ---------------- 主卡片 ---------------- */
  function build() {
    var aside = document.querySelector('#aside-content');
    if (!aside || document.getElementById('aside-clock-card')) return;

    var card = el('div', 'card-widget ac-card');
    card.id = 'aside-clock-card';

    // 头部：问候 + 时间
    var head = el('div', 'ac-head');
    head.innerHTML =
      '<div class="ac-greet"><span class="ac-greet-text">你好</span>' +
      '<span class="ac-wave">👋</span></div>' +
      '<div class="ac-clock"><span class="ac-time">--:--:--</span>' +
      '<span class="ac-date">--</span></div>';
    card.appendChild(head);

    // IP 归属地
    if (CFG.showIP) {
      var ipbox = el('div', 'ac-ip');
      ipbox.innerHTML =
        '<div class="ac-ip-line">' + icon('location', 14) +
        '<span class="ac-ip-text">正在定位…</span></div>' +
        '<div class="ac-ip-extra"></div>';
      card.appendChild(ipbox);
    }

    // 节假日条
    var fest = el('div', 'ac-fest');
    card.appendChild(fest);

    // 日历
    if (CFG.showCalendar) {
      var cal = el('div', 'ac-cal');
      card.appendChild(cal);
      var now = new Date();
      renderCalendar(cal, now.getFullYear(), now.getMonth() + 1);
    }

    // 插入位置：紧跟作者卡片之后，没有就放最前面
    var author = aside.querySelector('.card-widget.card-author, .card-author, .card-widget');
    if (author && author.parentNode === aside) aside.insertBefore(card, author.nextSibling);
    else aside.insertBefore(card, aside.firstChild);

    tick();
    if (timer) clearInterval(timer);
    timer = setInterval(tick, 1000);

    if (CFG.showIP) loadIP(card);
  }

  function tick() {
    var card = document.getElementById('aside-clock-card');
    if (!card) { clearInterval(timer); timer = null; return; }
    var now = new Date();
    var info = H.info(now);

    var t = card.querySelector('.ac-time');
    if (t) t.textContent = pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());

    var dt = card.querySelector('.ac-date');
    if (dt) dt.textContent = now.getMonth() + 1 + '月' + now.getDate() + '日 · ' + H.WEEK_CN[now.getDay()];

    var g = card.querySelector('.ac-greet-text');
    if (g) g.textContent = H.greeting(now);

    // 节假日条
    var fest = card.querySelector('.ac-fest');
    if (fest) {
      var parts = [];
      if (info.festival) {
        parts.push('<span class="ac-tag ac-tag-h">🎉 ' + esc(info.festival) + '</span>');
      }
      if (info.legal && info.legal.t === 'w') {
        parts.push('<span class="ac-tag ac-tag-w">调休上班</span>');
      } else if (info.isHoliday && !info.festival) {
        parts.push('<span class="ac-tag ac-tag-h">休息日</span>');
      }
      var next = H.nextHoliday(now);
      if (next) {
        parts.push('<span class="ac-tag ac-tag-n">距' + esc(next.name) +
          (next.days === 0 ? '（就是今天）' : '还有 ' + next.days + ' 天') + '</span>');
      }
      parts.push('<span class="ac-tip">' + esc(H.tip(now, info.festival)) + '</span>');
      fest.innerHTML = parts.join('');
    }

    // 今天高亮（跨天时刷新日历）
    var cal = card.querySelector('.ac-cal');
    if (cal && cal.dataset.d !== String(now.getDate())) {
      cal.dataset.d = String(now.getDate());
      renderCalendar(cal, now.getFullYear(), now.getMonth() + 1);
    }
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function loadIP(card) {
    queryIP().then(function (d) {
      var box = card.querySelector('.ac-ip');
      if (!box) return;
      var txt = box.querySelector('.ac-ip-text');
      var extra = box.querySelector('.ac-ip-extra');
      if (!txt) return;

      if (!d || d.failed || !d.ip) {
        txt.textContent = '欢迎来访，愿你今天顺心';
        box.classList.add('ac-ip-failed');
        return;
      }
      if (isPrivate(d.ip)) {
        txt.innerHTML = '欢迎来自 <b>本机</b> 的友友';
        if (extra) extra.textContent = '本地环境不显示公网归属 · ' + (CFG.maskIP ? mask(d.ip) : d.ip);
        return;
      }

      // 归属地：优先"省 + 市"，去掉重复的省名前缀
      var region = (d.region || '').replace(/(省|市|自治区|壮族|回族|维吾尔|特别行政区)$/, '');
      var city = (d.city || '').replace(/(市|地区|自治州|盟|县)$/, '');
      var place;
      if (region && city && region !== city) place = region + ' · ' + city;
      else place = region || city || d.country || '远方';

      txt.innerHTML = '欢迎来自 <b>' + esc(place) + '</b> 的友友';
      if (extra) {
        var bits = [];
        if (d.isp) bits.push(esc(d.isp));
        bits.push(CFG.maskIP ? mask(d.ip) : esc(d.ip));
        extra.textContent = bits.join(' · ');
      }
    });
  }

  /* ---------------- 启动 ---------------- */
  function start(attempt) {
    attempt = attempt || 0;
    if (document.querySelector('.aside-clock-card')) return;
    var host = document.querySelector('#aside-content');
    if (!host) {
      // aside 还没好（PJAX 早期或外部 CDN 阻塞渲染），最多重试 100 次（≈10s）
      if (attempt < 100) {
        setTimeout(function () { start(attempt + 1); }, 100);
      }
      return;
    }
    build();
  }

  start();

  // 兼容无 PJAX 的重复注入
  if (typeof window.anzhiyu !== 'undefined' && window.anzhiyu.refreshFn) {
    // 主题提供刷新钩子时无需处理，卡片是常驻 DOM
  }
  document.addEventListener('pjax:complete', function () {
    if (timer) clearInterval(timer);
    // PJAX:complete 时旧卡片已被新页面替换，强制重新走 start
    start();
  });
  // pjax:send 后立即清理时钟避免后台计时器
  document.addEventListener('pjax:send', function () {
    if (timer) { clearInterval(timer); timer = null; }
  });
})();
