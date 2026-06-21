(function () {
  'use strict';

  var STORAGE_KEY = 'abp_cookie_consent';
  var GA_ID = 'G-L58FLY4JKJ';

  /* ── Helpers ───────────────────────────────────────────────── */
  function getConsent() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch (e) { return {}; }
  }

  function saveConsent(obj) {
    obj.saved = true;
    obj.date = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  }

  function removeGaCookies() {
    var cookies = document.cookie.split(';');
    for (var i = 0; i < cookies.length; i++) {
      var name = cookies[i].split('=')[0].trim();
      if (/^_ga/.test(name)) {
        var domains = [location.hostname, '.' + location.hostname];
        var paths = ['/', '/'];
        for (var d = 0; d < domains.length; d++) {
          document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=' + paths[d] + ';domain=' + domains[d];
        }
      }
    }
  }

  function loadGA() {
    if (document.querySelector('script[src*="googletagmanager.com/gtag"]')) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_ID);
  }

  function applyConsent(consent) {
    if (consent.analytics) {
      loadGA();
    } else {
      removeGaCookies();
    }
  }

  /* ── Public API ────────────────────────────────────────────── */
  window.CookieConsent = {
    get: function () { return getConsent(); },
    hasAnalytics: function () { return !!getConsent().analytics; },
    reset: function () { localStorage.removeItem(STORAGE_KEY); location.reload(); }
  };

  /* ── CSS ───────────────────────────────────────────────────── */
  var CSS = [
    '#abp-cookie-banner *,#abp-cookie-banner *::before,#abp-cookie-banner *::after{box-sizing:border-box;margin:0;padding:0;}',
    '#abp-cookie-banner{',
    '  position:fixed;bottom:0;left:0;right:0;z-index:99999;',
    '  background:#FAFAF8;border-top:1.5px solid #E2E8F0;',
    '  font-family:"Inter",system-ui,sans-serif;font-size:14px;color:#0F172A;',
    '  box-shadow:0 -4px 24px rgba(0,0,0,.08);',
    '  animation:abp-slideup .3s ease;',
    '}',
    '@keyframes abp-slideup{from{transform:translateY(100%);}to{transform:translateY(0);}}',
    '#abp-cookie-inner{max-width:1060px;margin:0 auto;padding:20px 5%;}',
    '#abp-cookie-main{display:flex;align-items:flex-start;gap:24px;flex-wrap:wrap;}',
    '#abp-cookie-text{flex:1;min-width:260px;line-height:1.6;color:#334155;}',
    '#abp-cookie-text a{color:#1D4ED8;text-decoration:underline;}',
    '#abp-cookie-text a:hover{color:#1E40AF;}',
    '#abp-cookie-actions{display:flex;gap:10px;flex-shrink:0;align-items:center;flex-wrap:wrap;}',
    '.abp-btn{padding:9px 20px;border-radius:8px;font-family:"Inter",system-ui,sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap;}',
    '.abp-btn-outline{background:transparent;border:1.5px solid #CBD5E1;color:#334155;}',
    '.abp-btn-outline:hover{border-color:#94A3B8;background:#F1F5F9;}',
    '.abp-btn-primary{background:#1D4ED8;border:1.5px solid #1D4ED8;color:#fff;}',
    '.abp-btn-primary:hover{background:#1E40AF;border-color:#1E40AF;}',
    '#abp-cookie-panel{margin-top:16px;border-top:1.5px solid #E2E8F0;padding-top:16px;display:none;}',
    '#abp-cookie-panel.open{display:block;}',
    '.abp-panel-title{font-size:13px;font-weight:700;color:#0F172A;margin-bottom:12px;}',
    '.abp-toggles{display:flex;flex-direction:column;gap:12px;margin-bottom:16px;}',
    '.abp-toggle-row{display:flex;align-items:flex-start;gap:14px;}',
    '.abp-toggle-info{flex:1;}',
    '.abp-toggle-label{font-size:13px;font-weight:600;color:#0F172A;}',
    '.abp-toggle-desc{font-size:12px;color:#64748B;margin-top:2px;}',
    '.abp-switch{position:relative;display:inline-block;width:42px;height:24px;flex-shrink:0;margin-top:1px;}',
    '.abp-switch input{opacity:0;width:0;height:0;}',
    '.abp-slider{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:#CBD5E1;border-radius:24px;transition:.2s;}',
    '.abp-slider::before{position:absolute;content:"";height:18px;width:18px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.2s;}',
    '.abp-switch input:checked+.abp-slider{background:#1D4ED8;}',
    '.abp-switch input:checked+.abp-slider::before{transform:translateX(18px);}',
    '.abp-switch input:disabled+.abp-slider{cursor:not-allowed;opacity:.7;}',
    '.abp-panel-footer{display:flex;justify-content:flex-end;}',
    '@media(max-width:640px){',
    '  #abp-cookie-main{flex-direction:column;}',
    '  #abp-cookie-actions{width:100%;justify-content:stretch;}',
    '  .abp-btn{flex:1;text-align:center;}',
    '}'
  ].join('\n');

  /* ── HTML ──────────────────────────────────────────────────── */
  function buildBanner() {
    var consent = getConsent();
    var analyticsChecked = consent.analytics !== false; // default ON se non ancora scelto
    var marketingChecked = !!consent.marketing;

    var html = [
      '<div id="abp-cookie-banner" role="dialog" aria-label="Preferenze cookie" aria-modal="true">',
      '  <div id="abp-cookie-inner">',
      '    <div id="abp-cookie-main">',
      '      <div id="abp-cookie-text">',
      '        Usiamo i cookie per migliorare la tua esperienza. Alcuni sono necessari al funzionamento del sito,',
      '        altri ci aiutano a capire come viene utilizzato.',
      '        <a href="/cookie-policy.html" target="_blank">Informativa cookie</a>',
      '      </div>',
      '      <div id="abp-cookie-actions">',
      '        <button class="abp-btn abp-btn-outline" id="abp-btn-reject">Rifiuta</button>',
      '        <button class="abp-btn abp-btn-outline" id="abp-btn-customize">Personalizza</button>',
      '        <button class="abp-btn abp-btn-primary" id="abp-btn-accept">Accetta tutti</button>',
      '      </div>',
      '    </div>',
      '    <div id="abp-cookie-panel" role="region" aria-label="Impostazioni cookie">',
      '      <div class="abp-panel-title">Gestisci le tue preferenze</div>',
      '      <div class="abp-toggles">',
      '        <div class="abp-toggle-row">',
      '          <div class="abp-toggle-info">',
      '            <div class="abp-toggle-label">Necessari</div>',
      '            <div class="abp-toggle-desc">Indispensabili per il funzionamento del sito. Non possono essere disabilitati.</div>',
      '          </div>',
      '          <label class="abp-switch" aria-label="Cookie necessari (sempre attivi)">',
      '            <input type="checkbox" id="abp-toggle-necessary" checked disabled>',
      '            <span class="abp-slider"></span>',
      '          </label>',
      '        </div>',
      '        <div class="abp-toggle-row">',
      '          <div class="abp-toggle-info">',
      '            <div class="abp-toggle-label">Analitici</div>',
      '            <div class="abp-toggle-desc">Google Analytics — statistiche anonime sull\'utilizzo del sito.</div>',
      '          </div>',
      '          <label class="abp-switch" aria-label="Cookie analitici">',
      '            <input type="checkbox" id="abp-toggle-analytics"' + (analyticsChecked ? ' checked' : '') + '>',
      '            <span class="abp-slider"></span>',
      '          </label>',
      '        </div>',
      '        <div class="abp-toggle-row">',
      '          <div class="abp-toggle-info">',
      '            <div class="abp-toggle-label">Marketing</div>',
      '            <div class="abp-toggle-desc">Cookie per pubblicità personalizzata e remarketing.</div>',
      '          </div>',
      '          <label class="abp-switch" aria-label="Cookie marketing">',
      '            <input type="checkbox" id="abp-toggle-marketing"' + (marketingChecked ? ' checked' : '') + '>',
      '            <span class="abp-slider"></span>',
      '          </label>',
      '        </div>',
      '      </div>',
      '      <div class="abp-panel-footer">',
      '        <button class="abp-btn abp-btn-primary" id="abp-btn-save">Salva preferenze</button>',
      '      </div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');

    return html;
  }

  function hideBanner() {
    var banner = document.getElementById('abp-cookie-banner');
    if (banner) {
      banner.style.animation = 'none';
      banner.style.transform = 'translateY(100%)';
      banner.style.transition = 'transform .3s ease';
      setTimeout(function () { if (banner.parentNode) banner.parentNode.removeChild(banner); }, 310);
    }
  }

  function showPanel() {
    var panel = document.getElementById('abp-cookie-panel');
    if (panel) {
      panel.classList.add('open');
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function initBanner() {
    /* Inject CSS */
    var style = document.createElement('style');
    style.id = 'abp-cookie-css';
    style.textContent = CSS;
    document.head.appendChild(style);

    /* Inject HTML */
    var container = document.createElement('div');
    container.innerHTML = buildBanner();
    document.body.appendChild(container.firstElementChild);

    /* Events */
    document.getElementById('abp-btn-reject').addEventListener('click', function () {
      var consent = { necessary: true, analytics: false, marketing: false };
      saveConsent(consent);
      applyConsent(consent);
      hideBanner();
    });

    document.getElementById('abp-btn-accept').addEventListener('click', function () {
      var consent = { necessary: true, analytics: true, marketing: true };
      saveConsent(consent);
      applyConsent(consent);
      hideBanner();
    });

    document.getElementById('abp-btn-customize').addEventListener('click', function () {
      showPanel();
    });

    document.getElementById('abp-btn-save').addEventListener('click', function () {
      var consent = {
        necessary: true,
        analytics: document.getElementById('abp-toggle-analytics').checked,
        marketing: document.getElementById('abp-toggle-marketing').checked
      };
      saveConsent(consent);
      applyConsent(consent);
      hideBanner();
    });
  }

  /* ── apriCookieSettings ────────────────────────────────────── */
  window.apriCookieSettings = function () {
    var consent = getConsent();
    // Se il banner è già presente, mostra solo il pannello
    if (document.getElementById('abp-cookie-banner')) {
      showPanel();
      return;
    }
    // Altrimenti resetta e ricostruisce il banner con pannello aperto
    var style = document.getElementById('abp-cookie-css');
    if (!style) {
      var s2 = document.createElement('style');
      s2.id = 'abp-cookie-css';
      s2.textContent = CSS;
      document.head.appendChild(s2);
    }
    var container = document.createElement('div');
    container.innerHTML = buildBanner();
    document.body.appendChild(container.firstElementChild);

    // Pre-popola con valori salvati
    if (consent.saved) {
      document.getElementById('abp-toggle-analytics').checked = !!consent.analytics;
      document.getElementById('abp-toggle-marketing').checked = !!consent.marketing;
    }

    document.getElementById('abp-btn-reject').addEventListener('click', function () {
      var c = { necessary: true, analytics: false, marketing: false };
      saveConsent(c); applyConsent(c); hideBanner();
    });
    document.getElementById('abp-btn-accept').addEventListener('click', function () {
      var c = { necessary: true, analytics: true, marketing: true };
      saveConsent(c); applyConsent(c); hideBanner();
    });
    document.getElementById('abp-btn-customize').addEventListener('click', showPanel);
    document.getElementById('abp-btn-save').addEventListener('click', function () {
      var c = {
        necessary: true,
        analytics: document.getElementById('abp-toggle-analytics').checked,
        marketing: document.getElementById('abp-toggle-marketing').checked
      };
      saveConsent(c); applyConsent(c); hideBanner();
    });

    showPanel();
  };

  /* ── Init ──────────────────────────────────────────────────── */
  function run() {
    var consent = getConsent();
    if (consent.saved) {
      // Preferenze già salvate → applica silenziosamente
      applyConsent(consent);
      return;
    }
    // Primo accesso → mostra banner
    initBanner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

})();
