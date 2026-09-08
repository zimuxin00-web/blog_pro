/* ==========================================================
 *  内联 SVG 图标
 *  为什么不用主题的 anzhiyu-icon 字体：
 *  它的图标来自外部 CDN，本地拿不到映射表，
 *  名字写错就变成空白方块。内联 SVG 百分百可渲染。
 *  用法：BlogIcon('play')  返回 svg 字符串
 * ========================================================== */
(function (global) {
  'use strict';

  // 24x24 viewBox，统一用 currentColor，颜色跟随父级
  var P = {
    home:      'M12 3 3 10.2V21h6v-6h6v6h6V10.2z',
    shapes:    'M12 2 2 9l10 7 8-5.6V19h2V7z',
    music:     'M9 18a3 3 0 1 1-2-2.83V4h11v3h-9v7.17A3 3 0 0 1 9 18zm9-1V6h-2v9a3 3 0 1 0 2 2z',
    archive:   'M3 4h18v4H3zm2 6h14v10H5zm4 3h6v2H9z',
    user:      'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5z',
    comment:   'M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-5 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
    play:      'M7 4.5v15l13-7.5z',
    pause:     'M7 4h4v16H7zm6 0h4v16h-4z',
    prev:      'M6 5h2.5v14H6zm4 7 9-7v14z',
    next:      'M15.5 5H18v14h-2.5zM5 5l9 7-9 7z',
    list:      'M4 6h2v2H4zm0 5h2v2H4zm0 5h2v2H4zm5-10h11v2H9zm0 5h11v2H9zm0 5h11v2H9z',
    repeat:    'M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z',
    repeatOne: 'M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2zm-4-5h1v4h-2v-2.5L11 13',
    shuffle:   'M17 3l4 4-4 4V8h-2.2l-2.3 3-2.2-3-2.3 3L3 8.7 4.4 6.6 6 9l2.3-3 2.2 3 2.3-3H17zm0 10l4 4-4 4v-3h-5.2l-2.3-3-2.2 3-2.3-3L3 17.3l1.4-2.1L6 18l2.3-3 2.2 3 2.3-3H17z',
    search:    'M10 3a7 7 0 1 0 4.2 12.6l4.1 4.1 1.4-1.4-4.1-4.1A7 7 0 0 0 10 3zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z',
    location:  'M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z',
    chevL:     'M15.4 4.6 8 12l7.4 7.4 1.4-1.4L10.8 12l6-6z',
    chevR:     'M8.6 4.6 7.2 6l6 6-6 6 1.4 1.4L16 12z',
    clock:     'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 5v5.6l4 2.3-1 1.7-5-2.9V7z',
    tag:       'M3 3h8l10 10-8 8L3 11zm4 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
    close:     'M6 6l12 12M18 6 6 18'
  };

  function icon(name, size) {
    var d = P[name];
    if (!d) return '';
    var s = size || 16;
    var stroke = (name === 'close');
    return '<svg class="bi bi-' + name + '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" ' +
      'fill="' + (stroke ? 'none' : 'currentColor') + '" ' +
      (stroke ? 'stroke="currentColor" stroke-width="2" stroke-linecap="round"' : '') +
      ' aria-hidden="true"><path d="' + d + '"' + (stroke ? ' fill="none"' : '') + '/></svg>';
  }

  global.BlogIcon = icon;
})(window);
