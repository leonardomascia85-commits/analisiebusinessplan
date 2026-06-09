const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

// ── HELPER FORMATTERS ──
const fmt = (n) => {
  if (isNaN(n) || !isFinite(n) || n === 0) return '—';
  return new Intl.NumberFormat('it-IT', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0
  }).format(n);
};
const fp = (n, d = 1) => (isNaN(n) || !isFinite(n)) ? '—' : n.toFixed(d) + '%';
const fx = (n, d = 2) => (isNaN(n) || !isFinite(n)) ? '—' : n.toFixed(d) + 'x';

// ── CALCOLA INDICI ──
function calcIndici(d) {
  const ebitda = (d.tot_vp || 0) - ((d.mat_prime || 0) + (d.servizi || 0) + (d.godimento || 0) + (d.personale || 0) + (d.var_mat || 0) + (d.oneri_div || 0));
  const ebit = ebitda - (d.ammort || 0);
  const dbt_bt = (d.deb_b_bt || 0) + (d.deb_for || 0) + (d.deb_trib || 0);
  const pfn = ((d.deb_b_bt || 0) + (d.deb_b_lt || 0)) - (d.liquidita || 0);
  const roe = d.tot_pn > 0 ? (d.utile_es || 0) / d.tot_pn * 100 : NaN;
  const roi = d.tot_att > 0 ? ebit / d.tot_att * 100 : NaN;
  const ros = d.tot_vp > 0 ? ebit / d.tot_vp * 100 : NaN;
  const cr  = dbt_bt > 0 ? (d.tot_circ || 0) / dbt_bt : NaN;
  const acid = dbt_bt > 0 ? ((d.tot_circ || 0) - (d.rimanenze || 0)) / dbt_bt : NaN;
  const leva = d.tot_pn > 0 ? (d.tot_deb || 0) / d.tot_pn : NaN;
  const aut  = d.tot_att > 0 ? (d.tot_pn || 0) / d.tot_att * 100 : NaN;
  const ebitda_pct = d.tot_vp > 0 ? ebitda / d.tot_vp * 100 : NaN;
  const pfn_ebitda = ebitda > 0 && pfn > 0 ? pfn / ebitda : NaN;
  const pfn_pn = d.tot_pn > 0 ? pfn / d.tot_pn : NaN;
  const icr = (d.oneri_f || 0) > 0 ? ebit / d.oneri_f : NaN;
  const servizio = (d.rate_cap || 0) + (d.interessi || d.oneri_f || 0);
  const dscr = servizio > 0 && ebitda > 0 ? ebitda / servizio : NaN;
  return { ebitda, ebit, pfn, roe, roi, ros, cr, acid, leva, aut, ebitda_pct, pfn_ebitda, pfn_pn, icr, dscr, servizio };
}

// ── CALCOLA RATING ──
function calcRating(c) {
  let score = 0, max = 0;
  const add = (val, g, a, h = true, w = 1) => {
    max += w * 2;
    if (!isNaN(val) && isFinite(val)) {
      score += (h ? val >= g : val <= g) ? w * 2 : (h ? val >= a : val <= a) ? w : 0;
    }
  };
  add(c.dscr, 1.25, 1.0, true, 3);
  add(c.pfn_ebitda, 3, 5, false, 2);
  add(c.cr, 1.5, 1.0, true, 2);
  add(c.aut, 30, 15, true, 2);
  add(c.roe, 10, 5, true, 1);
  const pct = max > 0 ? score / max : 0;
  if (pct >= 0.85) return { l: 'A', color: '#059669', title: 'Eccellente bancabilità', desc: 'Profilo finanziario solido. Alta probabilità di accesso al credito a condizioni favorevoli.' };
  if (pct >= 0.70) return { l: 'B', color: '#2563EB', title: 'Buona bancabilità', desc: 'Buon profilo finanziario. Finanziamento probabile con normali garanzie.' };
  if (pct >= 0.55) return { l: 'C', color: '#D97706', title: 'Bancabilità sufficiente', desc: 'Profilo nella media. Possibili garanzie aggiuntive richieste dalle banche.' };
  if (pct >= 0.35) return { l: 'D', color: '#D97706', title: 'Bancabilità limitata', desc: 'Alcune criticità. Rafforzare il patrimonio prima di richiedere finanziamenti.' };
  return { l: 'E', color: '#DC2626', title: 'Profilo critico', desc: 'Significative criticità finanziarie. Interventi strutturali necessari.' };
}

// ── SEMAFORO COLORE ──
function semColor(val, thG, thA, higher = true) {
  if (isNaN(val) || !isFinite(val)) return '#94A3B8';
  const ok = higher ? val >= thG : val <= thG;
  const med = higher ? val >= thA : val <= thA;
  return ok ? '#059669' : med ? '#D97706' : '#DC2626';
}

