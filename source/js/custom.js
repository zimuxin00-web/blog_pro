/* ==========================================
   全屏动态背景：视频优先，失败自动降级为星屑粒子
   配置在 _config.anzhiyu.yml 的 inject.head 里（window.BLOG_CFG）
   ========================================== */
(function () {
  'use strict';

  var cfg = window.BLOG_CFG || {};
  var wrap = document.getElementById('web_bg');
  if (!wrap) return;
  if (wrap.querySelector('.bg-video, .bg-particles')) return; // 防止 pjax 重复注入

  var mqMobile = window.matchMedia('(max-width: 768px)');
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  function isHome() {
    return location.pathname === '/' || location.pathname === '/index.html';
  }

  function inScope() {
    if (cfg.scope === 'home') return isHome();
    return true;
  }

  function fallback() {
    wrap.classList.add('is-fallback');
    var v = wrap.querySelector('.bg-video');
    if (v) v.remove();
    if (cfg.particles !== false) initParticles(wrap);
  }

  /* ---------- 星屑粒子 ---------- */
  function initParticles(host) {
    var cv = document.createElement('canvas');
    cv.className = 'bg-particles';
    host.appendChild(cv);
    var ctx = cv.getContext('2d');
    var w = 0, h = 0, dots = [], raf = null;

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = Math.min(90, Math.round(w / 14));
      dots = [];
      for (var i = 0; i < count; i++) {
        dots.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.8 + 0.6,
          vy: -(Math.random() * 0.28 + 0.06),
          vx: (Math.random() - 0.5) * 0.16,
          a: Math.random() * 0.6 + 0.25,
          p: Math.random() * Math.PI * 2
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        d.y += d.vy;
        d.x += d.vx;
        d.p += 0.02;
        if (d.y < -5) { d.y = h + 5; d.x = Math.random() * w; }
        if (d.x < -5) d.x = w + 5;
        if (d.x > w + 5) d.x = -5;
        var alpha = d.a * (0.6 + 0.4 * Math.sin(d.p));
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = dark
          ? 'rgba(200,190,255,' + alpha.toFixed(3) + ')'
          : 'rgba(120,105,220,' + (alpha * 0.7).toFixed(3) + ')';
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (raf) { cancelAnimationFrame(raf); raf = null; }
      } else if (!raf) {
        draw();
      }
    });
  }

  /* ---------- 视频背景 ---------- */
  function initVideo() {
    var src = mqMobile.matches && cfg.videoMobile ? cfg.videoMobile : cfg.video;
    if (!src) { fallback(); return; }

    var v = document.createElement('video');
    v.className = 'bg-video';
    v.muted = true;
    v.defaultMuted = true;
    v.loop = true;
    v.autoplay = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    if (cfg.poster) v.poster = cfg.poster;

    var s = document.createElement('source');
    s.src = src;
    s.type = src.indexOf('.webm') > -1 ? 'video/webm' : 'video/mp4';
    v.appendChild(s);

    var settled = false;
    v.addEventListener('canplay', function () {
      settled = true;
      v.classList.add('is-ready');
    });
    v.addEventListener('error', function () {
      if (!settled) fallback();
    }, true);
    s.addEventListener('error', function () {
      if (!settled) fallback();
    });
    // 8 秒还没播起来就当失败，避免一直白等
    setTimeout(function () {
      if (!settled) fallback();
    }, 8000);

    wrap.appendChild(v);
    var p = v.play();
    if (p && typeof p.catch === 'function') p.catch(function () { /* 静默：等 error/超时兜底 */ });
  }

  /* ---------- 动漫随机背景（网上实时拉图，每次打开不一样） ---------- */
  // cfg.animeBg === false 时关闭；图源可经 cfg.animeSources 自定义，否则用内置源。
  function initAnimeBg(done) {
    if (cfg.animeBg === false || mqReduce.matches) { done(false); return; }
    var sources = (cfg.animeSources && cfg.animeSources.length)
      ? cfg.animeSources
      : [
          'https://www.dmoe.cc/random.php',
          'https://api.mtyqx.cn/api/random.php',
          'https://api.paugram.com/wallpaper/'
        ];
    var layer = document.createElement('div');
    layer.className = 'bg-anime';
    wrap.appendChild(layer);
    var i = 0;
    function tryNext() {
      if (i >= sources.length) { layer.remove(); done(false); return; }
      var url = sources[i++];
      var img = new Image();
      var settled = false;
      img.onload = function () {
        if (settled) return; settled = true;
        layer.style.backgroundImage = 'url("' + url + '")';
        layer.classList.add('is-ready');
        wrap.classList.add('has-anime');
        done(true);
      };
      img.onerror = function () {
        if (settled) return; settled = true; tryNext();
      };
      setTimeout(function () { if (!settled) { settled = true; tryNext(); } }, 7000);
      img.src = url;
    }
    tryNext();
  }

  function start() {
    if (mqReduce.matches) { wrap.classList.add('is-fallback'); return; }
    if (!inScope()) { wrap.classList.add('is-fallback'); return; }

    initAnimeBg(function (animeOk) {
      if (animeOk) return; // 动漫背景已就位，不再叠加视频/粒子
      var wantVideo = cfg.video && (!mqMobile.matches || cfg.videoMobileEnabled);
      if (wantVideo) initVideo();
      else if (cfg.particles !== false) initParticles(wrap);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
