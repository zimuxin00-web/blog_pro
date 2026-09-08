/* ==========================================
   Sakana 石蒜模拟器 · 初始化
   想调参数改这里就行，改完 hexo g 重新生成
   选项说明见 https://github.com/itorr/sakana
   ========================================== */
(function () {
  'use strict';

  var CFG = {
    character: 'takina',      // 初始角色：'takina' 井上泷奈 / 'chisato' 锦木千束
    inertia: 0.01,            // 惯性，越小摆得越慢
    decay: 0.99,              // 衰减，越接近 1 摆得越久
    r: 60,                    // 初始倾斜角度
    y: 10,                    // 初始下沉高度
    scalePC: 0.5,             // 电脑端缩放
    scaleMobile: 0.32,        // 手机端缩放
    canSwitchCharacter: true, // 点底座切换角色
    mute: true                // true = 静音（避免突然出声）；想听语音改 false
  };

  function start() {
    if (window.__sakanaInited) return;
    if (typeof window.Sakana === 'undefined') {
      setTimeout(start, 200);
      return;
    }

    var el = document.querySelector('.sakana-box');
    if (!el) {
      el = document.createElement('div');
      el.className = 'sakana-box';
      document.body.appendChild(el);
    }
    window.__sakanaInited = true;

    if (CFG.mute && window.Sakana.setMute) window.Sakana.setMute(true);

    var isMobile = window.matchMedia('(max-width: 768px)').matches;

    window.__sakanaInstance = window.Sakana.init({
      el: el,
      character: CFG.character,
      inertia: CFG.inertia,
      decay: CFG.decay,
      r: CFG.r,
      y: CFG.y,
      scale: isMobile ? CFG.scaleMobile : CFG.scalePC,
      canSwitchCharacter: CFG.canSwitchCharacter,
      onSwitchCharacter: function (name) {
        if (window.console) console.log('[Sakana] 切换到：' + name);
      }
    });

    // 切到后台就暂停，省电省 CPU
    document.addEventListener('visibilitychange', function () {
      var s = window.__sakanaInstance;
      if (!s) return;
      if (document.hidden) s.pause();
      else s.play();
    });
  }

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
})();
