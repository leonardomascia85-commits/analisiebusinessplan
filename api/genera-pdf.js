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
const fgg = (n) => (isNaN(n) || !isFinite(n) || n <= 0) ? '—' : Math.round(n) + ' gg';

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
  // Efficienza
  const dsi = d.mat_prime > 0 && d.rimanenze > 0 ? d.rimanenze / d.mat_prime * 365 : NaN;
  const dso = d.ric_vend > 0 && d.cred_cl > 0 ? d.cred_cl / d.ric_vend * 365 : NaN;
  const dpo = d.mat_prime > 0 && d.deb_for > 0 ? d.deb_for / d.mat_prime * 365 : NaN;
  const ccn_giorni = (!isNaN(dsi) && !isNaN(dso) && !isNaN(dpo)) ? dsi + dso - dpo : NaN;
  // Cash Flow semplificato
  const cf = (d.utile_es || 0) + (d.ammort || 0);
  return { ebitda, ebit, pfn, roe, roi, ros, cr, acid, leva, aut, ebitda_pct,
           pfn_ebitda, pfn_pn, icr, dscr, servizio, dsi, dso, dpo, ccn_giorni, cf };
}

// ── CALCOLA RATING — MODELLO IBRIDO 3 LIVELLI ──
// Livello 1: Z-Score Altman adattato PMI italiane (Giacosa-Mazzoleni 2018)
// Livello 2: Scorecard EBA/GL/2020/06
// Livello 3: Trigger allerta CCII (D.Lgs. 14/2019)
function calcRating(c, d) {
  const v = (x) => (!isNaN(x) && isFinite(x));

  // ── LIVELLO 1: Z'-Score Altman PMI Italia ──
  // Z' = 0.877*X1 + 0.847*X2 + 3.107*X3 + 0.420*X4 + 0.998*X5
  // X1 = CCN / Totale Attivo
  // X2 = Utili non distribuiti (riserve) / Totale Attivo
  // X3 = EBIT / Totale Attivo
  // X4 = Patrimonio Netto / Totale Debiti
  // X5 = Ricavi / Totale Attivo
  let zScore = null;
  let zLabel = '—';
  let zClass = 'neu';
  const totAtt = d.tot_att || 0;
  if (totAtt > 0) {
    const ccn = (d.tot_circ || 0) - ((d.deb_b_bt || 0) + (d.deb_for || 0) + (d.deb_trib || 0));
    const riserve = (d.tot_pn || 0) - (d.cap_sociale || 0) - (d.utile_es || 0);
    const X1 = ccn / totAtt;
    const X2 = riserve / totAtt;
    const X3 = c.ebit / totAtt;
    const X4 = d.tot_pn > 0 && d.tot_deb > 0 ? d.tot_pn / d.tot_deb : (d.tot_pn > 0 ? 999 : 0);
    const X5 = d.ric_vend > 0 ? d.ric_vend / totAtt : (d.tot_vp || 0) / totAtt;
    zScore = 0.877 * X1 + 0.847 * X2 + 3.107 * X3 + 0.420 * X4 + 0.998 * X5;
    // Soglie Altman PMI non quotate: < 1.23 = zona insolvenza, 1.23-2.90 = zona grigia, > 2.90 = zona sicura
    if (zScore >= 2.90) { zLabel = 'Zona sicura (Z > 2,90)'; zClass = 'pos'; }
    else if (zScore >= 1.23) { zLabel = 'Zona grigia (1,23 < Z < 2,90)'; zClass = 'warn'; }
    else { zLabel = 'Zona insolvenza (Z < 1,23)'; zClass = 'neg'; }
  }

  // ── LIVELLO 2: Scorecard EBA ponderata ──
  // Pesi basati su prassi bancaria italiana (fonte: Basilea III, EBA/GL/2020/06)
  const items = [
    // [valore, soglia_verde, soglia_gialla, higher_is_better, peso, nome]
    [c.dscr,        1.25,  1.0,   true,  25, 'DSCR'],
    [c.pfn_ebitda,  3.0,   5.0,   false, 20, 'PFN/EBITDA'],
    [c.aut,         30,    15,    true,  15, 'Autonomia fin.'],
    [c.cr,          1.5,   1.0,   true,  15, 'Current Ratio'],
    [c.roi,         8,     3,     true,  10, 'ROI'],
    [c.icr,         3.0,   1.5,   true,  10, 'ICR'],
    [c.leva,        2.0,   3.5,   false,  5, 'Leva D/E'],
  ];
  let scoreEBA = 0, maxEBA = 0, ebaDetails = [];
  for (const [val, g, a, higher, peso, nome] of items) {
    maxEBA += peso * 2;
    let punti = 0, giudizio = 'n.d.', colore = '#94A3B8';
    if (v(val)) {
      const verde = higher ? val >= g : val <= g;
      const giallo = higher ? val >= a : val <= a;
      punti = verde ? peso * 2 : giallo ? peso : 0;
      giudizio = verde ? 'Ottimo' : giallo ? 'Sufficiente' : 'Critico';
      colore = verde ? '#059669' : giallo ? '#D97706' : '#DC2626';
    }
    scoreEBA += punti;
    ebaDetails.push({ nome, val, g, a, higher, peso, punti, giudizio, colore });
  }
  const pctEBA = maxEBA > 0 ? scoreEBA / maxEBA : 0;

  // ── LIVELLO 3: Trigger allerta CCII (D.Lgs. 14/2019 + CNDCEC) ──
  // 7 segnali di allerta — se >= 2 attivi degrada il rating
  const triggers = [];
  if (v(c.dscr) && c.dscr < 1.1) triggers.push('DSCR < 1,1 (soglia EBA Stage 2)');
  if (v(c.pfn_ebitda) && c.pfn_ebitda > 6) triggers.push('PFN/EBITDA > 6x (soglia BCE Stage 2)');
  if ((d.utile_es || 0) < 0) triggers.push('Perdita d\'esercizio');
  if (v(c.aut) && c.aut < 15) triggers.push('Autonomia finanziaria < 15%');
  if (v(c.cr) && c.cr < 1.0) triggers.push('Current Ratio < 1,0 (illiquidità a breve)');
  if (d._prev) {
    const prevVP = d._prev.tot_vp || 0;
    const currVP = d.tot_vp || 0;
    if (prevVP > 0 && (currVP - prevVP) / prevVP < -0.30)
      triggers.push('Fatturato in calo > 30% vs anno precedente');
    const prevPN = d._prev.tot_pn || 0;
    const currPN = d.tot_pn || 0;
    if (prevPN > 0 && (currPN - prevPN) / prevPN < -0.50)
      triggers.push('Patrimonio netto ridotto > 50% vs anno precedente');
  }

  // ── RATING FINALE: combinazione pesata ──
  // Base: scorecard EBA (70%) + Z-Score normalizzato (30%)
  // Penalità: -1 livello se >= 2 trigger CCII attivi
  let ratingScore = pctEBA;
  if (zScore !== null) {
    // Normalizza Z-Score: < 1.23 = 0, 1.23-2.90 = 0.5, > 2.90 = 1
    const zNorm = zScore >= 2.90 ? 1 : zScore >= 1.23 ? 0.5 : 0;
    ratingScore = pctEBA * 0.70 + zNorm * 0.30;
  }

  // Determina rating base
  let rating;
  if (ratingScore >= 0.82)      rating = { l: 'A+', color: '#047857', title: 'Eccellente', desc: 'Profilo finanziario di eccellenza. Accesso al credito facilitato alle migliori condizioni di mercato.' };
  else if (ratingScore >= 0.68) rating = { l: 'A',  color: '#059669', title: 'Ottima bancabilità', desc: 'Profilo finanziario solido. Alta probabilità di accesso al credito a condizioni favorevoli.' };
  else if (ratingScore >= 0.55) rating = { l: 'B+', color: '#2563EB', title: 'Buona bancabilità', desc: 'Buon profilo finanziario. Finanziamento probabile con normali condizioni e garanzie standard.' };
  else if (ratingScore >= 0.42) rating = { l: 'B',  color: '#3B82F6', title: 'Bancabilità discreta', desc: 'Profilo nella media. Possibili richieste di garanzie aggiuntive da parte degli istituti.' };
  else if (ratingScore >= 0.28) rating = { l: 'C',  color: '#D97706', title: 'Bancabilità limitata', desc: 'Alcune criticità rilevate. Rafforzare il patrimonio prima di richiedere nuovi finanziamenti.' };
  else                          rating = { l: 'D',  color: '#DC2626', title: 'Profilo critico', desc: 'Significative criticità finanziarie. Interventi strutturali urgenti necessari.' };

  // Applica penalità trigger CCII
  const penalized = triggers.length >= 2;
  if (penalized) {
    const scale = ['A+','A','B+','B','C','D'];
    const idx = scale.indexOf(rating.l);
    if (idx < scale.length - 1) {
      const downgrade = ['A','B+','B','C','D','D'];
      rating = { ...rating, l: downgrade[idx], penalized: true };
    }
    rating.triggerNote = `Rating penalizzato di 1 livello per ${triggers.length} segnali di allerta CCII attivi.`;
  }

  return { ...rating, zScore, zLabel, zClass, pctEBA, scoreEBA, maxEBA, ebaDetails, triggers, ratingScore };
}

// ── SEMAFORO COLORE ──
function semColor(val, thG, thA, higher = true) {
  if (isNaN(val) || !isFinite(val)) return '#94A3B8';
  const ok = higher ? val >= thG : val <= thG;
  const med = higher ? val >= thA : val <= thA;
  return ok ? '#059669' : med ? '#D97706' : '#DC2626';
}

