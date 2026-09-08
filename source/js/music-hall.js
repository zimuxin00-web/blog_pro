/* ==========================================================
 *  音乐馆  ——  自定义 UI + APlayer 音频引擎
 *
 *  歌单来源：公开免费的 Meting 兼容接口（默认 api.injahow.cn）
 *  用法：在页面里放 <div id="music-hall"></div> 即可
 *
 *  为什么不用 MetingJS 自带渲染：
 *  1) 它默认的 api.i-meto.com 已经失效（实测无响应）
 *  2) 自带 UI 在手机上体验差，做不出全屏播放器
 *  所以这里自己取数据、自己画界面，APlayer 只负责出声。
 *  取数彻底失败时，才回退交给 MetingJS 兜底渲染。
 * ========================================================== */
(function () {
  'use strict';

  /* ---------------- 配置 ---------------- */
  var CFG = Object.assign({
    // 歌单列表：网易云官方榜 / 公开歌单 ID，可自行增删
    // 全部经过实测可拉取；换歌单只要改 id 即可
    playlists: [
      { name: '热歌榜', server: 'netease', type: 'playlist', id: '3778678' },
      { name: '飙升榜', server: 'netease', type: 'playlist', id: '19723756' },
      { name: '新歌榜', server: 'netease', type: 'playlist', id: '3779629' },
      { name: '轻音乐', server: 'netease', type: 'playlist', id: '71384707' }
    ],
    // 依次尝试，第一个返回合法数据的生效
    apis: [
      'https://api.injahow.cn/meting/?server=:server&type=:type&id=:id',
      'https://api.i-meto.com/meting/api?server=:server&type=:type&id=:id',
      'https://meting.qjqq.cn/?server=:server&type=:type&id=:id'
    ],
    volume: 0.7,
    lrc: true
  }, window.MUSIC_CFG || {});

  var MODE = ['list', 'single', 'random'];
  var MODE_ICON = { list: 'repeat', single: 'repeatOne', random: 'shuffle' };
  var MODE_TEXT = { list: '顺序播放', single: '单曲循环', random: '随机播放' };
  var icon = window.BlogIcon || function () { return ''; };

  var root, ap = null, songs = [], cur = -1, mode = 'list';
  var lyrics = [], lyricIdx = -1;
  var curListIdx = 0;

  /* ---------------- 工具 ---------------- */
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmt(t) {
    if (!isFinite(t) || t < 0) t = 0;
    var m = Math.floor(t / 60), s = Math.floor(t % 60);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function fetchJSON(url, timeout) {
    if (typeof fetch === 'undefined') return Promise.reject(new Error('no fetch'));
    var c = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = setTimeout(function () { c && c.abort(); }, timeout || 8000);
    return fetch(url, { signal: c ? c.signal : undefined, cache: 'no-store' })
      .then(function (r) { clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(function (e) { clearTimeout(t); throw e; });
  }

  /* ---------------- 取歌单 ---------------- */
  function loadList(pl) {
    var p = Promise.reject(new Error('init'));
    CFG.apis.forEach(function (tpl) {
      p = p.catch(function () {
        var url = tpl.replace(':server', pl.server).replace(':type', pl.type).replace(':id', pl.id);
        return fetchJSON(url, 8000).then(function (data) {
          if (!Array.isArray(data) || !data.length) throw new Error('empty');
          return data;
        });
      });
    });
    return p;
  }

  /* ---------------- LRC 解析 ---------------- */
  function parseLRC(text) {
    var out = [];
    String(text || '').split(/\r?\n/).forEach(function (line) {
      var m = line.match(/\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g);
      if (!m) return;
      var txt = line.replace(/\[[^\]]*\]/g, '').trim();
      if (!txt) return;
      m.forEach(function (tag) {
        var p = tag.replace(/[\[\]]/g, '').split(/[:.]/);
        var t = (+p[0]) * 60 + (+p[1]) + (p[2] ? (+p[2]) / (p[2].length === 3 ? 1000 : 100) : 0);
        out.push({ t: t, text: txt });
      });
    });
    return out.sort(function (a, b) { return a.t - b.t; });
  }

  function loadLyric(song) {
    lyrics = []; lyricIdx = -1;
    var box = $('.mh-lyric');
    if (box) box.innerHTML = '';
    if (!CFG.lrc || !song || !song.lrc) return;
    fetch(song.lrc).then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (t) { lyrics = parseLRC(t); })
      .catch(function () { lyrics = []; });
  }

  function paintLyric(time) {
    var box = $('.mh-lyric');
    if (!box || !lyrics.length) return;
    var i = -1;
    for (var k = 0; k < lyrics.length; k++) { if (lyrics[k].t <= time + 0.3) i = k; else break; }
    if (i === lyricIdx) return;
    lyricIdx = i;
    var html = '';
    for (var j = Math.max(0, i - 1); j < Math.min(lyrics.length, i + 3); j++) {
      html += '<p class="mh-lrc-line' + (j === i ? ' on' : '') + '">' + esc(lyrics[j].text) + '</p>';
    }
    box.innerHTML = html;
  }

  /* ---------------- 界面骨架 ---------------- */
  function skeleton() {
    root.innerHTML =
      '<div class="mh-bg"></div>' +
      '<div class="mh-inner">' +
        '<div class="mh-tabs"></div>' +
        '<div class="mh-stage">' +
          '<div class="mh-vinyl"><div class="mh-disc"><img class="mh-cover" alt="cover"><span class="mh-hole"></span></div></div>' +
          '<div class="mh-meta"><div class="mh-title">加载中…</div><div class="mh-artist"></div></div>' +
          '<div class="mh-lyric"></div>' +
          '<div class="mh-prog"><span class="mh-cur">00:00</span>' +
            '<div class="mh-bar"><div class="mh-bar-fill"></div><div class="mh-bar-dot"></div></div>' +
            '<span class="mh-total">00:00</span></div>' +
          '<div class="mh-ctrl">' +
            '<button class="mh-btn" data-act="mode" title="播放模式">' + icon('repeat') + '</button>' +
            '<button class="mh-btn" data-act="prev" title="上一首">' + icon('prev') + '</button>' +
            '<button class="mh-btn mh-play-btn" data-act="play" title="播放/暂停">' + icon('play', 22) + '</button>' +
            '<button class="mh-btn" data-act="next" title="下一首">' + icon('next') + '</button>' +
            '<button class="mh-btn" data-act="list" title="播放列表">' + icon('list') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="mh-side">' +
          '<div class="mh-searchwrap">' + icon('search', 14) +
          '<input class="mh-search" placeholder="搜索歌曲 / 歌手"></div>' +
          '<div class="mh-listbox"><ol class="mh-list"></ol></div>' +
        '</div>' +
      '</div>' +
      '<div class="mh-engine"></div>' +
      '<div class="mh-mask"></div>';

    // 歌单 tabs
    var tabs = $('.mh-tabs');
    CFG.playlists.forEach(function (pl, i) {
      var b = document.createElement('button');
      b.className = 'mh-tab' + (i === 0 ? ' on' : '');
      b.textContent = pl.name;
      b.onclick = function () {
        if (curListIdx === i) return;
        curListIdx = i;
        $$('.mh-tab').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        boot();
      };
      tabs.appendChild(b);
    });
    if (CFG.playlists.length < 2) tabs.style.display = 'none';

    bind();
  }

  function bind() {
    $$('.mh-btn', root).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var act = btn.dataset.act;
        if (act === 'play') toggle();
        else if (act === 'next') step(1);
        else if (act === 'prev') step(-1);
        else if (act === 'mode') switchMode();
        else if (act === 'list') toggleList();
      });
    });

    // 进度条拖动 / 点击
    var bar = $('.mh-bar');
    if (bar) {
      var seeking = false;
      function pos(e) {
        var r = bar.getBoundingClientRect();
        var x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
        return Math.max(0, Math.min(1, x / r.width));
      }
      function move(e) { if (!ap) return; paintProg(pos(e) * dur()); }
      function up(e) {
        if (!ap || !seeking) return;
        seeking = false;
        ap.seek(pos(e) * dur());
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        document.removeEventListener('touchmove', move);
        document.removeEventListener('touchend', up);
      }
      bar.addEventListener('mousedown', function (e) { if (!ap) return; seeking = true; move(e); document.addEventListener('mousemove', move); document.addEventListener('mouseup', up); });
      bar.addEventListener('touchstart', function (e) { if (!ap) return; seeking = true; move(e); document.addEventListener('touchmove', move, { passive: true }); document.addEventListener('touchend', up); }, { passive: true });
    }

    // 搜索
    var s = $('.mh-search');
    if (s) s.addEventListener('input', function () { paintList(s.value.trim().toLowerCase()); });

    // 移动端点遮罩收起列表
    var mask = $('.mh-mask');
    if (mask) mask.addEventListener('click', toggleList);
  }

  /* ---------------- 播放控制 ---------------- */
  function dur() {
    if (!ap || !ap.audio) return 0;
    return isFinite(ap.audio.duration) ? ap.audio.duration : 0;
  }
  // APlayer 的 play() 在部分版本不返回 Promise，统一包一层
  function safePlay() {
    if (!ap) return;
    try {
      var r = ap.play();
      if (r && typeof r.catch === 'function') {
        r.catch(function () { toast('浏览器拦截了自动播放，点一下播放键'); });
      }
    } catch (e) { /* 忽略 */ }
  }
  function toggle() {
    if (!ap) return;
    if (ap.audio.paused) safePlay();
    else ap.pause();
  }
  function step(dir) {
    if (!songs.length) return;
    var i;
    if (mode === 'random') {
      i = Math.floor(Math.random() * songs.length);
      if (songs.length > 1 && i === cur) i = (i + 1) % songs.length;
    } else {
      i = (cur + dir + songs.length) % songs.length;
    }
    play(i);
  }
  function switchMode() {
    mode = MODE[(MODE.indexOf(mode) + 1) % MODE.length];
    var b = $('[data-act="mode"]', root);
    if (b) {
      b.innerHTML = icon(MODE_ICON[mode]);
      b.title = MODE_TEXT[mode];
    }
    toast(MODE_TEXT[mode]);
  }
  function play(i) {
    if (!ap || !songs[i]) return;
    cur = i;
    ap.list.switch(i);
    safePlay();
    paintSong();
    loadLyric(songs[i]);
    paintList($('.mh-search') ? $('.mh-search').value.trim().toLowerCase() : '');
  }
  function toggleList() { root.classList.toggle('mh-list-open'); }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'mh-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 10);
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 1400);
  }

  /* ---------------- 绘制 ---------------- */
  function paintProg(time) {
    var d = dur();
    var p = d ? Math.max(0, Math.min(1, time / d)) : 0;
    var fill = $('.mh-bar-fill'), dot = $('.mh-bar-dot'), c = $('.mh-cur'), tt = $('.mh-total');
    if (fill) fill.style.width = (p * 100) + '%';
    if (dot) dot.style.left = (p * 100) + '%';
    if (c) c.textContent = fmt(time);
    if (tt) tt.textContent = fmt(d);
  }

  function paintSong() {
    var s = songs[cur] || {};
    var t = $('.mh-title'), a = $('.mh-artist'), img = $('.mh-cover');
    if (t) t.textContent = s.name || '—';
    if (a) a.textContent = s.artist || '';
    if (img) img.src = s.cover || '/img/default_cover.svg';
    var bg = $('.mh-bg');
    if (bg) bg.style.backgroundImage = s.cover ? 'url(' + s.cover + ')' : '';
    document.title = s.name ? s.name + ' - 音乐馆' : '音乐馆';
  }

  function paintList(kw) {
    var ol = $('.mh-list');
    if (!ol) return;
    var items = songs.map(function (s, i) { return { s: s, i: i }; });
    if (kw) items = items.filter(function (o) {
      return (o.s.name + ' ' + o.s.artist).toLowerCase().indexOf(kw) > -1;
    });
    ol.innerHTML = items.map(function (o) {
      return '<li class="mh-item' + (o.i === cur ? ' on' : '') + '" data-i="' + o.i + '">' +
        '<span class="mh-no">' + (o.i + 1) + '</span>' +
        '<span class="mh-iname">' + esc(o.s.name) + '</span>' +
        '<span class="mh-iartist">' + esc(o.s.artist) + '</span></li>';
    }).join('') || '<li class="mh-empty">没有匹配的歌曲</li>';

    $$('.mh-item', ol).forEach(function (li) {
      li.addEventListener('click', function () {
        play(+li.dataset.i);
        if (root.classList.contains('mh-list-open')) toggleList();
      });
    });
  }

  /* ---------------- 按需加载 APlayer（不全站背着 58KB） ---------------- */
  function ensureAssets() {
    var jobs = [];
    if (typeof window.APlayer === 'undefined') jobs.push(loadScript('/js/APlayer.min.js'));
    if (!document.getElementById('aplayer-css')) jobs.push(loadCSS('/css/APlayer.min.css', 'aplayer-css'));
    return Promise.all(jobs);
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = res; s.onerror = function () { rej(new Error('加载 ' + src + ' 失败')); };
      document.head.appendChild(s);
    });
  }

  function loadCSS(href, id) {
    return new Promise(function (res) {
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = href; l.id = id;
      l.onload = res; l.onerror = res;
      document.head.appendChild(l);
    });
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    var pl = CFG.playlists[curListIdx];
    var list = $('.mh-list');
    if (list) list.innerHTML = '<li class="mh-empty">歌单加载中…</li>';

    ensureAssets().then(function () {
      return loadList(pl).then(function (data) {
      songs = data.map(function (s) {
        return { name: s.name, artist: s.artist, url: s.url, cover: s.pic || s.cover, lrc: s.lrc };
      }).filter(function (s) { return s.url; });

      if (!songs.length) throw new Error('empty after filter');

      if (ap) { try { ap.destroy(); } catch (e) {} ap = null; }
      $('.mh-engine').innerHTML = '';

      ap = new APlayer({
        container: $('.mh-engine'),
        audio: songs,
        volume: CFG.volume,
        loop: 'none',       // 播放顺序完全由本脚本接管
        order: 'list',
        preload: 'metadata',
        mutex: true,
        lrcType: 0,
        listFolded: true
      });

      cur = 0;
      paintSong();
      paintList('');
      paintProg(0);

      ap.on('timeupdate', function () {
        paintProg(ap.audio.currentTime);
        paintLyric(ap.audio.currentTime);
      });
      ap.on('play', function () { root.classList.add('is-playing'); syncIcon(); });
      ap.on('pause', function () { root.classList.remove('is-playing'); syncIcon(); });
      ap.on('ended', function () {
        if (mode === 'single') { ap.seek(0); safePlay(); }
        else step(1);
      });
      // 连续失败就停手，避免死循环一首一首跳下去
      var fails = 0;
      ap.on('error', function () {
        if (++fails >= 3) { toast('歌单接口暂时不可用，换个歌单试试'); return; }
        toast('这首加载失败了，换下一首');
        step(1);
      });
      ap.on('canplay', function () { fails = 0; });

      loadLyric(songs[0]);
      });
    }).catch(function (err) {
      console.warn('[music-hall] 取歌单失败：', err && err.message);
      fallbackMeting(pl);
    });
  }

  function syncIcon() {
    var b = $('[data-act="play"]', root);
    if (!b) return;
    b.innerHTML = icon(root.classList.contains('is-playing') ? 'pause' : 'play', 22);
  }

  /* 兜底：交给 MetingJS 渲染原生播放器 */
  function fallbackMeting(pl) {
    if (typeof window.MetingJSElement === 'undefined') {
      var side = $('.mh-side');
      var stage = $('.mh-meta');
      if (stage) stage.innerHTML = '<div class="mh-title">歌单加载失败</div>' +
        '<div class="mh-artist">公开接口暂时不可用，稍后再试</div>';
      if (side) side.style.display = 'none';
      return;
    }
    var box = $('.mh-engine');
    box.innerHTML = '';
    box.classList.add('mh-engine-visible');
    var m = document.createElement('meting-js');
    m.setAttribute('server', pl.server);
    m.setAttribute('type', pl.type);
    m.setAttribute('id', pl.id);
    m.setAttribute('api', CFG.apis[0] + '&');
    m.setAttribute('mutex', 'true');
    m.setAttribute('theme', '#8a7ffb');
    box.appendChild(m);
    var side = $('.mh-side'), stage = $('.mh-stage');
    if (side) side.style.display = 'none';
    if (stage) stage.style.display = 'none';
  }

  /* ---------------- 入口 ---------------- */
  function init() {
    root = document.getElementById('music-hall');
    if (!root || root.dataset.init === '1') return;
    root.dataset.init = '1';
    skeleton();
    boot();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  document.addEventListener('pjax:complete', init);
})();
