/* InBody Knowledge Assistant - embeddable chat widget.
 *
 * Add to any website with a single script tag:
 *   <script src="https://your-host/widget.js" defer></script>
 *
 * Optional inline configuration (set BEFORE the script tag):
 *   <script>
 *     window.InBodyChatConfig = {
 *       title: "InBody Assistant",
 *       primaryColor: "#0f6fc5",
 *       token: "shared-secret"   // only if WIDGET_TOKEN is set on the server
 *     };
 *   </script>
 *
 * The widget talks to the server's POST /api/chat endpoint and renders the
 * grounded answer plus source filenames. It is styled inside a Shadow DOM so
 * it does not clash with the host page.
 */
(function () {
  'use strict';

  if (window.__inbodyChatLoaded) { return; }
  window.__inbodyChatLoaded = true;

  function currentScript() {
    if (document.currentScript) { return document.currentScript; }
    var all = document.getElementsByTagName('script');
    return all[all.length - 1];
  }

  var script = currentScript();

  var DEFAULTS = {
    apiUrl: '',
    token: '',
    title: 'InBody Assistant',
    tagline: 'Answers from the approved InBody knowledge base',
    placeholder: 'Ask about an InBody model, feature, or specification...',
    greeting: 'Hi! Ask me anything about InBody products and I will answer from the approved documents.',
    position: 'right',          // 'right' | 'left'
    primaryColor: '#0f6fc5',
    width: 380,
    maxHeight: 540,
    persist: true,
    storageKey: 'inbody-chat-history',
    zIndex: 2147483000
  };

  function readConfig() {
    var cfg = {};
    var k;
    for (k in DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, k)) { cfg[k] = DEFAULTS[k]; }
    }
    if (window.InBodyChatConfig) {
      for (k in window.InBodyChatConfig) {
        if (Object.prototype.hasOwnProperty.call(window.InBodyChatConfig, k)) {
          cfg[k] = window.InBodyChatConfig[k];
        }
      }
    }
    function attr(name, key) {
      var v = script.getAttribute('data-' + name);
      if (v !== null && v !== '') { cfg[key] = v; }
    }
    attr('api-url', 'apiUrl');
    attr('token', 'token');
    attr('title', 'title');
    attr('tagline', 'tagline');
    attr('placeholder', 'placeholder');
    attr('greeting', 'greeting');
    attr('position', 'position');
    attr('primary-color', 'primaryColor');
    if (!cfg.apiUrl) {
      try {
        cfg.apiUrl = new URL(script.src).origin;
      } catch (e) {
        cfg.apiUrl = window.location.origin;
      }
    }
    if (cfg.apiUrl.charAt(cfg.apiUrl.length - 1) === '/') {
      cfg.apiUrl = cfg.apiUrl.slice(0, -1);
    }
    return cfg;
  }

  var cfg = readConfig();

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Safe, minimal markdown: everything is HTML-escaped first, then a few
  // harmless patterns are turned into tags. No raw HTML is allowed through.
  function renderMarkdown(src) {
    var esc = escapeHtml(src == null ? '' : src);
    esc = esc.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    esc = esc.replace(/\u0060([^\u0060]+)\u0060/g, '<code>$1</code>');
    esc = esc.replace(/\n/g, '<br>');
    return esc;
  }

  var ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  var CLOSE_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>';
  var SEND_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z"></path></svg>';

  var styles = [
    ':host { all: initial; }',
    '* { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }',
    '.launcher { position: fixed; bottom: 20px; z-index: ' + cfg.zIndex + '; display: flex; align-items: center; gap: 10px; cursor: pointer; }',
    '.launcher.right { right: 20px; }',
    '.launcher.left { left: 20px; }',
    '.launcher-btn { width: 58px; height: 58px; border-radius: 50%; background: ' + cfg.primaryColor + '; color: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 18px rgba(0,0,0,0.25); transition: transform .15s ease; }',
    '.launcher-btn:hover { transform: scale(1.06); }',
    '.launcher-label { background: #fff; color: #1a1a1a; padding: 8px 14px; border-radius: 18px; box-shadow: 0 4px 14px rgba(0,0,0,0.18); font-size: 14px; display: none; }',
    '.launcher:hover .launcher-label { display: block; }',
    '.panel { position: fixed; bottom: 92px; z-index: ' + cfg.zIndex + '; width: ' + cfg.width + 'px; max-width: calc(100vw - 24px); height: ' + cfg.maxHeight + 'px; max-height: calc(100vh - 120px); background: #fff; border-radius: 16px; box-shadow: 0 18px 50px rgba(0,0,0,0.28); display: flex; flex-direction: column; overflow: hidden; opacity: 0; transform: translateY(16px) scale(0.98); pointer-events: none; transition: opacity .18s ease, transform .18s ease; }',
    '.panel.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }',
    '.panel.right { right: 20px; }',
    '.panel.left { left: 20px; }',
    '.header { background: ' + cfg.primaryColor + '; color: #fff; padding: 14px 16px; position: relative; }',
    '.header-title { font-size: 16px; font-weight: 600; padding-right: 28px; }',
    '.header-tagline { font-size: 12px; opacity: 0.85; margin-top: 2px; }',
    '.header-close { position: absolute; top: 12px; right: 12px; background: none; border: none; color: #fff; cursor: pointer; padding: 4px; }',
    '.messages { flex: 1; overflow-y: auto; padding: 16px; background: #f7f9fc; }',
    '.msg { max-width: 82%; margin-bottom: 12px; padding: 10px 14px; border-radius: 14px; font-size: 14px; line-height: 1.5; word-wrap: break-word; }',
    '.msg.user { background: ' + cfg.primaryColor + '; color: #fff; margin-left: auto; border-bottom-right-radius: 4px; }',
    '.msg.assistant { background: #fff; color: #1a1a1a; border: 1px solid #e6ebf2; margin-right: auto; border-bottom-left-radius: 4px; }',
    '.msg code { background: rgba(0,0,0,0.06); padding: 1px 5px; border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }',
    '.sources { margin-top: 8px; padding-top: 8px; border-top: 1px solid #eef2f7; font-size: 12px; color: #5b6b7c; }',
    '.sources-toggle { background: none; border: none; color: ' + cfg.primaryColor + '; cursor: pointer; padding: 0; font-size: 12px; font-weight: 600; }',
    '.sources-list { display: none; margin-top: 6px; }',
    '.sources-list.open { display: block; }',
    '.source { margin-bottom: 6px; }',
    '.source-name { font-weight: 600; color: #33475b; }',
    '.source-snippet { color: #7a8794; font-style: italic; }',
    '.typing { display: inline-flex; gap: 4px; align-items: center; padding: 4px 0; }',
    '.typing span { width: 7px; height: 7px; background: #a8b3c0; border-radius: 50%; animation: blink 1.2s infinite; }',
    '.typing span:nth-child(2) { animation-delay: .2s; }',
    '.typing span:nth-child(3) { animation-delay: .4s; }',
    '@keyframes blink { 0%, 80%, 100% { opacity: .25; } 40% { opacity: 1; } }',
    '.input-wrap { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #eef2f7; background: #fff; }',
    '.input { flex: 1; border: 1px solid #d8e0ea; border-radius: 10px; padding: 10px 12px; font-size: 14px; outline: none; resize: none; font-family: inherit; }',
    '.input:focus { border-color: ' + cfg.primaryColor + '; }',
    '.send { background: ' + cfg.primaryColor + '; color: #fff; border: none; border-radius: 10px; padding: 0 16px; cursor: pointer; }',
    '.send:disabled { opacity: 0.5; cursor: not-allowed; }'
  ].join('\n');

  var host = document.createElement('div');
  var shadow = host.attachShadow({ mode: 'open' });

  var styleEl = document.createElement('style');
  styleEl.textContent = styles;
  shadow.appendChild(styleEl);

  var launcher = document.createElement('div');
  launcher.className = 'launcher ' + cfg.position;
  var launcherBtn = document.createElement('button');
  launcherBtn.type = 'button';
  launcherBtn.className = 'launcher-btn';
  launcherBtn.setAttribute('aria-label', 'Open chat');
  launcherBtn.innerHTML = ICON;
  var launcherLabel = document.createElement('div');
  launcherLabel.className = 'launcher-label';
  launcherLabel.textContent = 'Chat with us';
  launcher.appendChild(launcherBtn);
  launcher.appendChild(launcherLabel);

  var panel = document.createElement('div');
  panel.className = 'panel ' + cfg.position;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', cfg.title);

  var header = document.createElement('div');
  header.className = 'header';
  var hTitle = document.createElement('div');
  hTitle.className = 'header-title';
  hTitle.textContent = cfg.title;
  var hTag = document.createElement('div');
  hTag.className = 'header-tagline';
  hTag.textContent = cfg.tagline;
  var closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'header-close';
  closeBtn.innerHTML = CLOSE_ICON;
  closeBtn.setAttribute('aria-label', 'Close chat');
  header.appendChild(hTitle);
  header.appendChild(hTag);
  header.appendChild(closeBtn);

  var messagesEl = document.createElement('div');
  messagesEl.className = 'messages';

  var inputWrap = document.createElement('div');
  inputWrap.className = 'input-wrap';
  var input = document.createElement('textarea');
  input.className = 'input';
  input.rows = 1;
  input.placeholder = cfg.placeholder;
  var send = document.createElement('button');
  send.type = 'button';
  send.className = 'send';
  send.innerHTML = SEND_ICON;
  send.setAttribute('aria-label', 'Send');
  inputWrap.appendChild(input);
  inputWrap.appendChild(send);

  panel.appendChild(header);
  panel.appendChild(messagesEl);
  panel.appendChild(inputWrap);

  shadow.appendChild(launcher);
  shadow.appendChild(panel);

  // ----- state & persistence -----
  var history = [];

  function loadHistory() {
    if (!cfg.persist) { return; }
    try {
      var raw = localStorage.getItem(cfg.storageKey);
      if (raw) { history = JSON.parse(raw); }
    } catch (e) { history = []; }
  }

  function saveHistory() {
    if (!cfg.persist) { return; }
    try {
      localStorage.setItem(cfg.storageKey, JSON.stringify(history.slice(-40)));
    } catch (e) { /* ignore */ }
  }

  function addMessage(role, text, sources) {
    var wrap = document.createElement('div');
    wrap.className = 'msg ' + role;
    var body = document.createElement('div');
    body.innerHTML = renderMarkdown(text);
    wrap.appendChild(body);

    if (sources && sources.length) {
      var srcWrap = document.createElement('div');
      srcWrap.className = 'sources';
      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'sources-toggle';
      toggle.textContent = 'Sources (' + sources.length + ')';
      var list = document.createElement('div');
      list.className = 'sources-list';
      for (var i = 0; i < sources.length; i++) {
        var s = sources[i];
        var item = document.createElement('div');
        item.className = 'source';
        var name = document.createElement('div');
        name.className = 'source-name';
        name.textContent = s.filename;
        item.appendChild(name);
        if (s.snippet) {
          var snip = document.createElement('div');
          snip.className = 'source-snippet';
          snip.textContent = s.snippet;
          item.appendChild(snip);
        }
        list.appendChild(item);
      }
      toggle.addEventListener('click', function () {
        var open = list.classList.toggle('open');
        toggle.textContent = open ? 'Hide sources' : 'Sources (' + sources.length + ')';
      });
      srcWrap.appendChild(toggle);
      srcWrap.appendChild(list);
      wrap.appendChild(srcWrap);
    }

    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    var wrap = document.createElement('div');
    wrap.className = 'msg assistant';
    wrap.setAttribute('data-typing', '1');
    wrap.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    var el = messagesEl.querySelector('[data-typing]');
    if (el) { el.remove(); }
  }

  var sending = false;

  function sendMessage() {
    var text = (input.value || '').trim();
    if (!text || sending) { return; }
    input.value = '';

    history.push({ role: 'user', content: text });
    addMessage('user', text);
    saveHistory();

    sending = true;
    send.disabled = true;
    showTyping();

    var payload = {
      messages: history.map(function (m) { return { role: m.role, content: m.content }; }),
      token: cfg.token
    };

    fetch(cfg.apiUrl + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().catch(function () { return null; })
          .then(function (data) { return { ok: res.ok, status: res.status, data: data }; });
      })
      .then(function (r) {
        hideTyping();
        sending = false;
        send.disabled = false;
        var answer;
        var sources = [];
        if (r.ok && r.data && r.data.answer) {
          answer = r.data.answer;
          sources = r.data.sources || [];
        } else if (r.status === 429) {
          answer = 'Too many requests right now. Please wait a moment and try again.';
        } else if (r.data && r.data.answer) {
          answer = r.data.answer;
        } else {
          answer = 'Sorry, the assistant could not complete that request. Please try again.';
        }
        history.push({ role: 'assistant', content: answer, sources: sources });
        saveHistory();
        addMessage('assistant', answer, sources);
      })
      .catch(function () {
        hideTyping();
        sending = false;
        send.disabled = false;
        var msg = 'Sorry, the assistant is unreachable. Check your connection and try again.';
        history.push({ role: 'assistant', content: msg, sources: [] });
        saveHistory();
        addMessage('assistant', msg, []);
      });
  }

  function open() {
    panel.classList.add('open');
    launcherBtn.innerHTML = CLOSE_ICON;
    launcherBtn.setAttribute('aria-label', 'Close chat');
    input.focus();
  }

  function close() {
    panel.classList.remove('open');
    launcherBtn.innerHTML = ICON;
    launcherBtn.setAttribute('aria-label', 'Open chat');
  }

  function toggle() {
    if (panel.classList.contains('open')) { close(); } else { open(); }
  }

  launcherBtn.addEventListener('click', toggle);
  closeBtn.addEventListener('click', close);
  send.addEventListener('click', sendMessage);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  function mount() {
    if (!document.body) { setTimeout(mount, 10); return; }
    document.body.appendChild(host);
    loadHistory();
    for (var i = 0; i < history.length; i++) {
      var m = history[i];
      addMessage(m.role, m.content, m.sources);
    }
    if (!history.length) {
      addMessage('assistant', cfg.greeting);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
