// api/genera-word.js — genera report analisi di bilancio in formato Word (.doc)

// ── FORMATTERS ──
const fmt = (n) => {
  if (n === undefined || n === null || isNaN(n) || !isFinite(n) || n === 0) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
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
  const icr = (d.oneri_f || 0) > 0 ? ebit / d.oneri_f : NaN;
  const servizio = (d.rate_cap || 0) + (d.interessi || d.oneri_f || 0);
  const dscr = servizio > 0 && ebitda > 0 ? ebitda / servizio : NaN;
  const dsi = d.mat_prime > 0 && d.rimanenze > 0 ? d.rimanenze / d.mat_prime * 365 : NaN;
  const dso = d.ric_vend > 0 && d.cred_cl > 0 ? d.cred_cl / d.ric_vend * 365 : NaN;
  const dpo = d.mat_prime > 0 && d.deb_for > 0 ? d.deb_for / d.mat_prime * 365 : NaN;
  const ccn_giorni = (!isNaN(dsi) && !isNaN(dso) && !isNaN(dpo)) ? dsi + dso - dpo : NaN;
  return { ebitda, ebit, pfn, roe, roi, ros, cr, acid, leva, aut, ebitda_pct, pfn_ebitda, icr, dscr, servizio, dsi, dso, dpo, ccn_giorni };
}