// ── GENERA HTML PDF ──
function buildReportHTML(data, config) {
  const d = data;
  const c = calcIndici(d);
  const rating = calcRating(c);
  const anno = config.anno || '2024';
  const nome = config.nome || d.nome || 'Azienda';
  const analista = config.analista || 'AnalisiEBusinessPlan.it';
  const dataReport = config.dataReport || new Date().toLocaleDateString('it-IT');
  const note = config.note || '';
  const colore = config.colore === 'green' ? '#059669' : config.colore === 'dark' ? '#1E293B' : '#1D4ED8';

  // Dati anno precedente se disponibili
  const d1 = data._prev || null;
  const c1 = d1 ? calcIndici(d1) : null;
  const annoPrev = d1 ? (parseInt(anno) - 1).toString() : null;

  const hasRF = (d.rf_a || d.rf_b || d.rf_c) !== 0;

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,700;1,700&family=Inter:wght@400;500;600;700&display=swap');
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; color: #0F172A; background: #fff; font-size: 11px; line-height: 1.5; }

  /* COVER */
  .cover { width: 210mm; min-height: 297mm; background: linear-gradient(150deg, #0F172A 0%, #1E3A5F 60%, ${colore}22 100%); color: #fff; padding: 52px 48px; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; }
  .cv-branding { font-size: 11px; color: rgba(255,255,255,.4); letter-spacing: .15em; text-transform: uppercase; margin-bottom: 72px; }
  .cv-tipo { font-size: 11px; color: ${colore === '#1D4ED8' ? '#93C5FD' : '#6EE7B7'}; text-transform: uppercase; letter-spacing: .1em; margin-bottom: 14px; }
  .cv-nome { font-family: 'Fraunces', serif; font-size: 36px; font-weight: 700; line-height: 1.1; margin-bottom: 10px; }
  .cv-sub { font-size: 13px; color: rgba(255,255,255,.55); margin-bottom: 40px; }
  .cv-rating-row { display: flex; align-items: center; gap: 18px; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.12); border-radius: 14px; padding: 18px 24px; width: fit-content; }
  .cv-rating-letter { font-family: 'Fraunces', serif; font-size: 52px; font-weight: 700; color: ${rating.color}; line-height: 1; }
  .cv-rating-lbl { font-size: 9px; color: rgba(255,255,255,.45); text-transform: uppercase; letter-spacing: .08em; margin-bottom: 4px; }
  .cv-rating-title { font-size: 14px; font-weight: 600; color: #fff; }
  .cv-divider { height: 1px; background: rgba(255,255,255,.1); margin: 36px 0; }
  .cv-meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; }
  .cv-meta-lbl { font-size: 9px; color: rgba(255,255,255,.4); text-transform: uppercase; letter-spacing: .07em; margin-bottom: 5px; }
  .cv-meta-val { font-size: 13px; font-weight: 500; }
  .cv-footer { font-size: 9px; color: rgba(255,255,255,.25); margin-top: 48px; }

  /* CONTENT PAGES */
  .page { width: 210mm; padding: 36px 44px; page-break-after: always; position: relative; min-height: 297mm; }
  .page:last-child { page-break-after: avoid; }
  .page-header { border-bottom: 2px solid ${colore}; padding-bottom: 10px; margin-bottom: 24px; display: flex; align-items: flex-end; justify-content: space-between; }
  .ph-eyebrow { font-size: 9px; font-weight: 700; color: ${colore}; text-transform: uppercase; letter-spacing: .1em; margin-bottom: 4px; }
  .ph-title { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 700; color: #0F172A; }
  .ph-azienda { font-size: 10px; color: #64748B; text-align: right; }

  /* KPI ROW */
  .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 22px; }
  .kpi-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px 12px; }
  .kpi-lbl { font-size: 8px; color: #64748B; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 5px; }
  .kpi-val { font-family: 'Inter', sans-serif; font-size: 18px; font-weight: 700; line-height: 1; }

  /* TABLES */
  table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 18px; }
  thead th { background: #0F172A; color: #fff; padding: 8px 10px; text-align: left; font-weight: 600; font-size: 9px; letter-spacing: .03em; }
  thead th.r { text-align: right; }
  tbody td { padding: 6px 10px; border-bottom: 0.5px solid #F1F5F9; }
  tbody td.r { text-align: right; font-variant-numeric: tabular-nums; }
  tbody tr.sub td { color: #64748B; padding-left: 20px; font-size: 9.5px; }
  tbody tr.tot td { background: #F8FAFC; font-weight: 700; font-size: 10px; }
  tbody tr.tot-main td { background: #0F172A; color: #fff; font-weight: 700; }
  tbody tr.ebitda-row td { background: #ECFDF5; font-weight: 700; color: #059669; }
  .pos { color: #059669; } .neg { color: #DC2626; } .neu { color: #1D4ED8; }

  /* INDICI */
  .indici-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; }
  .ind-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px; }
  .ind-title { font-size: 9px; font-weight: 700; color: #0F172A; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 10px; border-bottom: 1px solid #E2E8F0; padding-bottom: 6px; }
  .ind-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: .5px solid #F1F5F9; font-size: 10px; }
  .ind-row:last-child { border: none; }
  .ind-lbl { color: #64748B; }
  .ind-val { font-weight: 700; }
  .ind-soglia { font-size: 9px; color: #94A3B8; }

  /* BANCABILITÀ */
  .banc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .banc-box { border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px; }
  .banc-name { font-size: 10px; font-weight: 700; color: #0F172A; margin-bottom: 3px; }
  .banc-desc { font-size: 9px; color: #64748B; margin-bottom: 10px; }
  .banc-val { font-family: 'Inter', sans-serif; font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  .banc-verdict { font-size: 9px; font-weight: 700; padding: 2px 8px; border-radius: 4px; display: inline-block; }
  .bv-g { background: #ECFDF5; color: #059669; }
  .bv-a { background: #FFFBEB; color: #D97706; }
  .bv-r { background: #FEF2F2; color: #DC2626; }
  .bv-0 { background: #F8FAFC; color: #64748B; }
  .bar-track { height: 5px; background: #F1F5F9; border-radius: 3px; overflow: hidden; margin-top: 7px; }
  .bar-fill { height: 100%; border-radius: 3px; }

  /* RATING PAGE */
  .rating-center { text-align: center; padding: 32px 20px; }
  .r-letter { font-family: 'Fraunces', serif; font-size: 100px; font-weight: 700; color: ${rating.color}; line-height: 1; }
  .r-title { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 700; color: #0F172A; margin: 10px 0 8px; }
  .r-desc { font-size: 13px; color: #475569; max-width: 380px; margin: 0 auto; line-height: 1.7; }

  /* SEMAFORI */
  .sem-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
  .sem-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #F8FAFC; border-radius: 8px; }
  .sem-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .sem-name { flex: 1; font-size: 10px; color: #475569; }
  .sem-val { font-size: 11px; font-weight: 700; }

  /* RF */
  .rf-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px; margin-bottom: 12px; }
  .rf-title { font-size: 9px; font-weight: 700; color: ${colore}; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 10px; }
  .rf-row { display: flex; justify-content: space-between; font-size: 10px; padding: 4px 0; border-bottom: .5px solid #E2E8F0; }
  .rf-row:last-child { border: none; }
  .rf-lbl { color: #64748B; }
  .rf-tot { display: flex; justify-content: space-between; background: #0F172A; color: #fff; border-radius: 8px; padding: 10px 14px; margin-top: 8px; font-weight: 700; font-size: 11px; }

  /* NOTE */
  .note-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; margin-top: 16px; }
  .note-title { font-size: 9px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 8px; }
  .note-text { font-size: 10px; color: #334155; line-height: 1.8; }

  /* FOOTER PAGINA */
  .page-footer { position: absolute; bottom: 20px; left: 44px; right: 44px; display: flex; justify-content: space-between; font-size: 8px; color: #94A3B8; border-top: .5px solid #E2E8F0; padding-top: 8px; }

  /* CONFRONTO */
  .comp-header { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 0; background: #0F172A; border-radius: 8px 8px 0 0; }
  .comp-header div { padding: 8px 10px; color: #fff; font-size: 9px; font-weight: 700; text-align: right; letter-spacing: .04em; }
  .comp-header div:first-child { text-align: left; }
  .comp-row { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 0; border-bottom: .5px solid #F1F5F9; }
  .comp-row:last-child { border: none; }
  .comp-row div { padding: 6px 10px; font-size: 10px; text-align: right; font-variant-numeric: tabular-nums; }
  .comp-row div:first-child { text-align: left; color: #64748B; }
  .comp-row.hi div { font-weight: 700; background: #F8FAFC; }
  .comp-row .up { color: #059669; }
  .comp-row .dn { color: #DC2626; }
  .comp-table { border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; margin-bottom: 16px; }
</style>
</head>
<body>

<!-- ══ COPERTINA ══ -->
<div class="cover">
  <div class="cv-branding">AnalisiEBusinessPlan.it — Software professionale di analisi bilancio</div>
  <div>
    <div class="cv-tipo">Analisi di Bilancio d'Esercizio</div>
    <div class="cv-nome">${nome}</div>
    <div class="cv-sub">Esercizio chiuso al 31/12/${anno}</div>
    <div class="cv-rating-row">
      <div class="cv-rating-letter">${rating.l}</div>
      <div>
        <div class="cv-rating-lbl">Rating sintetico bancabilità</div>
        <div class="cv-rating-title">${rating.title}</div>
      </div>
    </div>
    <div class="cv-divider"></div>
    <div class="cv-meta">
      <div><div class="cv-meta-lbl">Esercizio</div><div class="cv-meta-val">${anno}</div></div>
      <div><div class="cv-meta-lbl">Analista</div><div class="cv-meta-val">${analista}</div></div>
      <div><div class="cv-meta-lbl">Data report</div><div class="cv-meta-val">${dataReport}</div></div>
    </div>
  </div>
  <div class="cv-footer">Documento riservato — generato da AnalisiEBusinessPlan.it — uso professionale</div>
</div>

<!-- ══ PAG 2: EXECUTIVE SUMMARY ══ -->
<div class="page">
  <div class="page-header">
    <div><div class="ph-eyebrow">Sezione 1</div><div class="ph-title">Executive Summary</div></div>
    <div class="ph-azienda">${nome}<br/>${anno}</div>
  </div>
  <div class="kpi-row">
    <div class="kpi-box"><div class="kpi-lbl">Valore produzione</div><div class="kpi-val neu">${fmt(d.tot_vp)}</div></div>
    <div class="kpi-box"><div class="kpi-lbl">EBITDA</div><div class="kpi-val ${c.ebitda >= 0 ? 'pos' : 'neg'}">${fmt(c.ebitda)}</div></div>
    <div class="kpi-box"><div class="kpi-lbl">Utile / Perdita</div><div class="kpi-val ${(d.utile_es || 0) >= 0 ? 'pos' : 'neg'}">${fmt(d.utile_es)}</div></div>
    <div class="kpi-box"><div class="kpi-lbl">Totale attivo</div><div class="kpi-val">${fmt(d.tot_att)}</div></div>
  </div>
  <div class="kpi-row">
    <div class="kpi-box"><div class="kpi-lbl">Patrimonio netto</div><div class="kpi-val pos">${fmt(d.tot_pn)}</div></div>
    <div class="kpi-box"><div class="kpi-lbl">PFN</div><div class="kpi-val ${c.pfn <= 0 ? 'pos' : 'neg'}">${fmt(c.pfn)}</div></div>
    <div class="kpi-box"><div class="kpi-lbl">EBITDA margin</div><div class="kpi-val ${c.ebitda_pct >= 15 ? 'pos' : c.ebitda_pct >= 5 ? '' : 'neg'}">${fp(c.ebitda_pct)}</div></div>
    <div class="kpi-box"><div class="kpi-lbl">Autonomia fin.</div><div class="kpi-val ${c.aut >= 30 ? 'pos' : c.aut >= 15 ? '' : 'neg'}">${fp(c.aut)}</div></div>
  </div>
  <div class="sem-list">
    <div class="sem-item">
      <div class="sem-dot" style="background:${semColor(c.cr, 1.5, 1.0)}"></div>
      <span class="sem-name">Liquidità aziendale (Current Ratio)</span>
      <span class="sem-val" style="color:${semColor(c.cr, 1.5, 1.0)}">${fx(c.cr)}</span>
    </div>
    <div class="sem-item">
      <div class="sem-dot" style="background:${semColor(c.roe, 10, 5)}"></div>
      <span class="sem-name">Redditività (ROE)</span>
      <span class="sem-val" style="color:${semColor(c.roe, 10, 5)}">${fp(c.roe)}</span>
    </div>
    <div class="sem-item">
      <div class="sem-dot" style="background:${semColor(c.aut, 30, 15)}"></div>
      <span class="sem-name">Solidità patrimoniale (Autonomia fin.)</span>
      <span class="sem-val" style="color:${semColor(c.aut, 30, 15)}">${fp(c.aut)}</span>
    </div>
    <div class="sem-item">
      <div class="sem-dot" style="background:${semColor(isNaN(c.leva) ? NaN : c.leva, 2, 4, false)}"></div>
      <span class="sem-name">Indebitamento (Leva D/E)</span>
      <span class="sem-val" style="color:${semColor(isNaN(c.leva) ? NaN : c.leva, 2, 4, false)}">${fx(c.leva)}</span>
    </div>
    <div class="sem-item">
      <div class="sem-dot" style="background:${semColor(!isNaN(c.dscr) ? c.dscr : NaN, 1.25, 1.0)}"></div>
      <span class="sem-name">Bancabilità (DSCR)</span>
      <span class="sem-val" style="color:${semColor(!isNaN(c.dscr) ? c.dscr : NaN, 1.25, 1.0)}">${isNaN(c.dscr) ? 'n.d.' : fx(c.dscr)}</span>
    </div>
  </div>
  <div class="page-footer"><span>AnalisiEBusinessPlan.it</span><span>${nome} — Bilancio ${anno}</span><span>Pag. 2</span></div>
</div>

<!-- ══ PAG 3: STATO PATRIMONIALE ══ -->
<div class="page">
  <div class="page-header">
    <div><div class="ph-eyebrow">Sezione 2</div><div class="ph-title">Stato Patrimoniale</div></div>
    <div class="ph-azienda">${nome}<br/>${anno}</div>
  </div>
  <table>
    <thead><tr><th>Voce</th><th class="r">${anno}</th>${d1 ? `<th class="r">${annoPrev}</th><th class="r">Var %</th>` : ''}</tr></thead>
    <tbody>
      <tr class="tot"><td>B) Immobilizzazioni</td><td class="r">${fmt(d.tot_imm)}</td>${d1 ? `<td class="r">${fmt(d1.tot_imm)}</td><td class="r ${d.tot_imm >= (d1.tot_imm||0) ? 'pos' : 'neg'}">${d1.tot_imm ? ((d.tot_imm - d1.tot_imm)/Math.abs(d1.tot_imm)*100).toFixed(1)+'%' : '—'}</td>` : ''}</tr>
      <tr class="sub"><td>Immobilizzazioni immateriali</td><td class="r">${fmt(d.imm_imm)}</td>${d1 ? `<td class="r">${fmt(d1.imm_imm)}</td><td class="r"></td>` : ''}</tr>
      <tr class="sub"><td>Immobilizzazioni materiali</td><td class="r">${fmt(d.imm_mat)}</td>${d1 ? `<td class="r">${fmt(d1.imm_mat)}</td><td class="r"></td>` : ''}</tr>
      <tr class="sub"><td>Immobilizzazioni finanziarie</td><td class="r">${fmt(d.imm_fin)}</td>${d1 ? `<td class="r">${fmt(d1.imm_fin)}</td><td class="r"></td>` : ''}</tr>
      <tr class="tot"><td>C) Attivo circolante</td><td class="r">${fmt(d.tot_circ)}</td>${d1 ? `<td class="r">${fmt(d1.tot_circ)}</td><td class="r ${d.tot_circ >= (d1.tot_circ||0) ? 'pos' : 'neg'}">${d1.tot_circ ? ((d.tot_circ - d1.tot_circ)/Math.abs(d1.tot_circ)*100).toFixed(1)+'%' : '—'}</td>` : ''}</tr>
      <tr class="sub"><td>Rimanenze</td><td class="r">${fmt(d.rimanenze)}</td>${d1 ? `<td class="r">${fmt(d1.rimanenze)}</td><td class="r"></td>` : ''}</tr>
      <tr class="sub"><td>Crediti verso clienti</td><td class="r">${fmt(d.cred_cl)}</td>${d1 ? `<td class="r">${fmt(d1.cred_cl)}</td><td class="r"></td>` : ''}</tr>
      <tr class="sub"><td>Disponibilità liquide</td><td class="r">${fmt(d.liquidita)}</td>${d1 ? `<td class="r">${fmt(d1.liquidita)}</td><td class="r"></td>` : ''}</tr>
      <tr class="tot-main"><td>TOTALE ATTIVO</td><td class="r">${fmt(d.tot_att)}</td>${d1 ? `<td class="r">${fmt(d1.tot_att)}</td><td class="r ${d.tot_att >= (d1.tot_att||0) ? 'pos' : 'neg'}">${d1.tot_att ? ((d.tot_att - d1.tot_att)/Math.abs(d1.tot_att)*100).toFixed(1)+'%' : '—'}</td>` : ''}</tr>
      <tr class="tot"><td>A) Patrimonio netto</td><td class="r">${fmt(d.tot_pn)}</td>${d1 ? `<td class="r">${fmt(d1.tot_pn)}</td><td class="r ${d.tot_pn >= (d1.tot_pn||0) ? 'pos' : 'neg'}">${d1.tot_pn ? ((d.tot_pn - d1.tot_pn)/Math.abs(d1.tot_pn)*100).toFixed(1)+'%' : '—'}</td>` : ''}</tr>
      <tr class="sub"><td>Capitale sociale</td><td class="r">${fmt(d.cap_sociale)}</td>${d1 ? `<td class="r">${fmt(d1.cap_sociale)}</td><td class="r"></td>` : ''}</tr>
      <tr class="sub"><td>Utile / Perdita esercizio</td><td class="r ${(d.utile_es||0) >= 0 ? 'pos' : 'neg'}">${fmt(d.utile_es)}</td>${d1 ? `<td class="r ${(d1.utile_es||0) >= 0 ? 'pos' : 'neg'}">${fmt(d1.utile_es)}</td><td class="r"></td>` : ''}</tr>
      <tr class="tot"><td>D) Debiti</td><td class="r">${fmt(d.tot_deb)}</td>${d1 ? `<td class="r">${fmt(d1.tot_deb)}</td><td class="r ${d.tot_deb <= (d1.tot_deb||Infinity) ? 'pos' : 'neg'}">${d1.tot_deb ? ((d.tot_deb - d1.tot_deb)/Math.abs(d1.tot_deb)*100).toFixed(1)+'%' : '—'}</td>` : ''}</tr>
      <tr class="sub"><td>Debiti verso banche</td><td class="r">${fmt((d.deb_b_bt||0)+(d.deb_b_lt||0))}</td>${d1 ? `<td class="r">${fmt((d1.deb_b_bt||0)+(d1.deb_b_lt||0))}</td><td class="r"></td>` : ''}</tr>
      <tr class="sub"><td>Debiti verso fornitori</td><td class="r">${fmt(d.deb_for)}</td>${d1 ? `<td class="r">${fmt(d1.deb_for)}</td><td class="r"></td>` : ''}</tr>
      <tr class="tot-main"><td>TOTALE PASSIVO</td><td class="r">${fmt(d.tot_att)}</td>${d1 ? `<td class="r">${fmt(d1.tot_att)}</td><td class="r"></td>` : ''}</tr>
    </tbody>
  </table>
  <div class="page-footer"><span>AnalisiEBusinessPlan.it</span><span>${nome} — Bilancio ${anno}</span><span>Pag. 3</span></div>
</div>

<!-- ══ PAG 4: CONTO ECONOMICO ══ -->
<div class="page">
  <div class="page-header">
    <div><div class="ph-eyebrow">Sezione 3</div><div class="ph-title">Conto Economico</div></div>
    <div class="ph-azienda">${nome}<br/>${anno}</div>
  </div>
  <table>
    <thead><tr><th>Voce</th><th class="r">${anno}</th>${d1 ? `<th class="r">${annoPrev}</th><th class="r">Var %</th>` : ''}</tr></thead>
    <tbody>
      <tr class="tot"><td>A) Valore della produzione</td><td class="r">${fmt(d.tot_vp)}</td>${d1 ? `<td class="r">${fmt(d1.tot_vp)}</td><td class="r ${d.tot_vp >= (d1.tot_vp||0) ? 'pos' : 'neg'}">${d1.tot_vp ? ((d.tot_vp - d1.tot_vp)/Math.abs(d1.tot_vp)*100).toFixed(1)+'%' : '—'}</td>` : ''}</tr>
      <tr class="sub"><td>1) Ricavi delle vendite</td><td class="r">${fmt(d.ric_vend)}</td>${d1 ? `<td class="r">${fmt(d1.ric_vend)}</td><td class="r ${d.ric_vend >= (d1.ric_vend||0) ? 'pos' : 'neg'}">${d1.ric_vend ? ((d.ric_vend - d1.ric_vend)/Math.abs(d1.ric_vend)*100).toFixed(1)+'%' : '—'}</td>` : ''}</tr>
      <tr class="sub"><td>5) Altri ricavi e proventi</td><td class="r">${fmt(d.alt_ric)}</td>${d1 ? `<td class="r">${fmt(d1.alt_ric)}</td><td class="r"></td>` : ''}</tr>
      <tr class="tot"><td>B) Costi della produzione</td><td class="r">${fmt(d.tot_cos)}</td>${d1 ? `<td class="r">${fmt(d1.tot_cos)}</td><td class="r ${d.tot_cos <= (d1.tot_cos||Infinity) ? 'pos' : 'neg'}">${d1.tot_cos ? ((d.tot_cos - d1.tot_cos)/Math.abs(d1.tot_cos)*100).toFixed(1)+'%' : '—'}</td>` : ''}</tr>
      <tr class="sub"><td>6) Materie prime e merci</td><td class="r">${fmt(d.mat_prime)}</td>${d1 ? `<td class="r">${fmt(d1.mat_prime)}</td><td class="r"></td>` : ''}</tr>
      <tr class="sub"><td>7) Per servizi</td><td class="r">${fmt(d.servizi)}</td>${d1 ? `<td class="r">${fmt(d1.servizi)}</td><td class="r"></td>` : ''}</tr>
      <tr class="sub"><td>9) Per il personale</td><td class="r">${fmt(d.personale)}</td>${d1 ? `<td class="r">${fmt(d1.personale)}</td><td class="r"></td>` : ''}</tr>
      <tr class="sub"><td>10) Ammortamenti</td><td class="r">${fmt(d.ammort)}</td>${d1 ? `<td class="r">${fmt(d1.ammort)}</td><td class="r"></td>` : ''}</tr>
      <tr class="ebitda-row"><td><strong>EBITDA — Margine operativo lordo</strong></td><td class="r">${fmt(c.ebitda)}</td>${d1 ? `<td class="r">${fmt(c1.ebitda)}</td><td class="r ${c.ebitda >= (c1.ebitda||0) ? 'pos' : 'neg'}">${c1.ebitda ? ((c.ebitda - c1.ebitda)/Math.abs(c1.ebitda)*100).toFixed(1)+'%' : '—'}</td>` : ''}</tr>
      <tr class="sub"><td>EBITDA margin</td><td class="r">${fp(c.ebitda_pct)}</td>${d1 ? `<td class="r">${fp(c1.ebitda_pct)}</td><td class="r"></td>` : ''}</tr>
      <tr><td>C) Oneri finanziari netti</td><td class="r neg">-${fmt(d.oneri_f)}</td>${d1 ? `<td class="r neg">-${fmt(d1.oneri_f)}</td><td class="r"></td>` : ''}</tr>
      <tr><td>20) Imposte (IRES + IRAP)</td><td class="r neg">-${fmt(d.imposte)}</td>${d1 ? `<td class="r neg">-${fmt(d1.imposte)}</td><td class="r"></td>` : ''}</tr>
      <tr class="tot-main"><td>UTILE / PERDITA NETTO</td><td class="r ${(d.utile_es||0)>=0?'pos':'neg'}">${fmt(d.utile_es)}</td>${d1 ? `<td class="r ${(d1.utile_es||0)>=0?'pos':'neg'}">${fmt(d1.utile_es)}</td><td class="r ${(d.utile_es||0) >= (d1.utile_es||0) ? 'pos' : 'neg'}">${d1.utile_es ? ((( d.utile_es||0) - (d1.utile_es||0))/Math.abs(d1.utile_es)*100).toFixed(1)+'%' : '—'}</td>` : ''}</tr>
    </tbody>
  </table>
  <div class="page-footer"><span>AnalisiEBusinessPlan.it</span><span>${nome} — Bilancio ${anno}</span><span>Pag. 4</span></div>
</div>

<!-- ══ PAG 5: INDICI ══ -->
<div class="page">
  <div class="page-header">
    <div><div class="ph-eyebrow">Sezione 4</div><div class="ph-title">Indici di Bilancio</div></div>
    <div class="ph-azienda">${nome}<br/>${anno}</div>
  </div>
  <div class="indici-grid">
    <div class="ind-box">
      <div class="ind-title">Redditività</div>
      <div class="ind-row"><span class="ind-lbl">ROE</span><span class="ind-val" style="color:${semColor(c.roe,10,5)}">${fp(c.roe)}</span><span class="ind-soglia">soglia &gt; 5%</span></div>
      <div class="ind-row"><span class="ind-lbl">ROI</span><span class="ind-val" style="color:${semColor(c.roi,8,3)}">${fp(c.roi)}</span><span class="ind-soglia">soglia &gt; 8%</span></div>
      <div class="ind-row"><span class="ind-lbl">ROS</span><span class="ind-val" style="color:${semColor(c.ros,10,3)}">${fp(c.ros)}</span><span class="ind-soglia">soglia &gt; 10%</span></div>
      <div class="ind-row"><span class="ind-lbl">EBITDA margin</span><span class="ind-val" style="color:${semColor(c.ebitda_pct,15,5)}">${fp(c.ebitda_pct)}</span><span class="ind-soglia">soglia &gt; 15%</span></div>
    </div>
    <div class="ind-box">
      <div class="ind-title">Liquidità</div>
      <div class="ind-row"><span class="ind-lbl">Current Ratio</span><span class="ind-val" style="color:${semColor(c.cr,1.5,1.0)}">${fx(c.cr)}</span><span class="ind-soglia">soglia &gt; 1,5x</span></div>
      <div class="ind-row"><span class="ind-lbl">Acid Test</span><span class="ind-val" style="color:${semColor(c.acid,1.0,0.7)}">${fx(c.acid)}</span><span class="ind-soglia">soglia &gt; 1,0x</span></div>
      <div class="ind-row"><span class="ind-lbl">Liquidità (€)</span><span class="ind-val">${fmt(d.liquidita)}</span><span class="ind-soglia">—</span></div>
    </div>
    <div class="ind-box">
      <div class="ind-title">Solidità patrimoniale</div>
      <div class="ind-row"><span class="ind-lbl">Autonomia fin.</span><span class="ind-val" style="color:${semColor(c.aut,30,15)}">${fp(c.aut)}</span><span class="ind-soglia">soglia &gt; 30%</span></div>
      <div class="ind-row"><span class="ind-lbl">Leva D/E</span><span class="ind-val" style="color:${semColor(c.leva,2,4,false)}">${fx(c.leva)}</span><span class="ind-soglia">soglia &lt; 2x</span></div>
      <div class="ind-row"><span class="ind-lbl">Patrimonio netto</span><span class="ind-val">${fmt(d.tot_pn)}</span><span class="ind-soglia">—</span></div>
    </div>
    <div class="ind-box">
      <div class="ind-title">Efficienza</div>
      <div class="ind-row"><span class="ind-lbl">Rot. rimanenze</span><span class="ind-val">${d.mat_prime&&d.rimanenze ? Math.round(d.rimanenze/d.mat_prime*365)+'gg' : '—'}</span><span class="ind-soglia">giorni medi</span></div>
      <div class="ind-row"><span class="ind-lbl">Rot. crediti clienti</span><span class="ind-val">${d.ric_vend&&d.cred_cl ? Math.round(d.cred_cl/d.ric_vend*365)+'gg' : '—'}</span><span class="ind-soglia">DSO</span></div>
      <div class="ind-row"><span class="ind-lbl">Rot. debiti fornitori</span><span class="ind-val">${d.mat_prime&&d.deb_for ? Math.round(d.deb_for/d.mat_prime*365)+'gg' : '—'}</span><span class="ind-soglia">DPO</span></div>
    </div>
  </div>
  <div class="page-footer"><span>AnalisiEBusinessPlan.it</span><span>${nome} — Bilancio ${anno}</span><span>Pag. 5</span></div>
</div>

<!-- ══ PAG 6: BANCABILITÀ ══ -->
<div class="page">
  <div class="page-header">
    <div><div class="ph-eyebrow">Sezione 5</div><div class="ph-title">Analisi Bancabilità EBA 2021</div></div>
    <div class="ph-azienda">${nome}<br/>${anno}</div>
  </div>
  <div class="banc-grid">
    <div class="banc-box">
      <div class="banc-name">DSCR — Debt Service Coverage Ratio</div>
      <div class="banc-desc">EBITDA / Servizio del debito annuo (rate capitale + interessi)</div>
      <div class="banc-val" style="color:${semColor(c.dscr,1.25,1.0)}">${isNaN(c.dscr)?'n.d.':fx(c.dscr)}</div>
      <span class="banc-verdict ${isNaN(c.dscr)?'bv-0':c.dscr>=1.25?'bv-g':c.dscr>=1.0?'bv-a':'bv-r'}">${isNaN(c.dscr)?'Inserire servizio debito':c.dscr>=1.25?'✓ Bancabile — soglia 1,25x':c.dscr>=1.0?'⚠ Borderline — soglia 1,25x':'✗ Non bancabile'}</span>
      ${!isNaN(c.dscr)?`<div class="bar-track"><div class="bar-fill" style="width:${Math.min(c.dscr/2.5*100,100)}%;background:${semColor(c.dscr,1.25,1.0)}"></div></div>`:''}
    </div>
    <div class="banc-box">
      <div class="banc-name">PFN — Posizione Finanziaria Netta</div>
      <div class="banc-desc">Debiti finanziari netti al netto della liquidità disponibile</div>
      <div class="banc-val" style="color:${c.pfn<=0?'#059669':'#D97706'}">${fmt(c.pfn)}</div>
      <span class="banc-verdict ${c.pfn<=0?'bv-g':'bv-a'}">${c.pfn<=0?'✓ PFN negativa — cassa netta':'Debiti finanziari netti'}</span>
    </div>
    <div class="banc-box">
      <div class="banc-name">PFN / EBITDA</div>
      <div class="banc-desc">Anni necessari per rimborsare il debito netto con l'EBITDA</div>
      <div class="banc-val" style="color:${!isNaN(c.pfn_ebitda)&&c.pfn_ebitda>0?semColor(c.pfn_ebitda,3,5,false):'#059669'}">${!isNaN(c.pfn_ebitda)&&c.pfn_ebitda>0?c.pfn_ebitda.toFixed(2)+'x':c.pfn<=0?'< 0 (ottimo)':'—'}</div>
      <span class="banc-verdict ${!isNaN(c.pfn_ebitda)&&c.pfn_ebitda>0?(c.pfn_ebitda<3?'bv-g':c.pfn_ebitda<5?'bv-a':'bv-r'):'bv-g'}">${!isNaN(c.pfn_ebitda)&&c.pfn_ebitda>0?(c.pfn_ebitda<3?'✓ Ottimo < 3x':c.pfn_ebitda<5?'⚠ Accettabile < 5x':'✗ Elevato > 5x'):'✓ Eccellente'}</span>
    </div>
    <div class="banc-box">
      <div class="banc-name">ICR — Interest Coverage Ratio</div>
      <div class="banc-desc">EBIT / Oneri finanziari — capacità di coprire gli interessi</div>
      <div class="banc-val" style="color:${semColor(c.icr,3,1.5)}">${isNaN(c.icr)?'n.d.':fx(c.icr)}</div>
      <span class="banc-verdict ${isNaN(c.icr)?'bv-0':c.icr>=3?'bv-g':c.icr>=1.5?'bv-a':'bv-r'}">${isNaN(c.icr)?'Nessun onere fin.':c.icr>=3?'✓ Ottimo > 3x':c.icr>=1.5?'⚠ Sufficiente':'✗ Critico'}</span>
    </div>
  </div>
  <div class="page-footer"><span>AnalisiEBusinessPlan.it</span><span>${nome} — Bilancio ${anno}</span><span>Pag. 6</span></div>
</div>

${hasRF ? `
<!-- ══ PAG 7: RENDICONTO FINANZIARIO ══ -->
<div class="page">
  <div class="page-header">
    <div><div class="ph-eyebrow">Sezione 6</div><div class="ph-title">Rendiconto Finanziario</div></div>
    <div class="ph-azienda">${nome}<br/>${anno}</div>
  </div>
  <div class="rf-box">
    <div class="rf-title">A) Flussi da attività operativa</div>
    <div class="rf-row"><span class="rf-lbl">Utile/perdita esercizio</span><span>${fmt(d.rf_utile||d.utile_es)}</span></div>
    <div class="rf-row"><span class="rf-lbl">Ammortamenti (rettifica)</span><span>${fmt(d.rf_ammort||d.ammort)}</span></div>
    <div class="rf-row"><span class="rf-lbl">Variazione capitale circolante</span><span>${fmt((d.rf_rim||0)+(d.rf_cred||0)+(d.rf_deb||0)+(d.rf_ccn||0))}</span></div>
    <div class="rf-row"><span class="rf-lbl">Interessi e imposte pagati</span><span>-${fmt((d.rf_int||0)+(d.rf_tax||0))}</span></div>
    <div class="rf-tot"><span>Flusso operativo (A)</span><span style="color:${(d.rf_a||0)>=0?'#6EE7B7':'#FCA5A5'}">${fmt(d.rf_a)}</span></div>
  </div>
  <div class="rf-box">
    <div class="rf-title">B) Flussi da attività di investimento</div>
    <div class="rf-row"><span class="rf-lbl">Investimenti in immobilizzazioni</span><span>-${fmt(Math.abs((d.rf_inv_mat||0)+(d.rf_inv_imm||0)))}</span></div>
    <div class="rf-row"><span class="rf-lbl">Disinvestimenti</span><span>${fmt(d.rf_disinv)}</span></div>
    <div class="rf-tot"><span>Flusso investimento (B)</span><span style="color:${(d.rf_b||0)>=0?'#6EE7B7':'#FCA5A5'}">${fmt(d.rf_b)}</span></div>
  </div>
  <div class="rf-box">
    <div class="rf-title">C) Flussi da attività di finanziamento</div>
    <div class="rf-row"><span class="rf-lbl">Variazione debiti bancari</span><span>${fmt(d.rf_fin_bt)}</span></div>
    <div class="rf-row"><span class="rf-lbl">Rimborso finanziamenti</span><span>-${fmt(Math.abs(d.rf_rimb||0))}</span></div>
    <div class="rf-tot"><span>Flusso finanziamento (C)</span><span style="color:${(d.rf_c||0)>=0?'#6EE7B7':'#FCA5A5'}">${fmt(d.rf_c)}</span></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px;">
    <div class="rf-box">
      <div class="rf-title">Variazione liquidità (A+B+C)</div>
      <div style="font-size:20px;font-weight:700;color:${(d.rf_tot||((d.rf_a||0)+(d.rf_b||0)+(d.rf_c||0)))>=0?'#059669':'#DC2626'};margin-top:6px;">${fmt(d.rf_tot||((d.rf_a||0)+(d.rf_b||0)+(d.rf_c||0)))}</div>
    </div>
    <div class="rf-box">
      <div class="rf-title">Free Cash Flow (A+B)</div>
      <div style="font-size:20px;font-weight:700;color:${(d.rf_fcf||((d.rf_a||0)+(d.rf_b||0)))>=0?'#059669':'#DC2626'};margin-top:6px;">${fmt(d.rf_fcf||((d.rf_a||0)+(d.rf_b||0)))}</div>
    </div>
  </div>
  <div class="page-footer"><span>AnalisiEBusinessPlan.it</span><span>${nome} — Bilancio ${anno}</span><span>Pag. 7</span></div>
</div>` : ''}

<!-- ══ PAG FINALE: RATING ══ -->
<div class="page">
  <div class="page-header">
    <div><div class="ph-eyebrow">Sezione ${hasRF ? '7' : '6'}</div><div class="ph-title">Rating Sintetico di Bancabilità</div></div>
    <div class="ph-azienda">${nome}<br/>${anno}</div>
  </div>
  <div class="rating-center">
    <div class="r-letter">${rating.l}</div>
    <div class="r-title">${rating.title}</div>
    <p class="r-desc">${rating.desc}</p>
  </div>
  ${note ? `<div class="note-box"><div class="note-title">Note dell'analista</div><div class="note-text">${note}</div></div>` : ''}
  <div style="text-align:center;margin-top:32px;font-size:9px;color:#94A3B8;border-top:1px solid #E2E8F0;padding-top:14px;">
    Report generato da AnalisiEBusinessPlan.it · Dati tratti dal bilancio ufficiale depositato al Registro Imprese · Uso professionale riservato<br/>
    Generato il ${dataReport} · Gli indici sono calcolati secondo le linee guida EBA Guidelines on loan origination and monitoring (EBA/GL/2020/06)
  </div>
  <div class="page-footer"><span>AnalisiEBusinessPlan.it</span><span>${nome} — Bilancio ${anno}</span><span>Ultima pagina</span></div>
</div>

</body></html>`;
}

// ── HANDLER PRINCIPALE ──
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { data, config } = req.body;
  if (!data) return res.status(400).json({ error: 'Dati bilancio mancanti' });

  let browser = null;
  try {
    const html = buildReportHTML(data, config || {});

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    const nome = (config?.nome || 'Report').replace(/[^a-zA-Z0-9]/g, '-');
    const anno = config?.anno || new Date().getFullYear();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Analisi-Bilancio-${nome}-${anno}.pdf"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.status(200).send(pdf);

  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Errore generazione PDF: ' + error.message });
  } finally {
    if (browser) await browser.close();
  }
};