// ── GENERA COMMENTO NARRATIVO AUTOMATICO ──
function buildNarrative(c, d, rating) {
  const anno = d._anno || '—';
  const nome = d._nome || 'L\'azienda';

  let redditività = '';
  if (!isNaN(c.ebitda_pct)) {
    if (c.ebitda_pct >= 20) redditività = `L'EBITDA margin del ${fp(c.ebitda_pct)} è eccellente e indica una forte capacità di generare cassa operativa.`;
    else if (c.ebitda_pct >= 10) redditività = `L'EBITDA margin del ${fp(c.ebitda_pct)} è nella norma per il settore.`;
    else redditività = `L'EBITDA margin del ${fp(c.ebitda_pct)} è contenuto e richiede attenzione ai costi operativi.`;
  }

  let liquidita = '';
  if (!isNaN(c.cr)) {
    if (c.cr >= 1.5) liquidita = `La liquidità corrente (${fx(c.cr)}) garantisce ampi margini per far fronte agli impegni a breve.`;
    else if (c.cr >= 1.0) liquidita = `La liquidità corrente (${fx(c.cr)}) è sufficiente ma da monitorare.`;
    else liquidita = `La liquidità corrente (${fx(c.cr)}) è sotto la soglia critica: rischio di tensioni a breve.`;
  }

  let solidita = '';
  if (!isNaN(c.aut)) {
    if (c.aut >= 40) solidita = `La struttura patrimoniale è solida con un'autonomia finanziaria del ${fp(c.aut)}, ben oltre la soglia EBA del 30%.`;
    else if (c.aut >= 30) solidita = `L'autonomia finanziaria del ${fp(c.aut)} soddisfa le soglie EBA minime.`;
    else solidita = `L'autonomia finanziaria del ${fp(c.aut)} è sotto la soglia EBA del 30%: struttura patrimoniale da rafforzare.`;
  }

  let bancabilita = '';
  if (!isNaN(c.dscr)) {
    if (c.dscr >= 1.25) bancabilita = `Il DSCR di ${fx(c.dscr)} supera ampiamente la soglia EBA di 1,25x, confermando la piena capacità di servire il debito.`;
    else if (c.dscr >= 1.0) bancabilita = `Il DSCR di ${fx(c.dscr)} è appena sotto la soglia EBA ottimale di 1,25x.`;
    else bancabilita = `Il DSCR di ${fx(c.dscr)} è sotto 1,0x: segnale di allerta EBA formale (Stage 2).`;
  }

  return [redditività, liquidita, solidita, bancabilita].filter(Boolean).join(' ');
}