// ── CALCOLA RATING IBRIDO ──
function calcRating(c, d) {
  const v = (x) => (!isNaN(x) && isFinite(x));
  let zScore = null, zLabel = '—', zClass = 'neu';
  const totAtt = d.tot_att || 0;
  if (totAtt > 0) {
    const ccn = (d.tot_circ || 0) - ((d.deb_b_bt || 0) + (d.deb_for || 0) + (d.deb_trib || 0));
    const riserve = (d.tot_pn || 0) - (d.cap_sociale || 0) - (d.utile_es || 0);
    const X1 = ccn / totAtt;
    const X2 = riserve / totAtt;
    const X3 = c.ebit / totAtt;
    const X4 = d.tot_pn > 0 && d.tot_deb > 0 ? d.tot_pn / d.tot_deb : (d.tot_pn > 0 ? 999 : 0);
    const X5 = (d.ric_vend || d.tot_vp || 0) / totAtt;
    zScore = 0.877 * X1 + 0.847 * X2 + 3.107 * X3 + 0.420 * X4 + 0.998 * X5;
    if (zScore >= 2.90) { zLabel = 'Zona sicura (Z > 2,90)'; zClass = 'pos'; }
    else if (zScore >= 1.23) { zLabel = 'Zona grigia (1,23–2,90)'; zClass = 'warn'; }
    else { zLabel = 'Zona insolvenza (Z < 1,23)'; zClass = 'neg'; }
  }
  const items = [
    [c.dscr, 1.25, 1.0, true, 25, 'DSCR'],
    [c.pfn_ebitda, 3.0, 5.0, false, 20, 'PFN/EBITDA'],
    [c.aut, 30, 15, true, 15, 'Autonomia fin.'],
    [c.cr, 1.5, 1.0, true, 15, 'Current Ratio'],
    [c.roi, 8, 3, true, 10, 'ROI'],
    [c.icr, 3.0, 1.5, true, 10, 'ICR'],
    [c.leva, 2.0, 3.5, false, 5, 'Leva D/E'],
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

  const triggers = [];
  if (v(c.dscr) && c.dscr < 1.1) triggers.push('DSCR < 1,1 (soglia EBA Stage 2)');
  if (v(c.pfn_ebitda) && c.pfn_ebitda > 6) triggers.push('PFN/EBITDA > 6x (soglia BCE)');
  if ((d.utile_es || 0) < 0) triggers.push('Perdita d\'esercizio');
  if (v(c.aut) && c.aut < 15) triggers.push('Autonomia finanziaria < 15%');
  if (v(c.cr) && c.cr < 1.0) triggers.push('Current Ratio < 1,0');

  let ratingScore = pctEBA;
  if (zScore !== null) {
    const zNorm = zScore >= 2.90 ? 1 : zScore >= 1.23 ? 0.5 : 0;
    ratingScore = pctEBA * 0.70 + zNorm * 0.30;
  }

  let rating;
  if (ratingScore >= 0.82)      rating = { l: 'A+', color: '#047857', title: 'Eccellente' };
  else if (ratingScore >= 0.68) rating = { l: 'A',  color: '#059669', title: 'Ottima bancabilità' };
  else if (ratingScore >= 0.55) rating = { l: 'B+', color: '#2563EB', title: 'Buona bancabilità' };
  else if (ratingScore >= 0.42) rating = { l: 'B',  color: '#3B82F6', title: 'Bancabilità discreta' };
  else if (ratingScore >= 0.28) rating = { l: 'C',  color: '#D97706', title: 'Bancabilità limitata' };
  else                          rating = { l: 'D',  color: '#DC2626', title: 'Profilo critico' };

  if (triggers.length >= 2) {
    const scale = ['A+','A','B+','B','C','D'];
    const down =  ['A','B+','B','C','D','D'];
    const idx = scale.indexOf(rating.l);
    if (idx >= 0) rating.l = down[idx];
    rating.penalized = true;
    rating.triggerNote = `Penalizzato per ${triggers.length} segnali CCII attivi.`;
  }

  return { ...rating, zScore, zLabel, zClass, pctEBA, scoreEBA, maxEBA, ebaDetails, triggers, ratingScore };
}

function calcMCC(c, d) {
  const vv = (x) => (!isNaN(x) && isFinite(x));
  const exclusions = [];
  if ((d.tot_pn || 0) <= 0) exclusions.push('Patrimonio netto negativo o nullo — esclusione automatica');
  const pfnPn = (d.tot_pn || 0) > 0 ? c.pfn / d.tot_pn : NaN;
  const items = [
    { nome: 'ROI — Redditività investimenti', disp: vv(c.roi) ? fp(c.roi) : 'n.d.', soglie: '>=0% / >=4% / >=8%', peso: 20,
      pts: vv(c.roi) ? (c.roi >= 8 ? 20 : c.roi >= 4 ? 14 : c.roi >= 0 ? 7 : 0) : 0 },
    { nome: 'EBITDA Margin — Marginalità operativa', disp: vv(c.ebitda_pct) ? fp(c.ebitda_pct) : 'n.d.', soglie: '>=3% / >=8% / >=15%', peso: 20,
      pts: vv(c.ebitda_pct) ? (c.ebitda_pct >= 15 ? 20 : c.ebitda_pct >= 8 ? 14 : c.ebitda_pct >= 3 ? 7 : 0) : 0 },
    { nome: 'Autonomia finanziaria — PN / Totale attivo', disp: vv(c.aut) ? fp(c.aut) : 'n.d.', soglie: '>=15% / >=25% / >=40%', peso: 25,
      pts: vv(c.aut) ? (c.aut >= 40 ? 25 : c.aut >= 25 ? 17 : c.aut >= 15 ? 9 : 0) : 0 },
    { nome: 'Current Ratio — Liquidità corrente', disp: vv(c.cr) ? fx(c.cr) : 'n.d.', soglie: '>=0.7x / >=1.0x / >=1.5x', peso: 20,
      pts: vv(c.cr) ? (c.cr >= 1.5 ? 20 : c.cr >= 1.0 ? 13 : c.cr >= 0.7 ? 6 : 0) : 0 },
    { nome: 'PFN / Patrimonio netto — Leva debitoria', disp: c.pfn <= 0 ? '< 0 OK' : vv(pfnPn) ? fx(pfnPn) : 'n.d.', soglie: '<=4x / <=2x / <=1x', peso: 15,
      pts: c.pfn <= 0 ? 15 : vv(pfnPn) ? (pfnPn <= 1 ? 15 : pfnPn <= 2 ? 10 : pfnPn <= 4 ? 5 : 0) : 0 },
  ];
  const totalScore = items.reduce((s, i) => s + i.pts, 0);
  let fascia, fasciaLabel, fasciaColor, copertura, eligible;
  if (exclusions.length > 0 && (d.tot_pn || 0) <= 0) {
    fascia = 5; fasciaLabel = 'Non ammissibile'; fasciaColor = '#DC2626'; copertura = '—'; eligible = false;
  } else if (totalScore >= 75) { fascia = 1; fasciaLabel = 'Eccellente'; fasciaColor = '#047857'; copertura = "fino all'80%"; eligible = true; }
  else if (totalScore >= 55) { fascia = 2; fasciaLabel = 'Buona bancabilità'; fasciaColor = '#059669'; copertura = 'fino al 70%'; eligible = true; }
  else if (totalScore >= 35) { fascia = 3; fasciaLabel = 'Bancabilità media'; fasciaColor = '#2563EB'; copertura = 'fino al 60%'; eligible = true; }
  else if (totalScore >= 15) { fascia = 4; fasciaLabel = 'Bancabilità bassa'; fasciaColor = '#D97706'; copertura = 'fino al 40%'; eligible = true; }
  else { fascia = 5; fasciaLabel = 'Non ammissibile'; fasciaColor = '#DC2626'; copertura = '—'; eligible = false; }
  return { fascia, fasciaLabel, fasciaColor, totalScore, items, exclusions, copertura, eligible };
}

function semText(val, thG, thA, higher = true) {
  if (isNaN(val) || !isFinite(val)) return '—';
  const ok = higher ? val >= thG : val <= thG;
  const med = higher ? val >= thA : val <= thA;
  return ok ? '[OK]' : med ? '[!]' : '[X]';
}

function semClass(val, thG, thA, higher = true) {
  if (isNaN(val) || !isFinite(val)) return '';
  const ok = higher ? val >= thG : val <= thG;
  const med = higher ? val >= thA : val <= thA;
  return ok ? 'pos' : med ? 'warn' : 'neg';
}

function buildWordHTML(data, config) {
  const d = data;
  const c = calcIndici(d);
  const rating = calcRating(c, d);
  const mcc = calcMCC(c, d);

  const nome = config.nome || 'Azienda';
  const anno = config.anno || new Date().getFullYear();
  const dataReport = config.dataReport || new Date().toLocaleDateString('it-IT');

  // ── SEZIONE STATO PATRIMONIALE ──
  const spRows = [
    ['ATTIVO', '', '', true],
    ['Immobilizzazioni immateriali', d.imm_imm, '', false],
    ['Immobilizzazioni materiali', d.imm_mat, '', false],
    ['Immobilizzazioni finanziarie', d.imm_fin, '', false],
    ['Totale Attivo Fisso', d.tot_fisso, '', true],
    ['Rimanenze', d.rimanenze, '', false],
    ['Crediti verso clienti', d.cred_cl, '', false],
    ['Altri crediti', d.alt_cr, '', false],
    ['Liquidità', d.liquidita, '', false],
    ['Ratei e risconti attivi', d.ratei_att, '', false],
    ['Totale Attivo Circolante', d.tot_circ, '', true],
    ['TOTALE ATTIVO', d.tot_att, '', true],
    ['', '', '', false],
    ['PASSIVO', '', '', true],
    ['Capitale sociale', d.cap_sociale, '', false],
    ['Riserve', d.riserve, '', false],
    ['Utile (Perdita) di esercizio', d.utile_es, '', false],
    ['Totale Patrimonio Netto', d.tot_pn, '', true],
    ['Debiti bancari a lungo termine', d.deb_b_lt, '', false],
    ['Fondo TFR', d.tfr, '', false],
    ['Totale Passivo a Lungo', d.tot_plt, '', true],
    ['Debiti bancari a breve', d.deb_b_bt, '', false],
    ['Debiti verso fornitori', d.deb_for, '', false],
    ['Debiti tributari/previdenziali', d.deb_trib, '', false],
    ['Altri debiti', d.alt_deb, '', false],
    ['Ratei e risconti passivi', d.ratei_pas, '', false],
    ['Totale Passivo a Breve', d.tot_pbt, '', true],
    ['TOTALE PASSIVO', d.tot_pas, '', true],
  ];

  const spHTML = spRows.map(([label, val, note, bold]) => {
    if (!label) return '<tr><td colspan="2" style="padding:2pt;">&nbsp;</td></tr>';
    const cls = bold ? ' class="tot"' : '';
    const v = val !== undefined && val !== null && val !== 0 ? fmt(val) : '—';
    return `<tr${cls}><td>${label}</td><td style="text-align:right;">${v}</td></tr>`;
  }).join('\n');

  // ── SEZIONE CONTO ECONOMICO ──
  const ceRows = [
    ['Ricavi di vendita', d.ric_vend, false],
    ['Variazione rimanenze', d.var_mag, false],
    ['Altri ricavi', d.alt_ric, false],
    ['Totale Valore della Produzione', d.tot_vp, true],
    ['Materie prime e consumo', d.mat_prime, false],
    ['Variazione materie prime', d.var_mat, false],
    ['Servizi', d.servizi, false],
    ['Godimento beni di terzi', d.godimento, false],
    ['Costo del personale', d.personale, false],
    ['Oneri diversi di gestione', d.oneri_div, false],
    ['EBITDA', c.ebitda, true, 'ebitda'],
    ['Ammortamenti e svalutazioni', d.ammort, false],
    ['EBIT (Reddito operativo)', c.ebit, true],
    ['Proventi finanziari', d.prov_fin, false],
    ['Oneri finanziari', d.oneri_f, false],
    ['Risultato ante imposte', (c.ebit || 0) + (d.prov_fin || 0) - (d.oneri_f || 0), true],
    ['Imposte', d.imposte, false],
    ['Utile (Perdita) netto', d.utile_es, true],
  ];

  const ceHTML = ceRows.map(([label, val, bold, special]) => {
    const cls = special === 'ebitda' ? ' class="ebitda"' : bold ? ' class="tot"' : '';
    const v = val !== undefined && val !== null && !isNaN(val) && val !== 0 ? fmt(val) : '—';
    return `<tr${cls}><td>${label}</td><td style="text-align:right;">${v}</td></tr>`;
  }).join('\n');

  // ── SEZIONE INDICI ──
  const indici = [
    ['ROE — Redditività del capitale proprio', fp(c.roe), semClass(c.roe, 10, 5, true)],
    ['ROI — Redditività del capitale investito', fp(c.roi), semClass(c.roi, 8, 3, true)],
    ['ROS — Redditività delle vendite', fp(c.ros), semClass(c.ros, 5, 2, true)],
    ['EBITDA Margin', fp(c.ebitda_pct), semClass(c.ebitda_pct, 15, 8, true)],
    ['Current Ratio (CR)', fx(c.cr), semClass(c.cr, 1.5, 1.0, true)],
    ['Acid Test', fx(c.acid), semClass(c.acid, 1.0, 0.7, true)],
    ['Autonomia finanziaria', fp(c.aut), semClass(c.aut, 40, 15, true)],
    ['Leva finanziaria (D/E)', fx(c.leva), semClass(c.leva, 2.0, 3.5, false)],
    ['PFN / EBITDA', fx(c.pfn_ebitda), semClass(c.pfn_ebitda, 3.0, 5.0, false)],
    ['DSCR — Debt Service Coverage', fx(c.dscr), semClass(c.dscr, 1.25, 1.0, true)],
    ['ICR — Interest Coverage', fx(c.icr), semClass(c.icr, 3.0, 1.5, true)],
    ['PFN', fmt(c.pfn), c.pfn <= 0 ? 'pos' : 'neg'],
    ['EBITDA', fmt(c.ebitda), c.ebitda > 0 ? 'pos' : 'neg'],
    ['EBIT', fmt(c.ebit), c.ebit > 0 ? 'pos' : 'neg'],
  ];

  const indiciHTML = indici.map(([label, val, cls]) =>
    `<tr><td>${label}</td><td class="${cls}" style="text-align:right;">${val}</td></tr>`
  ).join('\n');

  // ── SEZIONE BANCABILITÀ EBA ──
  const ebaRows = rating.ebaDetails.map(item => {
    const valStr = isNaN(item.val) || !isFinite(item.val) ? 'n.d.' :
      (item.nome.includes('PFN') || item.nome.includes('DSCR') || item.nome.includes('ICR') || item.nome.includes('Leva') || item.nome.includes('Current') ? fx(item.val) : fp(item.val));
    const sem = item.punti === item.peso * 2 ? '[OK]' : item.punti > 0 ? '[!]' : '[X]';
    const cls = item.punti === item.peso * 2 ? 'pos' : item.punti > 0 ? 'warn' : 'neg';
    return `<tr><td>${item.nome}</td><td style="text-align:right;">${valStr}</td><td class="${cls}" style="text-align:center;">${sem}</td><td style="text-align:center;">${item.giudizio}</td><td style="text-align:right;">${item.punti}/${item.peso*2}</td></tr>`;
  }).join('\n');

  // ── SEZIONE RATING MCC ──
  const mccRows = mcc.items.map(item =>
    `<tr><td>${item.nome}</td><td style="text-align:right;">${item.disp}</td><td style="text-align:center;">${item.soglie}</td><td style="text-align:right;">${item.pts}/${item.peso}</td></tr>`
  ).join('\n');

  const triggerList = rating.triggers.length > 0
    ? '<ul>' + rating.triggers.map(t => `<li>${t}</li>`).join('') + '</ul>'
    : '<p>Nessun segnale di allerta CCII rilevato.</p>';

  return `<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset="utf-8">
<meta name=ProgId content=Word.Document>
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #0F172A; margin: 2cm; }
  h1 { font-size: 18pt; color: #0A1628; border-bottom: 2px solid #2563EB; padding-bottom: 4pt; }
  h2 { font-size: 13pt; color: #1D4ED8; margin-top: 18pt; margin-bottom: 6pt; }
  h3 { font-size: 11pt; color: #374151; margin-top: 12pt; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
  th { background: #0A1628; color: white; padding: 6pt 8pt; font-size: 9pt; text-align: left; }
  td { padding: 5pt 8pt; border-bottom: 1pt solid #E2E8F0; font-size: 10pt; }
  tr.tot td { font-weight: bold; background: #F0F9FF; }
  tr.ebitda td { color: #059669; font-weight: bold; background: #DCFCE7; }
  .pos { color: #059669; font-weight: bold; }
  .neg { color: #DC2626; font-weight: bold; }
  .warn { color: #D97706; font-weight: bold; }
  .page-break { page-break-after: always; }
  .cover { text-align: center; padding: 60pt 0; }
  .cover h1 { font-size: 28pt; border: none; color: #0A1628; }
  .cover .subtitle { font-size: 14pt; color: #475569; margin: 8pt 0; }
  .cover .rating-box { display: inline-block; border: 3pt solid #2563EB; padding: 12pt 24pt; margin-top: 20pt; border-radius: 4pt; }
  .cover .rating-val { font-size: 36pt; font-weight: bold; }
  .cover .rating-title { font-size: 12pt; color: #475569; }
  .disclaimer { font-size: 8pt; color: #94A3B8; border-top: 1pt solid #E2E8F0; margin-top: 20pt; padding-top: 10pt; }
  .info-box { background: #F8FAFC; border-left: 3pt solid #2563EB; padding: 8pt 12pt; margin: 8pt 0; }
  .alert-box { background: #FFF7ED; border-left: 3pt solid #D97706; padding: 8pt 12pt; margin: 8pt 0; }
  .success-box { background: #F0FDF4; border-left: 3pt solid #059669; padding: 8pt 12pt; margin: 8pt 0; }
  ul { margin: 4pt 0 4pt 16pt; padding: 0; }
  li { margin: 2pt 0; font-size: 10pt; }
</style>
</head>
<body>

<!-- COPERTINA -->
<div class="cover">
  <p style="font-size:10pt;color:#94A3B8;margin-bottom:40pt;">ANALISI DI BILANCIO — REPORT PROFESSIONALE</p>
  <h1>${nome}</h1>
  <p class="subtitle">Esercizio ${anno}</p>
  <p class="subtitle">Data elaborazione: ${dataReport}</p>
  <div class="rating-box">
    <div class="rating-val" style="color:${rating.color};">${rating.l}</div>
    <div class="rating-title">${rating.title}</div>
  </div>
  <p style="margin-top:40pt;font-size:9pt;color:#94A3B8;">Score EBA: ${Math.round(rating.pctEBA * 100)}% &nbsp;|&nbsp; Z-Score Altman: ${rating.zScore !== null ? rating.zScore.toFixed(2) : 'n.d.'}</p>
</div>

<div class="page-break"></div>

<!-- SEZIONE 1: STATO PATRIMONIALE -->
<h1>1. Stato Patrimoniale</h1>
<p style="font-size:9pt;color:#64748B;">Valori in Euro — Esercizio ${anno}</p>
<table>
  <thead>
    <tr><th style="width:70%">Voce</th><th style="text-align:right;">Importo</th></tr>
  </thead>
  <tbody>
    ${spHTML}
  </tbody>
</table>

<div class="page-break"></div>

<!-- SEZIONE 2: CONTO ECONOMICO -->
<h1>2. Conto Economico</h1>
<p style="font-size:9pt;color:#64748B;">Valori in Euro — Esercizio ${anno}</p>
<table>
  <thead>
    <tr><th style="width:70%">Voce</th><th style="text-align:right;">Importo</th></tr>
  </thead>
  <tbody>
    ${ceHTML}
  </tbody>
</table>

<div class="page-break"></div>

<!-- SEZIONE 3: INDICI DI BILANCIO -->
<h1>3. Indici di Bilancio</h1>
<table>
  <thead>
    <tr><th style="width:70%">Indice</th><th style="text-align:right;">Valore</th></tr>
  </thead>
  <tbody>
    ${indiciHTML}
  </tbody>
</table>

<div class="page-break"></div>

<!-- SEZIONE 4: BANCABILITÀ EBA -->
<h1>4. Scorecard Bancabilità EBA</h1>
<p>Punteggio complessivo: <strong>${rating.scoreEBA} / ${rating.maxEBA}</strong> &nbsp;&mdash;&nbsp; <strong>${Math.round(rating.pctEBA * 100)}%</strong></p>
${rating.triggers.length > 0 ? `<div class="alert-box"><strong>Segnali di allerta CCII:</strong>${triggerList}</div>` : `<div class="success-box">Nessun segnale di allerta CCII rilevato.</div>`}
<table>
  <thead>
    <tr><th>Indicatore</th><th style="text-align:right;">Valore</th><th style="text-align:center;">Esito</th><th style="text-align:center;">Giudizio</th><th style="text-align:right;">Punti</th></tr>
  </thead>
  <tbody>
    ${ebaRows}
  </tbody>
</table>

<h2>Z-Score Altman (PMI Italia)</h2>
<div class="info-box">
  <p><strong>Z-Score:</strong> ${rating.zScore !== null ? rating.zScore.toFixed(2) : 'Non calcolabile (dati insufficienti)'}</p>
  ${rating.zScore !== null ? `<p class="${rating.zClass}"><strong>${rating.zLabel}</strong></p>` : ''}
</div>

${rating.penalized ? `<div class="alert-box"><strong>Nota:</strong> ${rating.triggerNote}</div>` : ''}

<div class="page-break"></div>

<!-- SEZIONE 5: RATING MCC -->
<h1>5. Rating MCC — Fondo Centrale di Garanzia</h1>
<div class="info-box">
  <p><strong>Fascia MCC:</strong> ${mcc.fascia} — ${mcc.fasciaLabel}</p>
  <p><strong>Punteggio:</strong> ${mcc.totalScore} / 100</p>
  <p><strong>Copertura garanzia:</strong> ${mcc.copertura}</p>
  <p><strong>Ammissibilità:</strong> ${mcc.eligible ? 'Ammissibile' : 'Non ammissibile'}</p>
</div>
${mcc.exclusions.length > 0 ? `<div class="alert-box"><ul>${mcc.exclusions.map(e => `<li>${e}</li>`).join('')}</ul></div>` : ''}
<table>
  <thead>
    <tr><th>Criterio</th><th style="text-align:right;">Valore</th><th>Soglie</th><th style="text-align:right;">Punti</th></tr>
  </thead>
  <tbody>
    ${mccRows}
  </tbody>
  <tfoot>
    <tr class="tot"><td colspan="3">TOTALE</td><td style="text-align:right;">${mcc.totalScore} / 100</td></tr>
  </tfoot>
</table>

<div class="page-break"></div>

<!-- SEZIONE 6: NOTE E DISCLAIMER -->
<h1>6. Note e Disclaimer</h1>
<h2>Metodologia</h2>
<p>Il presente report è stato generato automaticamente sulla base dei dati di bilancio inseriti dall'utente.
L'analisi utilizza le seguenti metodologie:</p>
<ul>
  <li><strong>Rating ibrido EBA/Altman:</strong> combinazione tra scorecard EBA (70%) e Z-Score Altman PMI (30%)</li>
  <li><strong>Z-Score Altman modificato per PMI italiane:</strong> formula Z' con coefficienti adattati al mercato italiano</li>
  <li><strong>Scorecard MCC:</strong> basata sui criteri del Fondo Centrale di Garanzia (D.M. 6 marzo 2017)</li>
  <li><strong>Bancabilità EBA:</strong> secondo le linee guida EBA/GL/2020/06 sui criteri di concessione del credito</li>
</ul>
<h2>Legenda Semafori</h2>
<ul>
  <li><span class="pos">[OK]</span> — Valore nella zona verde (ottimo)</li>
  <li><span class="warn">[!]</span> — Valore nella zona gialla (attenzione)</li>
  <li><span class="neg">[X]</span> — Valore nella zona rossa (critico)</li>
</ul>
<div class="disclaimer">
  <strong>DISCLAIMER:</strong> Questo documento ha finalità esclusivamente informative e non costituisce consulenza finanziaria,
  legale o fiscale. I calcoli sono effettuati automaticamente sulla base dei dati forniti dall'utente, che si assume
  la responsabilità della loro correttezza e completezza. L'elaborazione automatica non sostituisce l'analisi
  di un professionista qualificato. I valori degli indici e dei rating sono indicativi e possono differire
  dalle valutazioni effettuate da istituti di credito o agenzie di rating.
  <br><br>
  Documento generato il ${dataReport} — Analisi di Bilancio Web App
</div>

</body>
</html>`;
}

module.exports = function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { data, config } = req.body;
  if (!data) return res.status(400).json({ error: 'Dati bilancio mancanti' });
  try {
    const html = buildWordHTML(data, config || {});
    const nome = (config?.nome || 'Report').replace(/[^a-zA-Z0-9]/g, '-');
    const anno = config?.anno || new Date().getFullYear();
    res.setHeader('Content-Type', 'application/msword');
    res.setHeader('Content-Disposition', `attachment; filename="Analisi-Bilancio-${nome}-${anno}.doc"`);
    res.status(200).send(html);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
