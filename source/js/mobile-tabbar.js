/* ==========================================================
 *  移动端底部 Tab 导航
 *  PJAX 切换后重新判断高亮，不会重复插入
 * ========================================================== */
(function () {
  'use strict';

  var TABS = [
    { name: '首页', path: '/', icon: 'home', match: function (p) { return p === '/' || p === '/index.html'; } },
    { name: '分类', path: '/categories/', icon: 'shapes', match: function (p) { return p.indexOf('/categories') === 0; } },
    { name: '音乐馆', path: '/music/', icon: 'music', match: function (p) { return p.indexOf('/music') === 0; } },
    { name: '归档', path: '/archives/', icon: 'archive', match: function (p) { return p.indexOf('/archives') === 0; } },
    { name: '关于', path: '/about/', icon: 'user', match: function (p) { return p.indexOf('/about') === 0; } }
  ];

  var icon = window.BlogIcon || function () { return ''; };

  function build() {
    if (document.getElementById('mobile-tabbar')) { highlight(); return; }
    if (window.innerWidth > 768) return;

    var bar = document.createElement('nav');
    bar.id = 'mobile-tabbar';
    bar.setAttribute('aria-label', '移动端导航');

    TABS.forEach(function (t) {
      var a = document.createElement('a');
      a.className = 'mt-item';
      a.href = t.path;
      a.dataset.path = t.path;
      a.innerHTML = icon(t.icon, 21) + '<span class="mt-label">' + t.name + '</span>';
      bar.appendChild(a);
    });

    document.body.appendChild(bar);
    highlight();
  }

  function highlight() {
    var p = location.pathname;
    var items = document.querySelectorAll('#mobile-tabbar .mt-item');
    for (var i = 0; i < items.length; i++) {
      var t = TABS[i];
      var on = t ? t.match(p) : false;
      items[i].classList.toggle('on', !!on);
    }
  }

  function start() { build(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  document.addEventListener('pjax:complete', function () { highlight(); });
  window.addEventListener('resize', function () {
    var bar = document.getElementById('mobile-tabbar');
    if (window.innerWidth > 768 && bar) bar.style.display = 'none';
    else if (bar) bar.style.display = '';
  });
})();
