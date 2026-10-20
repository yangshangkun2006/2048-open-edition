// FR-11: apply persisted prefs before first paint to avoid a flash of
// wrong language/motion. External file (CSP-safe), no dependencies.
(function () {
  var root = document.documentElement;
  var prefs = { lang: null, motion: 'system', sound: false };
  try {
    var raw = localStorage.getItem('2048:v2:prefs');
    if (raw) {
      var p = JSON.parse(raw);
      if (p && typeof p === 'object') {
        if (p.lang === 'zh-CN' || p.lang === 'en') prefs.lang = p.lang;
        if (p.motion === 'system' || p.motion === 'reduce' || p.motion === 'full') prefs.motion = p.motion;
        if (typeof p.sound === 'boolean') prefs.sound = p.sound;
      }
    }
  } catch (e) {
    /* storage unavailable: defaults apply */
  }
  if (!prefs.lang) {
    var nav = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    prefs.lang = nav.toLowerCase().indexOf('zh') === 0 ? 'zh-CN' : 'en';
  }
  root.lang = prefs.lang;
  root.setAttribute('data-motion', prefs.motion);
  root.setAttribute('data-sound', prefs.sound ? 'on' : 'off');
})();
