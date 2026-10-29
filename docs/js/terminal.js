// Live terminal docked under the demo slides.
//
// Only active when the deck is served by presenter/server.js (it answers
// /healthz and serves xterm from /vendor). Opened any other way (file://,
// GitHub Pages) the deck stays static and the .fallback output shows instead.
//
// On a slide marked <!-- .slide: data-terminal data-command="..." -->:
//   - the terminal docks under the slide and the command is pre-typed
//   - Enter runs it, arrows/clicker still move slides
//   - t focuses the terminal for free typing, Esc gives keys back to the deck
//   - Ctrl+C interrupts without focusing
// A slide with data-terminal alone keeps the same terminal visible without
// typing a command. Use these slides to explain while a command keeps running.
(function () {
  'use strict';

  // Speaker-view previews (iframes, ?receiver) mirror output but never type.
  const primary = window.top === window && !/receiver/.test(location.search);

  let ws = null;
  let term = null;
  let fit = null;
  let live = false;
  let docked = false;
  let lastSlide = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function loadCss(href) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  }

  function send(msg) {
    if (primary && ws && ws.readyState === 1) ws.send(msg);
  }

  function setStatus(text) {
    document.getElementById('term-status').textContent = text;
  }

  function setLive(v) {
    live = v;
    document.body.classList.toggle('term-live', v);
    update(false);
  }

  function connect() {
    ws = new WebSocket(`ws://${location.host}/ws`);
    ws.onopen = () => {
      setLive(true);
      fitNow();
    };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'term') term.write(msg.data);
      if (msg.type === 'reset') term.reset();
    };
    ws.onclose = () => {
      setLive(false);
      setTimeout(connect, 1500);
    };
    ws.onerror = () => ws.close();
  }

  function fitNow() {
    if (!docked) return;
    try { fit.fit(); } catch (_) { /* not visible yet */ }
  }

  function update(slideChanged) {
    const slide = Reveal.getCurrentSlide();
    const wants = !!(live && slide && slide.hasAttribute('data-terminal'));
    if (wants !== docked) {
      docked = wants;
      document.body.classList.toggle('term-docked', docked);
      if (!docked && term) term.blur();
      requestAnimationFrame(() => {
        // the dock takes 40% of the screen; a matching shorter canvas keeps slide text full size
        Reveal.configure({ height: docked ? 432 : 720 });
        Reveal.layout();
        fitNow();
      });
    }
    // Ctrl+U clears the prompt first, so revisiting a slide never doubles the command
    if (docked && slideChanged && slide !== lastSlide) {
      const cmd = slide.getAttribute('data-command');
      if (cmd) send('input:\x15' + cmd);
    }
    lastSlide = slide;
    if (docked) {
      setStatus(!primary ? 'mirror' : slide.hasAttribute('data-command')
        ? '⏎ run · t type · esc back · ctrl-c stop'
        : 'output continues · space next · ctrl-c stop');
    }
  }

  function onKey(e) {
    if (!docked || !primary) return;
    if (document.activeElement === term.textarea) return; // xterm owns the keys
    if (e.metaKey || e.altKey) return;
    let handled = true;
    if (e.ctrlKey && e.key === 'c') send('input:\x03');
    else if (e.ctrlKey) handled = false;
    else if (e.key === 'Enter' && Reveal.getCurrentSlide().hasAttribute('data-command')) send('input:\r');
    else if (e.key === 't') term.focus();
    else handled = false;
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function initTerminal() {
    term = new Terminal({
      cursorBlink: true,
      fontFamily: '"SF Mono", "JetBrains Mono", Menlo, Consolas, monospace',
      fontSize: 20,
      lineHeight: 1.15,
      scrollback: 5000,
      disableStdin: !primary,
      theme: {
        background: '#0D1526',
        foreground: '#EAF2FC',
        cursor: '#2DD4BF',
        selectionBackground: '#223350',
      },
    });
    fit = new FitAddon.FitAddon();
    term.loadAddon(fit);
    term.open(document.getElementById('terminal'));
    term.onData((data) => send('input:' + data));
    term.onResize(({ cols, rows }) => send(`resize:${cols},${rows}`));
    term.attachCustomKeyEventHandler((e) => {
      if (e.type === 'keydown' && e.key === 'Escape') {
        e.stopPropagation(); // don't let Reveal open the overview
        term.blur();
        return false;
      }
      return true;
    });
    window.addEventListener('resize', fitNow);
    document.getElementById('term-restart').addEventListener('click', (e) => {
      send('restart');
      e.currentTarget.blur();
    });
  }

  async function init() {
    try {
      const res = await fetch('/healthz', { cache: 'no-store' });
      if (!res.ok) return;
      loadCss('/vendor/xterm.css');
      await loadScript('/vendor/xterm.js');
      await loadScript('/vendor/addon-fit.js');
    } catch (_) {
      return; // not served by presenter/server.js: static deck
    }
    initTerminal();
    document.addEventListener('keydown', onKey, true);
    Reveal.on('slidechanged', () => update(true));
    update(true);
    connect();
  }

  if (Reveal.isReady()) init();
  else Reveal.on('ready', init);
})();