// ── GENERA HTML PDF ──
function buildReportHTML(data, config) {
  const d = data;
  const c = calcIndici(d);
  d._anno = config.anno || '2024';
  d._nome = config.nome || d.nome || 'Azienda';
  const rating = calcRating(c, d);
  const anno = d._anno;
  const nome = d._nome;
  const analista = config.analista || 'AnalisiEBusinessPlan.it';
  const dataReport = config.dataReport || new Date().toLocaleDateString('it-IT');
  const note = config.note || '';
  const colore = config.colore === 'green' ? '#059669' : config.colore === 'dark' ? '#1E293B' : '#1D4ED8';
  const narrative = buildNarrative(c, d, rating);

  const d1 = data._prev || null;
  const c1 = d1 ? calcIndici(d1) : null;
  const annoPrev = d1 ? (parseInt(anno) - 1).toString() : null;
  const hasRF = (d.rf_a || d.rf_b || d.rf_c) !== undefined && (d.rf_a || d.rf_b || d.rf_c) !== 0;

  const varPct = (curr, prev) => {
    if (!prev || prev === 0) return '';
    const v = (curr - prev) / Math.abs(prev) * 100;
    return v.toFixed(1) + '%';
  };
  const varClass = (curr, prev, lowerIsBetter = false) => {
    if (!prev) return '';
    const better = lowerIsBetter ? curr <= prev : curr >= prev;
    return better ? 'pos' : 'neg';
  };

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,700;1,700&family=Inter:wght@300;400;500;600;700&display=swap');
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; color: #0F172A; background: #fff; font-size: 11px; line-height: 1.5; }

  /* COVER */
  .cover { width: 210mm; min-height: 297mm; background: #0A1628; color: #fff; padding: 52px 48px; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; position: relative; overflow: hidden; }
  .cover::before { content: ''; position: absolute; top: 0; right: 0; width: 55%; height: 100%; background: linear-gradient(135deg, transparent 0%, #1E3A5F 50%, #0E2A4A 100%); clip-path: polygon(20% 0%, 100% 0%, 100% 100%, 0% 100%); }
  .cv-branding { font-size: 10px; color: rgba(255,255,255,.35); letter-spacing: .18em; text-transform: uppercase; margin-bottom: 80px; position: relative; z-index: 1; }
  .cv-tipo { font-size: 10px; color: #60A5FA; text-transform: uppercase; letter-spacing: .12em; margin-bottom: 16px; position: relative; z-index: 1; }
  .cv-nome { font-family: 'Fraunces', serif; font-size: 36px; font-weight: 700; line-height: 1.05; margin-bottom: 8px; position: relative; z-index: 1; }
  .cv-sub { font-size: 13px; color: rgba(255,255,255,.5); margin-bottom: 40px; font-weight: 300; position: relative; z-index: 1; }
  .cv-rating-chip { display: inline-flex; align-items: center; gap: 20px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: 16px; padding: 20px 28px; width: fit-content; position: relative; z-index: 1; }
  .cv-r-letter { font-family: 'Fraunces', serif; font-size: 60px; font-weight: 700; color: ${rating.color}; line-height: 1; }
  .cv-r-label { font-size: 9px; color: rgba(255,255,255,.4); text-transform: uppercase; letter-spacing: .1em; margin-bottom: 5px; }
  .cv-r-title { font-size: 15px; font-weight: 600; }
  .cv-divider { height: 1px; background: rgba(255,255,255,.08); margin: 36px 0; position: relative; z-index: 1; }
  .cv-meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; position: relative; z-index: 1; }
  .cv-meta-lbl { font-size: 9px; color: rgba(255,255,255,.35); text-transform: uppercase; letter-spacing: .08em; margin-bottom: 5px; }
  .cv-meta-val { font-size: 13px; font-weight: 500; }
  .cv-footer { font-size: 9px; color: rgba(255,255,255,.2); position: relative; z-index: 1; margin-top: 40px; }

  /* PAGES */
  .page { width: 210mm; padding: 36px 44px 48px; page-break-after: always; position: relative; min-height: 297mm; display: flex; flex-direction: column; }
  .page:last-child { page-break-after: avoid; }
  .page-header { border-bottom: 2px solid ${colore}; padding-bottom: 10px; margin-bottom: 22px; display: flex; align-items: flex-end; justify-content: space-between; }
  .ph-eyebrow { font-size: 9px; font-weight: 700; color: ${colore}; text-transform: uppercase; letter-spacing: .12em; margin-bottom: 4px; }
  .ph-title { font-family: 'Fraunces', serif; font-size: 21px; font-weight: 700; color: #0F172A; }
  .ph-azienda { font-size: 10px; color: #64748B; text-align: right; line-height: 1.6; }
  .page-footer { display: flex; justify-content: space-between; font-size: 8px; color: #94A3B8; border-top: .5px solid #E2E8F0; padding-top: 8px; margin-top: auto; }

  /* KPI */
  .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
  .kpi-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 13px 11px; }
  .kpi-lbl { font-size: 8px; color: #64748B; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 5px; }
  .kpi-val { font-size: 17px; font-weight: 700; line-height: 1; }
  .pos { color: #059669; } .neg { color: #DC2626; } .neu { color: #1D4ED8; } .warn { color: #D97706; }

  /* NARRATIVE BOX */
  .narrative-box { background: #F0F9FF; border: 1px solid #BAE6FD; border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; }
  .narrative-title { font-size: 9px; font-weight: 700; color: #0369A1; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 7px; }
  .narrative-text { font-size: 10px; color: #0F172A; line-height: 1.75; }

  /* SEMAFORI */
  .sem-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
  .sem-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #F8FAFC; border-radius: 8px; border-left: 3px solid transparent; }
  .sem-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .sem-name { flex: 1; font-size: 10px; color: #475569; font-weight: 500; }
  .sem-val { font-size: 11px; font-weight: 700; }

  /* TABLES */
  table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 16px; }
  thead th { background: #0F172A; color: #fff; padding: 7px 9px; text-align: left; font-weight: 600; font-size: 9px; letter-spacing: .03em; }
  thead th.r { text-align: right; }
  tbody td { padding: 5px 9px; border-bottom: 0.5px solid #F1F5F9; }
  tbody td.r { text-align: right; font-variant-numeric: tabular-nums; }
  tbody tr.sub td { color: #64748B; padding-left: 20px; font-size: 9.5px; }
  tbody tr.tot td { background: #F8FAFC; font-weight: 700; }
  tbody tr.tot-main td { background: #0F172A; color: #fff; font-weight: 700; }
  tbody tr.ebitda-row td { background: #ECFDF5; font-weight: 700; color: #059669; }

  /* INDICI DETTAGLIATI */
  .ind-section { margin-bottom: 18px; }
  .ind-section-hd { font-size: 9.5px; font-weight: 700; color: #fff; background: ${colore}; padding: 6px 12px; border-radius: 6px 6px 0 0; text-transform: uppercase; letter-spacing: .08em; }
  .ind-cards { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 6px 6px; overflow: hidden; }
  .ind-card { padding: 13px; border-right: .5px solid #E2E8F0; border-bottom: .5px solid #E2E8F0; }
  .ind-card:nth-child(2n) { border-right: none; }
  .ind-card-name { font-size: 10px; font-weight: 700; color: #0F172A; margin-bottom: 2px; }
  .ind-card-acronym { font-size: 8.5px; color: #94A3B8; margin-bottom: 6px; }
  .ind-card-value { font-size: 22px; font-weight: 700; line-height: 1; margin-bottom: 4px; }
  .ind-badge { font-size: 8px; font-weight: 700; padding: 2px 7px; border-radius: 4px; display: inline-block; margin-bottom: 8px; }
  .ib-g { background: #ECFDF5; color: #059669; }
  .ib-r { background: #FEF2F2; color: #DC2626; }
  .ib-a { background: #FFFBEB; color: #D97706; }
  .ind-formula { font-size: 8px; color: #1D4ED8; background: #EFF6FF; border-radius: 3px; padding: 3px 7px; font-family: monospace; margin-bottom: 6px; display: inline-block; }
  .ind-bench { font-size: 8px; color: #64748B; margin-bottom: 5px; }
  .ind-bench span { font-weight: 600; color: #0F172A; }
  .ind-desc { font-size: 9px; color: #475569; line-height: 1.6; }
  .ind-interp { font-size: 9px; color: #475569; line-height: 1.6; margin-top: 5px; padding-top: 5px; border-top: .5px solid #F1F5F9; }
  .ind-full { grid-column: 1 / -1; }

  /* BANCABILITÀ */
  .banc-intro { font-size: 9.5px; color: #475569; line-height: 1.7; margin-bottom: 14px; padding: 10px 13px; background: #F8FAFC; border-left: 3px solid ${colore}; border-radius: 0 6px 6px 0; }
  .banc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
  .banc-box { border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px; }
  .banc-name { font-size: 10px; font-weight: 700; color: #0F172A; margin-bottom: 1px; }
  .banc-acronym { font-size: 8.5px; color: #94A3B8; margin-bottom: 4px; }
  .banc-formula { font-size: 8px; color: #1D4ED8; background: #EFF6FF; border-radius: 3px; padding: 2px 6px; font-family: monospace; margin-bottom: 7px; display: inline-block; }
  .banc-val { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  .banc-verdict { font-size: 8.5px; font-weight: 700; padding: 2px 8px; border-radius: 4px; display: inline-block; margin-bottom: 8px; }
  .bv-g { background: #ECFDF5; color: #059669; }
  .bv-a { background: #FFFBEB; color: #D97706; }
  .bv-r { background: #FEF2F2; color: #DC2626; }
  .bv-0 { background: #F8FAFC; color: #64748B; }
  .bar-track { height: 4px; background: #F1F5F9; border-radius: 3px; overflow: hidden; margin-bottom: 8px; }
  .bar-fill { height: 100%; border-radius: 3px; }
  .banc-desc-text { font-size: 9px; color: #475569; line-height: 1.6; margin-top: 7px; padding-top: 7px; border-top: .5px solid #F1F5F9; }

  /* RF */
  .rf-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px; margin-bottom: 10px; }
  .rf-title { font-size: 9px; font-weight: 700; color: ${colore}; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 8px; }
  .rf-row { display: flex; justify-content: space-between; font-size: 10px; padding: 3px 0; border-bottom: .5px solid #E2E8F0; }
  .rf-row:last-child { border: none; }
  .rf-lbl { color: #64748B; }
  .rf-tot { display: flex; justify-content: space-between; background: #0F172A; color: #fff; border-radius: 7px; padding: 9px 12px; margin-top: 7px; font-weight: 700; font-size: 11px; }
  .rf-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
  .rf-kpi { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 11px; }
  .rf-kpi-lbl { font-size: 9px; color: #64748B; text-transform: uppercase; margin-bottom: 4px; }
  .rf-kpi-val { font-size: 18px; font-weight: 700; }

  /* RATING PAGE */
  .rating-center { text-align: center; padding: 24px 20px 18px; }
  .r-letter { font-family: 'Fraunces', serif; font-size: 90px; font-weight: 700; color: ${rating.color}; line-height: 1; }
  .r-title { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 700; color: #0F172A; margin: 8px 0 6px; }
  .r-desc { font-size: 11.5px; color: #475569; max-width: 400px; margin: 0 auto; line-height: 1.75; }

  /* RATING SCALE */
  .rating-scale { display: flex; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; margin: 14px 0; }
  .rs-item { flex: 1; text-align: center; padding: 7px 3px; }
  .rs-letter { font-family: 'Fraunces', serif; font-size: 16px; font-weight: 700; line-height: 1; margin-bottom: 2px; }
  .rs-lbl { font-size: 7.5px; color: #64748B; }
  .rs-active { background: #0F172A; }
  .rs-active .rs-letter { color: ${rating.color}; }
  .rs-active .rs-lbl { color: rgba(255,255,255,.6); }

  /* SCORECARD RATING */
  .score-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; background: #0F172A; border-radius: 8px 8px 0 0; }
  .score-grid div { padding: 7px 9px; color: #fff; font-size: 8.5px; font-weight: 700; text-align: right; }
  .score-grid div:first-child { text-align: left; }
  .score-row { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; border-bottom: .5px solid #F1F5F9; }
  .score-row div { padding: 5px 9px; font-size: 9.5px; text-align: right; font-variant-numeric: tabular-nums; }
  .score-row div:first-child { text-align: left; color: #475569; font-weight: 500; }
  .score-row.hi div { background: #F8FAFC; font-weight: 700; }
  .score-table { border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; margin-bottom: 14px; }

  /* ZSCORE BOX */
  .zscore-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px; margin-bottom: 14px; }
  .zscore-title { font-size: 9px; font-weight: 700; color: #0F172A; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 8px; }
  .zscore-val { font-size: 28px; font-weight: 700; font-family: 'Fraunces', serif; }
  .zscore-label { font-size: 10px; font-weight: 600; margin-top: 3px; }
  .zscore-desc { font-size: 9px; color: #64748B; line-height: 1.6; margin-top: 6px; }

  /* TRIGGERS */
  .trigger-box { border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; }
  .trigger-box.ok { background: #ECFDF5; border: 1px solid #A7F3D0; }
  .trigger-box.warn { background: #FFFBEB; border: 1px solid #FDE68A; }
  .trigger-box.alert { background: #FEF2F2; border: 1px solid #FECACA; }
  .trigger-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 7px; }
  .trigger-item { font-size: 9.5px; padding: 3px 0; border-bottom: .5px solid rgba(0,0,0,.06); }
  .trigger-item:last-child { border: none; }

  /* GLOSSARIO */
  .gloss-section { margin-bottom: 16px; }
  .gloss-hd { font-size: 9.5px; font-weight: 700; color: #fff; background: #0F172A; padding: 6px 12px; border-radius: 6px 6px 0 0; text-transform: uppercase; letter-spacing: .08em; }
  .gloss-items { border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 6px 6px; }
  .gloss-item { padding: 10px 12px; border-bottom: .5px solid #F1F5F9; }
  .gloss-item:last-child { border: none; }
  .gloss-name { font-size: 10px; font-weight: 700; color: ${colore}; display: inline; }
  .gloss-full { font-size: 9px; color: #64748B; display: inline; margin-left: 6px; }
  .gloss-text { font-size: 9px; color: #475569; line-height: 1.65; margin-top: 3px; }

  /* NOTE/DISCLAIMER */
  .note-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px; margin-bottom: 12px; }
  .note-title { font-size: 9px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 7px; }
  .note-text { font-size: 10px; color: #334155; line-height: 1.8; }
  .disclaimer { font-size: 8px; color: #94A3B8; line-height: 1.6; border-top: 1px solid #F1F5F9; padding-top: 10px; margin-top: 10px; }
</style>
</head>
<body>

<!-- ══ COPERTINA ══ -->
<div class="cover">
  <div style="position:relative;z-index:1;">
    <div class="cv-branding">AnalisiEBusinessPlan.it — Software professionale di analisi bilancio</div>
    <div class="cv-tipo">Analisi di Bilancio d'Esercizio</div>
    <div class="cv-nome">${nome}</div>
    <div class="cv-sub">Esercizio chiuso al 31/12/${anno}</div>
    <div class="cv-rating-chip">
      <div class="cv-r-letter">${rating.l}</div>
      <div>
        <div class="cv-r-label">Rating sintetico di bancabilità</div>
        <div class="cv-r-title">${rating.title}</div>
      </div>
    </div>
  </div>
  <div style="position:relative;z-index:1;">
    <div class="cv-divider"></div>
    <div class="cv-meta">
      <div><div class="cv-meta-lbl">Esercizio</div><div class="cv-meta-val">${anno}</div></div>
      <div><div class="cv-meta-lbl">Analista</div><div class="cv-meta-val">${analista}</div></div>
      <div><div class="cv-meta-lbl">Data report</div><div class="cv-meta-val">${dataReport}</div></div>
    </div>
    <div class="cv-footer">Documento riservato — generato da AnalisiEBusinessPlan.it — uso professionale · Rating calcolato secondo EBA/GL/2020/06 e modello Z'-Score Altman PMI</div>
  </div>
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
    <div class="kpi-box"><div class="kpi-lbl">PFN</div><div class="kpi-val ${c.pfn <= 0 ? 'pos' : 'warn'}">${fmt(c.pfn)}</div></div>
    <div class="kpi-box"><div class="kpi-lbl">EBITDA margin</div><div class="kpi-val ${c.ebitda_pct >= 15 ? 'pos' : c.ebitda_pct >= 5 ? 'warn' : 'neg'}">${fp(c.ebitda_pct)}</div></div>
    <div class="kpi-box"><div class="kpi-lbl">Autonomia fin.</div><div class="kpi-val ${c.aut >= 30 ? 'pos' : c.aut >= 15 ? 'warn' : 'neg'}">${fp(c.aut)}</div></div>
  </div>
  ${narrative ? `<div class="narrative-box"><div class="narrative-title">📋 Commento sintetico</div><div class="narrative-text">${narrative}</div></div>` : ''}
  <div class="sem-list">
    <div class="sem-item" style="border-left-color:${semColor(c.cr,1.5,1.0)}">
      <div class="sem-dot" style="background:${semColor(c.cr,1.5,1.0)}"></div>
      <span class="sem-name">Liquidità aziendale (Current Ratio)</span>
      <span class="sem-val" style="color:${semColor(c.cr,1.5,1.0)}">${fx(c.cr)}</span>
    </div>
    <div class="sem-item" style="border-left-color:${semColor(c.roe,10,5)}">
      <div class="sem-dot" style="background:${semColor(c.roe,10,5)}"></div>
      <span class="sem-name">Redditività del capitale proprio (ROE)</span>
      <span class="sem-val" style="color:${semColor(c.roe,10,5)}">${fp(c.roe)}</span>
    </div>
    <div class="sem-item" style="border-left-color:${semColor(c.aut,30,15)}">
      <div class="sem-dot" style="background:${semColor(c.aut,30,15)}"></div>
      <span class="sem-name">Solidità patrimoniale (Autonomia finanziaria)</span>
      <span class="sem-val" style="color:${semColor(c.aut,30,15)}">${fp(c.aut)}</span>
    </div>
    <div class="sem-item" style="border-left-color:${semColor(c.leva,2,4,false)}">
      <div class="sem-dot" style="background:${semColor(c.leva,2,4,false)}"></div>
      <span class="sem-name">Indebitamento (Leva D/E)</span>
      <span class="sem-val" style="color:${semColor(c.leva,2,4,false)}">${fx(c.leva)}</span>
    </div>
    <div class="sem-item" style="border-left-color:${semColor(c.dscr,1.25,1.0)}">
      <div class="sem-dot" style="background:${semColor(c.dscr,1.25,1.0)}"></div>
      <span class="sem-name">Bancabilità (DSCR)</span>
      <span class="sem-val" style="color:${semColor(c.dscr,1.25,1.0)}">${isNaN(c.dscr)?'n.d.':fx(c.dscr)}</span>
    </div>
    <div class="sem-item" style="border-left-color:${semColor(c.roi,8,3)}">
      <div class="sem-dot" style="background:${semColor(c.roi,8,3)}"></div>
      <span class="sem-name">Redditività operativa (ROI)</span>
      <span class="sem-val" style="color:${semColor(c.roi,8,3)}">${fp(c.roi)}</span>
    </div>
  </div>
  <div class="page-footer"><span>AnalisiEBusinessPlan.it</span><span>${nome} — Bilancio ${anno}</span><span>Pag. 2</span></div>
</div>

<!-- ══ PAG 3: STATO PATRIMONIALE ══ -->
<div class="page">
  <div class="page-header">
    <div><div class="ph-eyebrow">Sezione 2</div><div class="ph-title">Stato Patrimoniale Riclassificato</div></div>
    <div class="ph-azienda">${nome}<br/>${anno}${d1?` vs ${annoPrev}`:''}</div>
  </div>
  <table>
    <thead><tr><th>Voce</th><th class="r">${anno}</th>${d1?`<th class="r">${annoPrev}</th><th class="r">Var %</th>`:''}</tr></thead>
    <tbody>
      <tr class="tot"><td>B) Immobilizzazioni</td><td class="r">${fmt(d.tot_imm)}</td>${d1?`<td class="r">${fmt(d1.tot_imm)}</td><td class="r ${varClass(d.tot_imm,d1.tot_imm)}">${varPct(d.tot_imm,d1.tot_imm)}</td>`:''}</tr>
      <tr class="sub"><td>Immobilizzazioni immateriali</td><td class="r">${fmt(d.imm_imm)}</td>${d1?`<td class="r">${fmt(d1.imm_imm)}</td><td class="r"></td>`:''}</tr>
      <tr class="sub"><td>Immobilizzazioni materiali</td><td class="r">${fmt(d.imm_mat)}</td>${d1?`<td class="r">${fmt(d1.imm_mat)}</td><td class="r"></td>`:''}</tr>
      <tr class="sub"><td>Immobilizzazioni finanziarie</td><td class="r">${fmt(d.imm_fin)}</td>${d1?`<td class="r">${fmt(d1.imm_fin)}</td><td class="r"></td>`:''}</tr>
      <tr class="tot"><td>C) Attivo circolante</td><td class="r">${fmt(d.tot_circ)}</td>${d1?`<td class="r">${fmt(d1.tot_circ)}</td><td class="r ${varClass(d.tot_circ,d1.tot_circ)}">${varPct(d.tot_circ,d1.tot_circ)}</td>`:''}</tr>
      <tr class="sub"><td>Rimanenze</td><td class="r">${fmt(d.rimanenze)}</td>${d1?`<td class="r">${fmt(d1.rimanenze)}</td><td class="r"></td>`:''}</tr>
      <tr class="sub"><td>Crediti verso clienti</td><td class="r">${fmt(d.cred_cl)}</td>${d1?`<td class="r">${fmt(d1.cred_cl)}</td><td class="r"></td>`:''}</tr>
      <tr class="sub"><td>Disponibilità liquide</td><td class="r">${fmt(d.liquidita)}</td>${d1?`<td class="r">${fmt(d1.liquidita)}</td><td class="r"></td>`:''}</tr>
      <tr class="tot-main"><td>TOTALE ATTIVO</td><td class="r">${fmt(d.tot_att)}</td>${d1?`<td class="r">${fmt(d1.tot_att)}</td><td class="r ${varClass(d.tot_att,d1.tot_att)}">${varPct(d.tot_att,d1.tot_att)}</td>`:''}</tr>
      <tr class="tot"><td>A) Patrimonio netto</td><td class="r">${fmt(d.tot_pn)}</td>${d1?`<td class="r">${fmt(d1.tot_pn)}</td><td class="r ${varClass(d.tot_pn,d1.tot_pn)}">${varPct(d.tot_pn,d1.tot_pn)}</td>`:''}</tr>
      <tr class="sub"><td>Capitale sociale</td><td class="r">${fmt(d.cap_sociale)}</td>${d1?`<td class="r">${fmt(d1.cap_sociale)}</td><td class="r"></td>`:''}</tr>
      <tr class="sub"><td>Utile / Perdita esercizio</td><td class="r ${(d.utile_es||0)>=0?'pos':'neg'}">${fmt(d.utile_es)}</td>${d1?`<td class="r ${(d1.utile_es||0)>=0?'pos':'neg'}">${fmt(d1.utile_es)}</td><td class="r"></td>`:''}</tr>
      <tr class="tot"><td>D) Debiti totali</td><td class="r">${fmt(d.tot_deb)}</td>${d1?`<td class="r">${fmt(d1.tot_deb)}</td><td class="r ${varClass(d.tot_deb,d1.tot_deb,true)}">${varPct(d.tot_deb,d1.tot_deb)}</td>`:''}</tr>
      <tr class="sub"><td>Debiti verso banche (bt+lt)</td><td class="r">${fmt((d.deb_b_bt||0)+(d.deb_b_lt||0))}</td>${d1?`<td class="r">${fmt((d1.deb_b_bt||0)+(d1.deb_b_lt||0))}</td><td class="r"></td>`:''}</tr>
      <tr class="sub"><td>Debiti verso fornitori</td><td class="r">${fmt(d.deb_for)}</td>${d1?`<td class="r">${fmt(d1.deb_for)}</td><td class="r"></td>`:''}</tr>
      <tr class="tot-main"><td>TOTALE PASSIVO</td><td class="r">${fmt(d.tot_att)}</td>${d1?`<td class="r">${fmt(d1.tot_att)}</td><td class="r"></td>`:''}</tr>
    </tbody>
  </table>
  <div class="page-footer"><span>AnalisiEBusinessPlan.it</span><span>${nome} — Bilancio ${anno}</span><span>Pag. 3</span></div>
</div>

<!-- ══ PAG 4: CONTO ECONOMICO ══ -->
<div class="page">
  <div class="page-header">
    <div><div class="ph-eyebrow">Sezione 3</div><div class="ph-title">Conto Economico Riclassificato</div></div>
    <div class="ph-azienda">${nome}<br/>${anno}${d1?` vs ${annoPrev}`:''}</div>
  </div>
  <table>
    <thead><tr><th>Voce</th><th class="r">${anno}</th>${d1?`<th class="r">${annoPrev}</th><th class="r">Var %</th>`:''}</tr></thead>
    <tbody>
      <tr class="tot"><td>A) Valore della produzione</td><td class="r">${fmt(d.tot_vp)}</td>${d1?`<td class="r">${fmt(d1.tot_vp)}</td><td class="r ${varClass(d.tot_vp,d1.tot_vp)}">${varPct(d.tot_vp,d1.tot_vp)}</td>`:''}</tr>
      <tr class="sub"><td>1) Ricavi delle vendite</td><td class="r">${fmt(d.ric_vend)}</td>${d1?`<td class="r">${fmt(d1.ric_vend)}</td><td class="r ${varClass(d.ric_vend,d1.ric_vend)}">${varPct(d.ric_vend,d1.ric_vend)}</td>`:''}</tr>
      <tr class="sub"><td>5) Altri ricavi e proventi</td><td class="r">${fmt(d.alt_ric)}</td>${d1?`<td class="r">${fmt(d1.alt_ric)}</td><td class="r"></td>`:''}</tr>
      <tr class="tot"><td>B) Costi della produzione</td><td class="r">${fmt(d.tot_cos)}</td>${d1?`<td class="r">${fmt(d1.tot_cos)}</td><td class="r ${varClass(d.tot_cos,d1.tot_cos,true)}">${varPct(d.tot_cos,d1.tot_cos)}</td>`:''}</tr>
      <tr class="sub"><td>6) Materie prime e merci</td><td class="r">${fmt(d.mat_prime)}</td>${d1?`<td class="r">${fmt(d1.mat_prime)}</td><td class="r"></td>`:''}</tr>
      <tr class="sub"><td>7) Per servizi</td><td class="r">${fmt(d.servizi)}</td>${d1?`<td class="r">${fmt(d1.servizi)}</td><td class="r"></td>`:''}</tr>
      <tr class="sub"><td>9) Per il personale</td><td class="r">${fmt(d.personale)}</td>${d1?`<td class="r">${fmt(d1.personale)}</td><td class="r"></td>`:''}</tr>
      <tr class="sub"><td>10) Ammortamenti e svalutazioni</td><td class="r">${fmt(d.ammort)}</td>${d1?`<td class="r">${fmt(d1.ammort)}</td><td class="r"></td>`:''}</tr>
      <tr class="ebitda-row"><td><strong>EBITDA — Margine operativo lordo</strong></td><td class="r">${fmt(c.ebitda)}</td>${d1?`<td class="r">${fmt(c1.ebitda)}</td><td class="r ${varClass(c.ebitda,c1.ebitda)}">${varPct(c.ebitda,c1.ebitda)}</td>`:''}</tr>
      <tr class="sub"><td>EBITDA margin (%)</td><td class="r">${fp(c.ebitda_pct)}</td>${d1?`<td class="r">${fp(c1.ebitda_pct)}</td><td class="r"></td>`:''}</tr>
      <tr><td>EBIT — Risultato operativo</td><td class="r ${c.ebit>=0?'pos':'neg'}">${fmt(c.ebit)}</td>${d1?`<td class="r ${c1.ebit>=0?'pos':'neg'}">${fmt(c1.ebit)}</td><td class="r ${varClass(c.ebit,c1.ebit)}">${varPct(c.ebit,c1.ebit)}</td>`:''}</tr>
      <tr><td>C) Oneri finanziari netti</td><td class="r neg">−${fmt(d.oneri_f)}</td>${d1?`<td class="r neg">−${fmt(d1.oneri_f)}</td><td class="r"></td>`:''}</tr>
      <tr><td>20) Imposte (IRES + IRAP)</td><td class="r neg">−${fmt(d.imposte)}</td>${d1?`<td class="r neg">−${fmt(d1.imposte)}</td><td class="r"></td>`:''}</tr>
      <tr class="tot-main"><td>UTILE / PERDITA NETTO</td><td class="r ${(d.utile_es||0)>=0?'pos':'neg'}">${fmt(d.utile_es)}</td>${d1?`<td class="r ${(d1.utile_es||0)>=0?'pos':'neg'}">${fmt(d1.utile_es)}</td><td class="r ${varClass(d.utile_es,d1.utile_es)}">${varPct(d.utile_es,d1.utile_es)}</td>`:''}</tr>
    </tbody>
  </table>
  <div class="page-footer"><span>AnalisiEBusinessPlan.it</span><span>${nome} — Bilancio ${anno}</span><span>Pag. 4</span></div>
</div>

<!-- ══ PAG 5: INDICI DETTAGLIATI — REDDITIVITÀ + LIQUIDITÀ ══ -->
<div class="page">
  <div class="page-header">
    <div><div class="ph-eyebrow">Sezione 4</div><div class="ph-title">Indici di Bilancio — Redditività e Liquidità</div></div>
    <div class="ph-azienda">${nome}<br/>${anno}</div>
  </div>

  <div class="ind-section">
    <div class="ind-section-hd">📊 Indici di Redditività</div>
    <div class="ind-cards">
      <div class="ind-card">
        <div class="ind-card-name">Return on Equity</div><div class="ind-card-acronym">ROE</div>
        <div class="ind-card-value" style="color:${semColor(c.roe,10,5)}">${fp(c.roe)}</div>
        <span class="ind-badge ${c.roe>=10?'ib-g':c.roe>=5?'ib-a':'ib-r'}">${c.roe>=10?'✓ Ottimo':c.roe>=5?'⚠ Sufficiente':'✗ Sotto soglia'}</span>
        <div class="ind-formula">ROE = Utile Netto / Patrimonio Netto × 100</div>
        <div class="ind-bench">Soglia minima: <span>&gt; 5%</span> &nbsp;|&nbsp; Ottimale: <span>&gt; 10%</span></div>
        <div class="ind-desc">Misura la <strong>redditività del capitale proprio</strong>: quanti euro di utile genera ogni 100€ investiti dai soci. È l'indicatore principale dal punto di vista dell'azionista.</div>
        <div class="ind-interp">${isNaN(c.roe)?'Dato non disponibile.':c.roe>=10?`Valore eccellente: i soci ottengono un rendimento del ${fp(c.roe)} sul capitale investito.`:c.roe>=5?`Valore sufficiente (${fp(c.roe)}), nella media delle PMI italiane.`:c.roe>=0?`Valore basso (${fp(c.roe)}): rendimento insufficiente per i soci.`:`ROE negativo (${fp(c.roe)}): perdita d'esercizio. Verificare se straordinaria o strutturale.`}</div>
      </div>
      <div class="ind-card">
        <div class="ind-card-name">Return on Investment</div><div class="ind-card-acronym">ROI</div>
        <div class="ind-card-value" style="color:${semColor(c.roi,8,3)}">${fp(c.roi)}</div>
        <span class="ind-badge ${c.roi>=8?'ib-g':c.roi>=3?'ib-a':'ib-r'}">${c.roi>=8?'✓ Eccellente':c.roi>=3?'⚠ Sufficiente':'✗ Sotto soglia'}</span>
        <div class="ind-formula">ROI = EBIT / Totale Attivo × 100</div>
        <div class="ind-bench">Soglia minima: <span>&gt; 3%</span> &nbsp;|&nbsp; Ottimale: <span>&gt; 8%</span></div>
        <div class="ind-desc">Misura la <strong>redditività del capitale investito totale</strong>, indipendente dalla struttura finanziaria. Indica l'efficienza gestionale del management nell'utilizzo delle risorse aziendali.</div>
        <div class="ind-interp">${isNaN(c.roi)?'Dato non disponibile.':c.roi>=8?`Ottimo: ogni 100€ investiti generano ${fp(c.roi)} di reddito operativo. L'effetto leva è positivo.`:c.roi>=3?`Sufficiente (${fp(c.roi)}). Margine di miglioramento possibile sull'efficienza operativa.`:`ROI insufficiente (${fp(c.roi)}): l'azienda non remunera adeguatamente il capitale investito.`}</div>
      </div>
      <div class="ind-card">
        <div class="ind-card-name">Return on Sales</div><div class="ind-card-acronym">ROS</div>
        <div class="ind-card-value" style="color:${semColor(c.ros,10,3)}">${fp(c.ros)}</div>
        <span class="ind-badge ${c.ros>=10?'ib-g':c.ros>=3?'ib-a':'ib-r'}">${c.ros>=10?'✓ Ottimo':c.ros>=3?'⚠ Sufficiente':'✗ Basso'}</span>
        <div class="ind-formula">ROS = EBIT / Ricavi di Vendita × 100</div>
        <div class="ind-bench">Soglia minima: <span>&gt; 3%</span> &nbsp;|&nbsp; Ottimale: <span>&gt; 10%</span></div>
        <div class="ind-desc">Misura la <strong>marginalità operativa sulle vendite</strong>: quanta parte di ogni euro di fatturato diventa reddito operativo, dopo aver coperto tutti i costi operativi.</div>
        <div class="ind-interp">${isNaN(c.ros)?'Dato non disponibile.':c.ros>=10?`Eccellente (${fp(c.ros)}): alta capacità di trasformare i ricavi in reddito operativo.`:c.ros>=3?`Nella norma (${fp(c.ros)}): marginalità accettabile ma da migliorare.`:`Basso (${fp(c.ros)}): struttura dei costi da rivedere o prezzi da ottimizzare.`}</div>
      </div>
      <div class="ind-card">
        <div class="ind-card-name">EBITDA Margin</div><div class="ind-card-acronym">Margine Operativo Lordo %</div>
        <div class="ind-card-value" style="color:${semColor(c.ebitda_pct,15,5)}">${fp(c.ebitda_pct)}</div>
        <span class="ind-badge ${c.ebitda_pct>=15?'ib-g':c.ebitda_pct>=5?'ib-a':'ib-r'}">${c.ebitda_pct>=15?'✓ Eccellente':c.ebitda_pct>=5?'⚠ Sufficiente':'✗ Basso'}</span>
        <div class="ind-formula">EBITDA Margin = EBITDA / Valore Produzione × 100</div>
        <div class="ind-bench">Soglia minima: <span>&gt; 5%</span> &nbsp;|&nbsp; Ottimale: <span>&gt; 15%</span></div>
        <div class="ind-desc">Proxy della <strong>capacità di generare cassa operativa</strong>. Non influenzato da ammortamenti, oneri finanziari o imposte. È l'indicatore preferito da banche e investitori per valutare la qualità del business model.</div>
        <div class="ind-interp">${isNaN(c.ebitda_pct)?'Dato non disponibile.':c.ebitda_pct>=15?`Eccellente (${fp(c.ebitda_pct)}): il business genera cassa abbondante per servire il debito e investire.`:c.ebitda_pct>=5?`Sufficiente (${fp(c.ebitda_pct)}): margine accettabile ma limitato rispetto agli impegni finanziari.`:`Critico (${fp(c.ebitda_pct)}): l'azienda stenta a generare cassa operativa sufficiente.`}</div>
      </div>
    </div>
  </div>

  <div class="ind-section">
    <div class="ind-section-hd">💧 Indici di Liquidità</div>
    <div class="ind-cards">
      <div class="ind-card">
        <div class="ind-card-name">Current Ratio</div><div class="ind-card-acronym">Indice di liquidità corrente</div>
        <div class="ind-card-value" style="color:${semColor(c.cr,1.5,1.0)}">${fx(c.cr)}</div>
        <span class="ind-badge ${c.cr>=1.5?'ib-g':c.cr>=1.0?'ib-a':'ib-r'}">${c.cr>=1.5?'✓ Ottimo':c.cr>=1.0?'⚠ Sufficiente':'✗ Critico'}</span>
        <div class="ind-formula">Current Ratio = Attivo Circolante / Passività a Breve</div>
        <div class="ind-bench">Soglia critica: <span>&lt; 1,0x</span> &nbsp;|&nbsp; Ottimale: <span>&gt; 1,5x</span></div>
        <div class="ind-desc">Misura la <strong>capacità di far fronte agli impegni a breve termine</strong> con le risorse circolanti. Valore &lt;1 indica che le passività a breve superano le attività correnti: segnale di allerta EBA (Stage 2).</div>
        <div class="ind-interp">${isNaN(c.cr)?'Dato non disponibile.':c.cr>=1.5?`Ottimale (${fx(c.cr)}): ampi margini di liquidità. Nessun rischio di tensioni a breve.`:c.cr>=1.0?`Sufficiente ma da monitorare (${fx(c.cr)}): il margine è limitato.`:`Critico (${fx(c.cr)}): le passività a breve superano l'attivo circolante.`}</div>
      </div>
      <div class="ind-card">
        <div class="ind-card-name">Acid Test (Quick Ratio)</div><div class="ind-card-acronym">Indice di liquidità immediata</div>
        <div class="ind-card-value" style="color:${semColor(c.acid,1.0,0.7)}">${fx(c.acid)}</div>
        <span class="ind-badge ${c.acid>=1.0?'ib-g':c.acid>=0.7?'ib-a':'ib-r'}">${c.acid>=1.0?'✓ Ottimo':c.acid>=0.7?'⚠ Sufficiente':'✗ Basso'}</span>
        <div class="ind-formula">Acid Test = (Att. Circ. − Rimanenze) / Passività a Breve</div>
        <div class="ind-bench">Soglia critica: <span>&lt; 0,7x</span> &nbsp;|&nbsp; Ottimale: <span>&gt; 1,0x</span></div>
        <div class="ind-desc">Versione <strong>più conservativa del Current Ratio</strong>: esclude le rimanenze (meno liquide, devono prima essere vendute). Misura la capacità di far fronte ai debiti a breve solo con attività prontamente liquidabili.</div>
        <div class="ind-interp">${isNaN(c.acid)?'Dato non disponibile.':c.acid>=1.0?`Ottimale (${fx(c.acid)}): anche senza smobilizzare il magazzino, la liquidità è adeguata.`:c.acid>=0.7?`Accettabile (${fx(c.acid)}): le rimanenze pesano sulla liquidità immediata.`:`Basso (${fx(c.acid)}): dipendenza elevata dalla vendita del magazzino per onorare i debiti a breve.`}</div>
      </div>
    </div>
  </div>

  <div class="page-footer"><span>AnalisiEBusinessPlan.it</span><span>${nome} — Bilancio ${anno}</span><span>Pag. 5</span></div>
</div>

<!-- ══ PAG 6: INDICI — SOLIDITÀ + EFFICIENZA ══ -->
<div class="page">
  <div class="page-header">
    <div><div class="ph-eyebrow">Sezione 4 (continua)</div><div class="ph-title">Indici di Bilancio — Solidità ed Efficienza</div></div>
    <div class="ph-azienda">${nome}<br/>${anno}</div>
  </div>

  <div class="ind-section">
    <div class="ind-section-hd">🏛️ Indici di Solidità Patrimoniale</div>
    <div class="ind-cards">
      <div class="ind-card">
        <div class="ind-card-name">Autonomia Finanziaria</div><div class="ind-card-acronym">Equity Ratio</div>
        <div class="ind-card-value" style="color:${semColor(c.aut,30,15)}">${fp(c.aut)}</div>
        <span class="ind-badge ${c.aut>=30?'ib-g':c.aut>=15?'ib-a':'ib-r'}">${c.aut>=30?'✓ Ottimo EBA':c.aut>=15?'⚠ Sufficiente':'✗ Sotto soglia'}</span>
        <div class="ind-formula">Autonomia Fin. = Patrimonio Netto / Totale Attivo × 100</div>
        <div class="ind-bench">Soglia EBA: <span>&gt; 30%</span> &nbsp;|&nbsp; Ottimale: <span>&gt; 40%</span></div>
        <div class="ind-desc">Misura la quota degli impieghi <strong>finanziata con capitale proprio</strong>. È uno degli indicatori cardine nelle valutazioni EBA: esprime il grado di indipendenza dai creditori e la capacità di assorbire perdite senza insolvenza.</div>
        <div class="ind-interp">${isNaN(c.aut)?'Dato non disponibile.':c.aut>=40?`Eccellente (${fp(c.aut)}): struttura patrimoniale robusta, ampiamente sopra la soglia EBA del 30%.`:c.aut>=30?`Sufficiente (${fp(c.aut)}): soddisfa le soglie EBA minime ma con margine limitato.`:`Sotto soglia EBA (${fp(c.aut)}): struttura patrimoniale debole. Necessario rafforzare il patrimonio.`}</div>
      </div>
      <div class="ind-card">
        <div class="ind-card-name">Leva Finanziaria</div><div class="ind-card-acronym">D/E Ratio — Debt to Equity</div>
        <div class="ind-card-value" style="color:${semColor(c.leva,2,4,false)}">${fx(c.leva)}</div>
        <span class="ind-badge ${c.leva<=2?'ib-g':c.leva<=4?'ib-a':'ib-r'}">${c.leva<=2?'✓ Conservativo':c.leva<=4?'⚠ Moderato':'✗ Elevato'}</span>
        <div class="ind-formula">Leva D/E = Totale Debiti / Patrimonio Netto</div>
        <div class="ind-bench">Soglia attenzione: <span>&gt; 2,0x</span> &nbsp;|&nbsp; Critico: <span>&gt; 4,0x</span></div>
        <div class="ind-desc">Misura il rapporto tra <strong>capitale di terzi e capitale proprio</strong>. Un valore elevato indica dipendenza dal debito (leveraged). Amplifica sia i rendimenti che i rischi. La banca lo usa per stimare il rischio di default in caso di contrazione dei flussi.</div>
        <div class="ind-interp">${isNaN(c.leva)?'Dato non disponibile.':c.leva<=2?`Struttura conservativa (${fx(c.leva)}): ampi margini per ricorrere a nuova finanza.`:c.leva<=4?`Moderatamente elevato (${fx(c.leva)}): da monitorare. Limitare ulteriore indebitamento.`:`Elevato (${fx(c.leva)}): struttura finanziaria rischiosa. Ridurre il debito è prioritario.`}</div>
      </div>
    </div>
  </div>

  <div class="ind-section">
    <div class="ind-section-hd">⚙️ Indici di Efficienza Operativa — Ciclo del Circolante</div>
    <div class="ind-cards">
      <div class="ind-card">
        <div class="ind-card-name">Rotazione Rimanenze (DSI)</div><div class="ind-card-acronym">Days Sales in Inventory</div>
        <div class="ind-card-value" style="color:${isNaN(c.dsi)?'#94A3B8':c.dsi<=60?'#059669':c.dsi<=90?'#D97706':'#DC2626'}">${fgg(c.dsi)}</div>
        <span class="ind-badge ${isNaN(c.dsi)?'ib-a':c.dsi<=60?'ib-g':c.dsi<=90?'ib-a':'ib-r'}">${isNaN(c.dsi)?'n.d.':c.dsi<=60?'✓ Buono':c.dsi<=90?'⚠ Nella norma':'✗ Elevato'}</span>
        <div class="ind-formula">DSI = (Rimanenze / Costo del Venduto) × 365</div>
        <div class="ind-bench">Manifattura: <span>45–90 gg</span> &nbsp;|&nbsp; Commercio: <span>30–60 gg</span></div>
        <div class="ind-desc">Misura ogni quanti giorni il <strong>magazzino viene rinnovato</strong>. Alta rotazione = efficienza e riduzione del rischio obsolescenza. Bassa rotazione = capitale immobilizzato in scorte.</div>
        <div class="ind-interp">${isNaN(c.dsi)?'Inserire rimanenze e costo del venduto per calcolare.':c.dsi<=60?`Buona rotazione (${fgg(c.dsi)}): il magazzino è gestito in modo efficiente.`:c.dsi<=90?`Nella norma (${fgg(c.dsi)}): monitorare la rotazione e valutare ottimizzazioni.`:`Elevato (${fgg(c.dsi)}): magazzino lento. Liberare liquidità riducendo le scorte è prioritario.`}</div>
      </div>
      <div class="ind-card">
        <div class="ind-card-name">Giorni Credito Clienti (DSO)</div><div class="ind-card-acronym">Days Sales Outstanding</div>
        <div class="ind-card-value" style="color:${isNaN(c.dso)?'#94A3B8':c.dso<=60?'#059669':c.dso<=90?'#D97706':'#DC2626'}">${fgg(c.dso)}</div>
        <span class="ind-badge ${isNaN(c.dso)?'ib-a':c.dso<=60?'ib-g':c.dso<=90?'ib-a':'ib-r'}">${isNaN(c.dso)?'n.d.':c.dso<=60?'✓ Buono':c.dso<=90?'⚠ Nella norma':'✗ Elevato'}</span>
        <div class="ind-formula">DSO = (Crediti Clienti / Ricavi) × 365</div>
        <div class="ind-bench">Ottimale: <span>&lt; 60 gg</span> &nbsp;|&nbsp; Media Italia PMI: <span>75–90 gg</span></div>
        <div class="ind-desc">Misura il <strong>tempo medio tra vendita e incasso</strong>. Più è alto, più capitale è "congelato" nei crediti commerciali. In Italia tendenzialmente più elevato che nel resto d'Europa.</div>
        <div class="ind-interp">${isNaN(c.dso)?'Inserire crediti clienti e ricavi per calcolare.':c.dso<=60?`Ottimo (${fgg(c.dso)}): incasso rapido, basso fabbisogno di circolante.`:c.dso<=90?`Nella norma italiana (${fgg(c.dso)}): valutare politiche di credit management più stringenti.`:`Elevato (${fgg(c.dso)}): potenziali difficoltà di incasso o termini troppo favorevoli ai clienti.`}</div>
      </div>
      <div class="ind-card ind-full">
        <div class="ind-card-name">Giorni Debito Fornitori (DPO)</div><div class="ind-card-acronym">Days Payable Outstanding — Ciclo CCN: ${fgg(c.ccn_giorni)}</div>
        <div class="ind-card-value" style="color:${isNaN(c.dpo)?'#94A3B8':c.dpo>=60?'#059669':c.dpo>=30?'#D97706':'#DC2626'}">${fgg(c.dpo)}</div>
        <span class="ind-badge ${isNaN(c.dpo)?'ib-a':c.dpo>=60?'ib-g':c.dpo>=30?'ib-a':'ib-r'}">${isNaN(c.dpo)?'n.d.':c.dpo>=60?'✓ Ottimale':c.dpo>=30?'⚠ Sufficiente':'✗ Basso'}</span>
        <div class="ind-formula">DPO = (Debiti Fornitori / Acquisti) × 365 &nbsp;|&nbsp; Ciclo CCN = DSI + DSO − DPO</div>
        <div class="ind-bench">Ottimale: <span>60–90 gg</span> &nbsp;|&nbsp; Ciclo CCN ottimale: <span>&lt; 60 gg</span></div>
        <div class="ind-desc">Misura ogni quanti giorni l'azienda paga i fornitori. Un DPO elevato massimizza il <strong>credito commerciale gratuito dei fornitori</strong>. Il Ciclo del Circolante (DSI+DSO−DPO) indica il fabbisogno netto di finanziamento del capitale circolante: più è alto, più liquidità è necessaria.</div>
        <div class="ind-interp">${isNaN(c.dpo)?'Inserire debiti fornitori e acquisti per calcolare.':`DPO ${fgg(c.dpo)}: ${c.dpo>=60?'buona gestione del credito fornitori.':c.dpo>=30?'possibilità di negoziare termini più dilazionati con i fornitori.':'l\'azienda paga troppo rapidamente, immobilizzando liquidità.'}${!isNaN(c.ccn_giorni)?' Il ciclo del circolante di '+fgg(c.ccn_giorni)+' indica un fabbisogno '+(c.ccn_giorni>90?'elevato di finanziamento del circolante.':c.ccn_giorni>60?'moderato di finanziamento del circolante.':'contenuto: buona efficienza complessiva.'):''}` }</div>
      </div>
    </div>
  </div>

  <div class="page-footer"><span>AnalisiEBusinessPlan.it</span><span>${nome} — Bilancio ${anno}</span><span>Pag. 6</span></div>
</div>

<!-- ══ PAG 7: BANCABILITÀ EBA ══ -->
<div class="page">
  <div class="page-header">
    <div><div class="ph-eyebrow">Sezione 5</div><div class="ph-title">Analisi Bancabilità EBA/GL/2020/06</div></div>
    <div class="ph-azienda">${nome}<br/>${anno}</div>
  </div>
  <div class="banc-intro">Le <strong>Linee Guida EBA sulla concessione e monitoraggio dei prestiti</strong> (EBA/GL/2020/06, in vigore dal 30/06/2021, recepite da Banca d'Italia) obbligano gli istituti bancari europei a valutare il merito creditizio attraverso indicatori standardizzati. Il superamento delle soglie critiche classifica l'impresa in <strong>Stage 2</strong> (watch list) con impatto su tassi, garanzie e accesso al credito.</div>
  <div class="banc-grid">
    <div class="banc-box">
      <div class="banc-name">DSCR — Debt Service Coverage Ratio</div>
      <div class="banc-acronym">Indice di copertura del servizio del debito</div>
      <div class="banc-formula">EBITDA / (Quote capitale annue + Interessi)</div>
      <div class="banc-val" style="color:${semColor(c.dscr,1.25,1.0)}">${isNaN(c.dscr)?'n.d.':fx(c.dscr)}</div>
      <span class="banc-verdict ${isNaN(c.dscr)?'bv-0':c.dscr>=1.25?'bv-g':c.dscr>=1.0?'bv-a':'bv-r'}">${isNaN(c.dscr)?'Inserire servizio debito':c.dscr>=1.25?'✓ Bancabile — soglia EBA ≥ 1,25x':c.dscr>=1.0?'⚠ Borderline — rischio Stage 2':'✗ Stage 2 EBA — DSCR < 1,0x'}</span>
      ${!isNaN(c.dscr)?`<div class="bar-track"><div class="bar-fill" style="width:${Math.min(c.dscr/3*100,100)}%;background:${semColor(c.dscr,1.25,1.0)}"></div></div>`:''}
      <div class="banc-desc-text">L'indicatore <strong>più monitorato dalle banche</strong>. DSCR &lt; 1,1 è trigger di allerta EBA formale con obbligo di attivare presidi. DSCR &lt; 1,0 = i flussi operativi non coprono il servizio del debito: alto rischio classificazione Stage 2/3.</div>
    </div>
    <div class="banc-box">
      <div class="banc-name">PFN / EBITDA</div>
      <div class="banc-acronym">Posizione Finanziaria Netta su EBITDA</div>
      <div class="banc-formula">(Deb. finanziari − Liquidità) / EBITDA</div>
      <div class="banc-val" style="color:${!isNaN(c.pfn_ebitda)&&c.pfn_ebitda>0?semColor(c.pfn_ebitda,3,5,false):'#059669'}">${!isNaN(c.pfn_ebitda)&&c.pfn_ebitda>0?fx(c.pfn_ebitda,2):c.pfn<=0?'< 0 ✓':'—'}</div>
      <span class="banc-verdict ${!isNaN(c.pfn_ebitda)&&c.pfn_ebitda>0?(c.pfn_ebitda<3?'bv-g':c.pfn_ebitda<5?'bv-a':'bv-r'):'bv-g'}">${!isNaN(c.pfn_ebitda)&&c.pfn_ebitda>0?(c.pfn_ebitda<3?'✓ Ottimo < 3x':c.pfn_ebitda<5?'⚠ Accettabile < 6x':'✗ Stage 2 BCE — > 6x'):'✓ PFN negativa o nulla'}</span>
      <div class="banc-desc-text">Anni di EBITDA necessari per rimborsare il debito netto. La BCE fissa il <strong>valore soglia a 6x</strong>: oltre tale limite l'azienda viene classificata in Stage 2. Prassi di mercato: ottimale &lt;3x, accettabile &lt;6x per le banche italiane.</div>
    </div>
    <div class="banc-box">
      <div class="banc-name">ICR — Interest Coverage Ratio</div>
      <div class="banc-acronym">Indice di copertura degli interessi</div>
      <div class="banc-formula">EBIT / Oneri Finanziari</div>
      <div class="banc-val" style="color:${semColor(c.icr,3,1.5)}">${isNaN(c.icr)?'n.d.':fx(c.icr)}</div>
      <span class="banc-verdict ${isNaN(c.icr)?'bv-0':c.icr>=3?'bv-g':c.icr>=1.5?'bv-a':'bv-r'}">${isNaN(c.icr)?'Nessun onere fin.':c.icr>=3?'✓ Ottimo > 3x':c.icr>=1.5?'⚠ Sufficiente':'✗ Critico < 1,5x'}</span>
      <div class="banc-desc-text">Quante volte il reddito operativo copre gli interessi passivi. ICR &lt; 1 significa che l'EBIT non basta a pagare gli interessi. Uno dei <strong>5 indicatori CNDCEC</strong> per la valutazione della crisi d'impresa (art. 3 CCII).</div>
    </div>
    <div class="banc-box">
      <div class="banc-name">Current Ratio (EBA)</div>
      <div class="banc-acronym">Liquidità corrente — soglia Stage 2</div>
      <div class="banc-formula">Attivo Circolante / Passività a Breve</div>
      <div class="banc-val" style="color:${semColor(c.cr,1.5,1.0)}">${fx(c.cr)}</div>
      <span class="banc-verdict ${c.cr>=1.5?'bv-g':c.cr>=1.0?'bv-a':'bv-r'}">${c.cr>=1.5?'✓ Ottimo > 1,5x':c.cr>=1.0?'⚠ Sufficiente > 1,0x':'✗ Stage 2 — < 1,0x'}</span>
      <div class="banc-desc-text">Nelle valutazioni EBA, Current Ratio &lt; 1 è segnale di allerta formale che può portare alla classificazione Stage 2. Le banche verificano la liquidità corrente in ogni istruttoria di fido o finanziamento.</div>
    </div>
  </div>
  <div class="page-footer"><span>AnalisiEBusinessPlan.it</span><span>${nome} — Bilancio ${anno}</span><span>Pag. 7</span></div>
</div>

${hasRF ? `
<!-- ══ PAG 8: RENDICONTO FINANZIARIO ══ -->
<div class="page">
  <div class="page-header">
    <div><div class="ph-eyebrow">Sezione 6</div><div class="ph-title">Rendiconto Finanziario</div></div>
    <div class="ph-azienda">${nome}<br/>${anno}</div>
  </div>
  <div class="rf-box">
    <div class="rf-title">A) Flussi da attività operativa</div>
    <div class="rf-row"><span class="rf-lbl">Utile/perdita dell'esercizio</span><span class="${(d.rf_utile||d.utile_es||0)>=0?'pos':'neg'}">${fmt(d.rf_utile||d.utile_es)}</span></div>
    <div class="rf-row"><span class="rf-lbl">+ Ammortamenti (rettifica non monetaria)</span><span>+${fmt(d.rf_ammort||d.ammort)}</span></div>
    <div class="rf-row"><span class="rf-lbl">± Variazione capitale circolante netto</span><span>${fmt((d.rf_rim||0)+(d.rf_cred||0)+(d.rf_deb||0)+(d.rf_ccn||0))}</span></div>
    <div class="rf-row"><span class="rf-lbl">− Interessi e imposte pagati</span><span class="neg">−${fmt((d.rf_int||0)+(d.rf_tax||0))}</span></div>
    <div class="rf-tot"><span>Flusso operativo (A)</span><span style="color:${(d.rf_a||0)>=0?'#6EE7B7':'#FCA5A5'}">${fmt(d.rf_a)}</span></div>
  </div>
  <div class="rf-box">
    <div class="rf-title">B) Flussi da attività di investimento</div>
    <div class="rf-row"><span class="rf-lbl">− Investimenti in immobilizzazioni</span><span class="neg">−${fmt(Math.abs((d.rf_inv_mat||0)+(d.rf_inv_imm||0)))}</span></div>
    <div class="rf-row"><span class="rf-lbl">+ Disinvestimenti</span><span class="pos">+${fmt(d.rf_disinv||0)}</span></div>
    <div class="rf-tot"><span>Flusso investimento (B)</span><span style="color:${(d.rf_b||0)>=0?'#6EE7B7':'#FCA5A5'}">${fmt(d.rf_b)}</span></div>
  </div>
  <div class="rf-box">
    <div class="rf-title">C) Flussi da attività di finanziamento</div>
    <div class="rf-row"><span class="rf-lbl">± Variazione debiti bancari a breve</span><span>${fmt(d.rf_fin_bt||0)}</span></div>
    <div class="rf-row"><span class="rf-lbl">− Rimborso finanziamenti m/l termine</span><span class="neg">−${fmt(Math.abs(d.rf_rimb||0))}</span></div>
    <div class="rf-tot"><span>Flusso finanziamento (C)</span><span style="color:${(d.rf_c||0)>=0?'#6EE7B7':'#FCA5A5'}">${fmt(d.rf_c)}</span></div>
  </div>
  <div class="rf-2col">
    <div class="rf-kpi"><div class="rf-kpi-lbl">Variazione liquidità (A+B+C)</div><div class="rf-kpi-val ${(d.rf_tot||((d.rf_a||0)+(d.rf_b||0)+(d.rf_c||0)))>=0?'pos':'neg'}">${fmt(d.rf_tot||((d.rf_a||0)+(d.rf_b||0)+(d.rf_c||0)))}</div></div>
    <div class="rf-kpi"><div class="rf-kpi-lbl">Free Cash Flow (A+B)</div><div class="rf-kpi-val ${(d.rf_fcf||((d.rf_a||0)+(d.rf_b||0)))>=0?'pos':'neg'}">${fmt(d.rf_fcf||((d.rf_a||0)+(d.rf_b||0)))}</div></div>
  </div>
  <div class="page-footer"><span>AnalisiEBusinessPlan.it</span><span>${nome} — Bilancio ${anno}</span><span>Pag. 8</span></div>
</div>` : ''}

<!-- ══ PAG RATING FINALE ══ -->
<div class="page">
  <div class="page-header">
    <div><div class="ph-eyebrow">Sezione ${hasRF?'7':'6'}</div><div class="ph-title">Rating Sintetico di Bancabilità</div></div>
    <div class="ph-azienda">${nome}<br/>${anno}</div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px;">
    <div>
      <div class="rating-center" style="padding:18px 10px 14px;">
        <div class="r-letter">${rating.l}</div>
        <div class="r-title">${rating.title}</div>
        <p class="r-desc">${rating.desc}</p>
        ${rating.penalized?`<div style="font-size:8.5px;color:#DC2626;background:#FEF2F2;border:1px solid #FECACA;border-radius:6px;padding:7px 10px;margin-top:10px;">${rating.triggerNote}</div>`:''}
      </div>
      <div class="rating-scale">
        ${[['D','Critico','#DC2626'],['C','Limitata','#D97706'],['B','Discreta','#3B82F6'],['B+','Buona','#2563EB'],['A','Ottima','#059669'],['A+','Eccellente','#047857']].map(([l,lbl,col])=>`
        <div class="rs-item${rating.l===l?' rs-active':''}">
          <div class="rs-letter" style="color:${rating.l===l?col:col+'99'}">${l}</div>
          <div class="rs-lbl">${lbl}</div>
        </div>`).join('')}
      </div>
    </div>
    <div>
      <div class="zscore-box">
        <div class="zscore-title">Z'-Score Altman PMI Italia</div>
        <div style="display:flex;align-items:baseline;gap:12px;">
          <div class="zscore-val" style="color:${rating.zClass==='pos'?'#059669':rating.zClass==='warn'?'#D97706':'#DC2626'}">${rating.zScore!==null?rating.zScore.toFixed(2):'n.d.'}</div>
          <div class="zscore-label" style="color:${rating.zClass==='pos'?'#059669':rating.zClass==='warn'?'#D97706':'#DC2626'}">${rating.zLabel}</div>
        </div>
        <div class="zscore-desc">Modello Z'-Score adattato alle PMI italiane non quotate (Giacosa-Mazzoleni 2018, su 300 PMI italiane). Soglie: Z &gt; 2,90 = zona sicura · 1,23–2,90 = zona grigia · Z &lt; 1,23 = zona insolvenza. Peso nel rating finale: 30%.</div>
      </div>
      <div class="${rating.triggers.length===0?'trigger-box ok':rating.triggers.length===1?'trigger-box warn':'trigger-box alert'}">
        <div class="trigger-title" style="color:${rating.triggers.length===0?'#059669':rating.triggers.length===1?'#D97706':'#DC2626'}">
          ${rating.triggers.length===0?'✓ Nessun segnale di allerta CCII':rating.triggers.length===1?'⚠ 1 segnale di allerta CCII':'✗ '+rating.triggers.length+' segnali di allerta CCII'}
        </div>
        ${rating.triggers.length===0?'<div style="font-size:9px;color:#059669;">Nessuno dei 7 indicatori di allerta del Codice della Crisi d\'Impresa risulta attivo.</div>':rating.triggers.map(t=>`<div class="trigger-item">⚠ ${t}</div>`).join('')}
      </div>
    </div>
  </div>

  <div class="score-table">
    <div class="score-grid">
      <div>Indicatore EBA</div><div>Valore</div><div>Soglia</div><div>Giudizio</div><div>Score (/${rating.ebaDetails.reduce((a,x)=>a+x.peso*2,0)}pt)</div>
    </div>
    ${rating.ebaDetails.map((e,i)=>`
    <div class="score-row${i%2===0?' hi':''}">
      <div>${e.nome}</div>
      <div>${isNaN(e.val)||!isFinite(e.val)?'n.d.':typeof e.val==='number'&&e.val>10?fp(e.val):fx(e.val)}</div>
      <div>${e.higher?'≥':'≤'} ${e.g}${e.g<10&&e.g>-10?'x':'%'}</div>
      <div style="color:${e.colore};font-weight:700;">${e.giudizio}</div>
      <div style="color:${e.colore};font-weight:700;">${e.punti}/${e.peso*2}</div>
    </div>`).join('')}
    <div class="score-row" style="background:#F0F9FF;">
      <div style="font-weight:700;color:#0369A1;">Totale scorecard EBA (peso 70%)</div>
      <div></div><div></div>
      <div style="font-weight:700;color:#0369A1;">${(rating.pctEBA*100).toFixed(0)}%</div>
      <div style="font-weight:700;color:#0369A1;">${rating.scoreEBA}/${rating.maxEBA}</div>
    </div>
  </div>

  ${note?`<div class="note-box"><div class="note-title">Note dell'analista</div><div class="note-text">${note}</div></div>`:''}
  <div style="text-align:center;font-size:8px;color:#94A3B8;border-top:1px solid #E2E8F0;padding-top:10px;margin-top:10px;">
    Report generato da AnalisiEBusinessPlan.it · Rating calcolato con modello ibrido: Z'-Score Altman PMI (30%) + Scorecard EBA/GL/2020/06 (70%) + verifica trigger CCII (D.Lgs. 14/2019)<br/>
    Generato il ${dataReport} · Documento riservato — uso professionale · Il rating si basa esclusivamente su dati di bilancio e non include la componente andamentale (Centrale Rischi)
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
