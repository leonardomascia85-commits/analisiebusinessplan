
// ── FORMATTERS ──
const fmt = (n) => {
  if (n === undefined || n === null || isNaN(n) || !isFinite(n) || n === 0) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
};
const fp = (n, d = 1) => (isNaN(n) || !isFinite(n)) ? '—' : n.toFixed(d) + '%';
const fx = (n, d = 2) => (isNaN(n) || !isFinite(n)) ? '—' : n.toFixed(d) + 'x';
const fgg = (n) => (isNaN(n) || !isFinite(n) || n <= 0) ? '—' : Math.round(n) + ' gg';
const fmtK = (n) => {
  if (!n || isNaN(n)) return '—';
  if (Math.abs(n) >= 1000000) return (n/1000000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1000) return (n/1000).toFixed(0) + 'K';
  return n.toFixed(0);
};

// ── CALCOLA INDICI ──
function calcIndici(d) {
  const ebitda = (d.tot_vp || 0) - ((d.mat_prime || 0) + (d.servizi || 0) + (d.godimento || 0) + (d.personale || 0) + (d.var_mat || 0) + (d.oneri_div || 0));
  const ebit = ebitda - (d.ammort || 0);
  const dbt_bt = (d.deb_b_bt || 0) + (d.deb_for || 0) + (d.deb_trib || 0) + (d.alt_deb || 0);
  const hasPfnData = (d.pfn_bt || 0) + (d.pfn_lt || 0) + (d.pfn_liq || 0) + (d.pfn_tit || 0) > 0;
  const pfn = hasPfnData
    ? ((d.pfn_bt || 0) + (d.pfn_lt || 0)) - ((d.pfn_liq || 0) + (d.pfn_tit || 0))
    : ((d.deb_b_bt || 0) + (d.deb_b_lt || 0) + (d.alt_deb || 0)) - (d.liquidita || 0);
  const roe = d.tot_pn > 0 ? (d.utile_es || 0) / d.tot_pn * 100 : NaN;
  const roi = d.tot_att > 0 ? ebitda / d.tot_att * 100 : NaN;
  const ros = d.tot_vp > 0 ? ebitda / d.tot_vp * 100 : NaN;
  const cr  = dbt_bt > 0 ? (d.tot_circ || 0) / dbt_bt : NaN;
  const acid = dbt_bt > 0 ? ((d.tot_circ || 0) - (d.rimanenze || 0)) / dbt_bt : NaN;
  const leva = d.tot_pn > 0 ? (d.tot_deb || 0) / d.tot_pn : NaN;
  const aut  = d.tot_att > 0 ? (d.tot_pn || 0) / d.tot_att * 100 : NaN;
  const ebitda_pct = d.tot_vp > 0 ? ebitda / d.tot_vp * 100 : NaN;
  const pfn_ebitda = ebitda > 0 && pfn > 0 ? pfn / ebitda : NaN;
  const icr = (d.oneri_f || 0) > 0 ? ebit / d.oneri_f : NaN;
  const servizio = (d.rate_cap || 0) + (d.interessi || d.oneri_f || 0);
  // DSCR — cascata formule: CCII → EBA → bancaria → EBIT
  const hasTasse = (d.imposte || 0) > 0;
  const hasCcn   = (d.var_ccn || 0) !== 0;
  const fco = hasCcn || hasTasse ? ebitda - (d.var_ccn || 0) - (d.imposte || 0) : null;
  const dscr = servizio > 0
    ? (fco !== null      ? fco / servizio
      : hasTasse         ? (ebitda - (d.imposte || 0)) / servizio
      : ebitda > 0       ? ebitda / servizio
      : !isNaN(ebit)     ? ebit / servizio
      : NaN)
    : NaN;
  const dscr_formula = servizio > 0
    ? (fco !== null ? 'FCO/DS (CCII)' : hasTasse ? '(EBITDA−Tax)/DS (EBA)' : ebitda > 0 ? 'EBITDA/DS' : 'EBIT/DS')
    : null;
  const dsi = d.mat_prime > 0 && d.rimanenze > 0 ? d.rimanenze / d.mat_prime * 365 : NaN;
  const dso = d.ric_vend > 0 && d.cred_cl > 0 ? d.cred_cl / d.ric_vend * 365 : NaN;
  const dpo = d.mat_prime > 0 && d.deb_for > 0 ? d.deb_for / d.mat_prime * 365 : NaN;
  const ccn_giorni = (!isNaN(dsi) && !isNaN(dso) && !isNaN(dpo)) ? dsi + dso - dpo : NaN;
  return { ebitda, ebit, pfn, roe, roi, ros, cr, acid, leva, aut, ebitda_pct, pfn_ebitda, icr, dscr, dscr_formula, servizio, dsi, dso, dpo, ccn_giorni };
}

// ── CALCOLA RATING IBRIDO ──
function calcRating(c, d) {
  const v = (x) => (!isNaN(x) && isFinite(x));
  // Z'-Score Altman PMI Italia
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
  // Scorecard EBA
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

  // Trigger CCII
  const triggers = [];
  if (v(c.dscr) && c.dscr < 1.1) triggers.push('DSCR < 1,1 (soglia EBA Stage 2)');
  if (v(c.pfn_ebitda) && c.pfn_ebitda > 6) triggers.push('PFN/EBITDA > 6x (soglia BCE)');
  if ((d.utile_es || 0) < 0) triggers.push('Perdita d\'esercizio');
  if (v(c.aut) && c.aut < 15) triggers.push('Autonomia finanziaria < 15%');
  if (v(c.cr) && c.cr < 1.0) triggers.push('Current Ratio < 1,0');

  // Score finale
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

  // Score per radar (0-100)
  const radarScores = {
    redditivita: Math.min(100, Math.max(0, ((v(c.roi) ? (c.roi >= 8 ? 100 : c.roi >= 3 ? 60 : 20) : 0) + (v(c.roe) ? (c.roe >= 10 ? 100 : c.roe >= 5 ? 60 : 20) : 0)) / 2)),
    liquidita: v(c.cr) ? (c.cr >= 1.5 ? 100 : c.cr >= 1.0 ? 60 : 20) : 0,
    solidita: v(c.aut) ? (c.aut >= 40 ? 100 : c.aut >= 30 ? 75 : c.aut >= 15 ? 45 : 15) : 0,
    efficienza: v(c.dso) ? (c.dso <= 60 ? 100 : c.dso <= 90 ? 65 : 35) : 50,
    bancabilita: v(c.dscr) ? (c.dscr >= 1.25 ? 100 : c.dscr >= 1.0 ? 55 : 15) : (pctEBA * 100),
  };

  return { ...rating, zScore, zLabel, zClass, pctEBA, scoreEBA, maxEBA, ebaDetails, triggers, ratingScore, radarScores };
}

function semColor(val, thG, thA, higher = true) {
  if (isNaN(val) || !isFinite(val)) return '#94A3B8';
  const ok = higher ? val >= thG : val <= thG;
  const med = higher ? val >= thA : val <= thA;
  return ok ? '#059669' : med ? '#D97706' : '#DC2626';
}

// ── SVG CHARTS INLINE ──
function svgGauge(rating, color) {
  const ratings = ['D','C','B','B+','A','A+'];
  const idx = Math.max(0, ratings.indexOf(rating));
  const pct = idx / (ratings.length - 1);
  const angle = -180 + pct * 180;
  const cx = 120, cy = 105, r = 78;
  const toRad = a => a * Math.PI / 180;
  const colors = ['#DC2626','#F97316','#3B82F6','#2563EB','#059669','#047857'];
  const arcW = 22;
  const arcs = ratings.map((l, i) => {
    const a1 = -180 + i * 30 + 1;
    const a2 = a1 + 27;
    const x1o = cx + r * Math.cos(toRad(a1)), y1o = cy + r * Math.sin(toRad(a1));
    const x2o = cx + r * Math.cos(toRad(a2)), y2o = cy + r * Math.sin(toRad(a2));
    const ri = r - arcW;
    const x1i = cx + ri * Math.cos(toRad(a1)), y1i = cy + ri * Math.sin(toRad(a1));
    const x2i = cx + ri * Math.cos(toRad(a2)), y2i = cy + ri * Math.sin(toRad(a2));
    const active = i <= idx;
    return `<path d="M${x1i},${y1i} L${x1o},${y1o} A${r},${r} 0 0,1 ${x2o},${y2o} L${x2i},${y2i} A${ri},${ri} 0 0,0 ${x1i},${y1i}Z" fill="${colors[i]}" opacity="${active?1:0.18}"/>`;
  });
  const nx = cx + 70 * Math.cos(toRad(angle)), ny = cy + 70 * Math.sin(toRad(angle));
  const labNodes = ratings.map((l, i) => {
    const a = -180 + i * 30 + 13.5;
    const lx = cx + (r + 12) * Math.cos(toRad(a));
    const ly = cy + (r + 12) * Math.sin(toRad(a));
    return `<text x="${lx}" y="${ly+3}" text-anchor="middle" font-family="sans-serif" font-size="7.5" font-weight="700" fill="${i <= idx ? colors[i] : '#CBD5E1'}">${l}</text>`;
  }).join('');
  return `<svg viewBox="0 0 240 125" xmlns="http://www.w3.org/2000/svg" style="width:220px;display:block;margin:0 auto;">
    ${arcs.join('')}
    <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="#0F172A" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="5" fill="#0F172A"/>
    <text x="${cx}" y="${cy+20}" text-anchor="middle" font-family="Georgia,serif" font-size="30" font-weight="700" fill="${color}">${rating}</text>
    ${labNodes}
  </svg>`;
}

function svgRadar(scores) {
  const labels = ['Redditività','Liquidità','Solidità','Efficienza','Bancabilità'];
  const keys = ['redditivita','liquidita','solidita','efficienza','bancabilita'];
  const n = labels.length;
  const cx = 130, cy = 120, maxR = 85;
  const toRad = a => a * Math.PI / 180;
  const angleStep = 360 / n;
  const startA = -90;
  const pt = (i, r) => {
    const a = startA + i * angleStep;
    return [cx + r * Math.cos(toRad(a)), cy + r * Math.sin(toRad(a))];
  };
  const grids = [0.25,0.5,0.75,1.0].map(lv => {
    const pts = Array.from({length:n},(_,i)=>pt(i,maxR*lv)).map(([x,y])=>`${x},${y}`).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="#E2E8F0" stroke-width="${lv===1?1.5:0.7}"/>`;
  }).join('');
  const axes = Array.from({length:n},(_,i)=>{
    const [x,y]=pt(i,maxR);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#E2E8F0" stroke-width="0.8"/>`;
  }).join('');
  const dataPts = keys.map((k,i)=>{
    const v=Math.min(Math.max((scores[k]||0)/100,0),1);
    const [x,y]=pt(i,maxR*v);
    return `${x},${y}`;
  }).join(' ');
  const dots = keys.map((k,i)=>{
    const v=Math.min(Math.max((scores[k]||0)/100,0),1);
    const [x,y]=pt(i,maxR*v);
    return `<circle cx="${x}" cy="${y}" r="3.5" fill="#1D4ED8" stroke="#fff" stroke-width="1.5"/>`;
  }).join('');
  const labNodes = labels.map((l,i)=>{
    const [x,y]=pt(i,maxR+16);
    const anchor = x > cx+5 ? 'start' : x < cx-5 ? 'end' : 'middle';
    return `<text x="${x}" y="${y+3}" text-anchor="${anchor}" font-family="sans-serif" font-size="8.5" font-weight="600" fill="#475569">${l}</text>`;
  }).join('');
  return `<svg viewBox="0 0 260 240" xmlns="http://www.w3.org/2000/svg" style="width:240px;display:block;margin:0 auto;">
    ${grids}${axes}
    <polygon points="${dataPts}" fill="rgba(29,78,216,0.12)" stroke="#1D4ED8" stroke-width="2" stroke-linejoin="round"/>
    ${dots}${labNodes}
  </svg>`;
}

function svgBarChart(years) {
  if (!years || years.length === 0) return '';
  const H = 160, padL = 50, padB = 32, padT = 16, padR = 12;
  const n = years.length;
  const groupW = n === 1 ? 90 : n === 2 ? 70 : 55;
  const W = padL + n * (groupW + 16) + padR;
  const maxVal = Math.max(...years.flatMap(d => [Math.abs(d.ricavi||0), Math.abs(d.ebitda||0), Math.abs(d.utile||0)]), 1);
  const scaleH = (H - padT - padB);
  const baseY = H - padB;
  const toH = v => Math.max(1, Math.abs(v) / maxVal * scaleH);
  const toY = v => v >= 0 ? baseY - toH(v) : baseY;
  const barDefs = [
    { key:'ricavi', color:'#BFDBFE', label:'Ricavi' },
    { key:'ebitda', color:'#059669', label:'EBITDA' },
    { key:'utile',  color:null,      label:'Utile/Perdita' },
  ];
  const bw = (groupW - 8) / 3;
  const gridLines = [0.25,0.5,0.75,1.0].map(lv => {
    const y = baseY - lv * scaleH;
    return `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="#F1F5F9" stroke-width="1"/>
    <text x="${padL-4}" y="${y+3}" text-anchor="end" font-size="7" fill="#94A3B8">${fmtK(maxVal*lv)}</text>`;
  }).join('');
  const bars = years.map((d,gi) => {
    const gx = padL + gi*(groupW+16);
    const barsHTML = barDefs.map((def,bi) => {
      const v = d[def.key] || 0;
      const x = gx + bi*(bw+3);
      const color = def.color || (v >= 0 ? '#34D399' : '#EF4444');
      const bh = toH(v), by = toY(v);
      const labelY = v >= 0 ? by - 3 : by + bh + 8;
      return `<rect x="${x}" y="${by}" width="${bw}" height="${bh}" rx="2" fill="${color}"/>
        <text x="${x+bw/2}" y="${labelY}" text-anchor="middle" font-size="6.5" fill="${color}" font-weight="600">${fmtK(Math.abs(v))}</text>`;
    }).join('');
    return `${barsHTML}
      <text x="${gx+groupW/2}" y="${baseY+14}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#475569">${d.anno}</text>`;
  }).join('');
  const legend = barDefs.map((def,i)=>{
    const x = padL + i*80;
    const color = def.color || '#34D399';
    return `<rect x="${x}" y="${H+4}" width="9" height="9" rx="1.5" fill="${color}"/>
      <text x="${x+12}" y="${H+12}" font-size="7.5" fill="#64748B">${def.label}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H+20}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${W}px;">
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${baseY}" stroke="#E2E8F0"/>
    <line x1="${padL}" y1="${baseY}" x2="${W-padR}" y2="${baseY}" stroke="#E2E8F0"/>
    ${gridLines}${bars}${legend}
  </svg>`;
}

function svgWaterfall(items) {
  if (!items || items.length === 0) return '';
  const H = 170, padL = 52, padB = 38, padT = 16, padR = 8;
  const n = items.length;
  const bw = Math.min(30, (400 - padL - padR) / n - 6);
  const W = padL + n * (bw + 8) + padR;
  const allVals = items.map(it => it.type === 'total' ? it.value : it.value);
  const maxAbs = Math.max(...allVals.map(v => Math.abs(v)), 1);
  const scaleH = H - padT - padB;
  const midY = padT + scaleH / 2;
  const toH = v => Math.max(1, Math.abs(v) / maxAbs * scaleH / 2);
  let running = 0;
  const bars = items.map((item, i) => {
    const x = padL + i * (bw + 8);
    let barY, barH, color;
    if (item.type === 'start' || item.type === 'total') {
      const v = item.value;
      barY = v >= 0 ? midY - toH(v) : midY;
      barH = toH(v);
      color = item.type === 'total' ? (v >= 0 ? '#1D4ED8' : '#DC2626') : '#0F172A';
      running = item.value;
    } else {
      const base = running;
      running += item.value;
      if (item.value >= 0) {
        barY = midY - running / maxAbs * scaleH / 2;
        barH = toH(item.value);
      } else {
        barY = midY - base / maxAbs * scaleH / 2;
        barH = toH(item.value);
      }
      color = item.value >= 0 ? '#059669' : '#EF4444';
    }
    barH = Math.max(barH, 1);
    const valY = item.value >= 0 ? barY - 4 : barY + barH + 9;
    const lbx = x + bw/2, lby = H - padB + 13;
    const shortLabel = item.label.length > 7 ? item.label.substring(0,6)+'.' : item.label;
    return `<rect x="${x}" y="${barY}" width="${bw}" height="${barH}" rx="2" fill="${color}"/>
      <text x="${x+bw/2}" y="${valY}" text-anchor="middle" font-size="6.5" font-weight="700" fill="${color}">${fmtK(Math.abs(item.value))}</text>
      <text x="${lbx}" y="${lby}" text-anchor="end" font-size="7" fill="#64748B" transform="rotate(-40,${lbx},${lby})">${shortLabel}</text>`;
  });
  const gridLines = [-0.5,-0.25,0,0.25,0.5].map(lv => {
    const y = midY - lv * scaleH;
    if (y < padT || y > H - padB) return '';
    return `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="${lv===0?'#CBD5E1':'#F1F5F9'}" stroke-width="${lv===0?1:0.7}"/>
    <text x="${padL-4}" y="${y+3}" text-anchor="end" font-size="6.5" fill="#94A3B8">${fmtK(lv*maxAbs)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${W}px;">
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H-padB}" stroke="#E2E8F0"/>
    ${gridLines}
    ${bars.join('')}
  </svg>`;
}

// ── CALCOLA RATING MCC (Fondo di Garanzia PMI) ──
function calcMCC(c, d) {
  const vv = (x) => (!isNaN(x) && isFinite(x));

  // Esclusioni automatiche
  const exclusions = [];
  if ((d.tot_pn || 0) <= 0) exclusions.push('Patrimonio netto negativo o nullo — esclusione automatica');

  // 5 indicatori con peso
  const pfnPn = (d.tot_pn || 0) > 0 ? c.pfn / d.tot_pn : NaN;

  const items = [
    { nome: 'ROI — Redditività investimenti', disp: vv(c.roi) ? fp(c.roi) : 'n.d.', soglie: '≥0% / ≥4% / ≥8%', peso: 20,
      pts: vv(c.roi) ? (c.roi >= 8 ? 20 : c.roi >= 4 ? 14 : c.roi >= 0 ? 7 : 0) : 0 },
    { nome: 'EBITDA Margin — Marginalità operativa', disp: vv(c.ebitda_pct) ? fp(c.ebitda_pct) : 'n.d.', soglie: '≥3% / ≥8% / ≥15%', peso: 20,
      pts: vv(c.ebitda_pct) ? (c.ebitda_pct >= 15 ? 20 : c.ebitda_pct >= 8 ? 14 : c.ebitda_pct >= 3 ? 7 : 0) : 0 },
    { nome: 'Autonomia finanziaria — PN / Totale attivo', disp: vv(c.aut) ? fp(c.aut) : 'n.d.', soglie: '≥15% / ≥25% / ≥40%', peso: 25,
      pts: vv(c.aut) ? (c.aut >= 40 ? 25 : c.aut >= 25 ? 17 : c.aut >= 15 ? 9 : 0) : 0 },
    { nome: 'Current Ratio — Liquidità corrente', disp: vv(c.cr) ? fx(c.cr) : 'n.d.', soglie: '≥0.7x / ≥1.0x / ≥1.5x', peso: 20,
      pts: vv(c.cr) ? (c.cr >= 1.5 ? 20 : c.cr >= 1.0 ? 13 : c.cr >= 0.7 ? 6 : 0) : 0 },
    { nome: 'PFN / Patrimonio netto — Leva debitoria', disp: c.pfn <= 0 ? '< 0 ✓' : vv(pfnPn) ? fx(pfnPn) : 'n.d.', soglie: '≤4x / ≤2x / ≤1x', peso: 15,
      pts: c.pfn <= 0 ? 15 : vv(pfnPn) ? (pfnPn <= 1 ? 15 : pfnPn <= 2 ? 10 : pfnPn <= 4 ? 5 : 0) : 0 },
  ];

  const totalScore = items.reduce((s, i) => s + i.pts, 0);

  // Fascia MCC
  let fascia, fasciaLabel, fasciaColor, copertura, eligible;
  if (exclusions.length > 0 && (d.tot_pn || 0) <= 0) {
    fascia = 5; fasciaLabel = 'Non ammissibile'; fasciaColor = '#DC2626'; copertura = '—'; eligible = false;
  } else if (totalScore >= 75) {
    fascia = 1; fasciaLabel = 'Eccellente'; fasciaColor = '#047857'; copertura = 'fino all\'80%'; eligible = true;
  } else if (totalScore >= 55) {
    fascia = 2; fasciaLabel = 'Buona bancabilità'; fasciaColor = '#059669'; copertura = 'fino al 70%'; eligible = true;
  } else if (totalScore >= 35) {
    fascia = 3; fasciaLabel = 'Bancabilità media'; fasciaColor = '#2563EB'; copertura = 'fino al 60%'; eligible = true;
  } else if (totalScore >= 15) {
    fascia = 4; fasciaLabel = 'Bancabilità bassa'; fasciaColor = '#D97706'; copertura = 'fino al 40%'; eligible = true;
  } else {
    fascia = 5; fasciaLabel = 'Non ammissibile'; fasciaColor = '#DC2626'; copertura = '—'; eligible = false;
  }

  return { fascia, fasciaLabel, fasciaColor, totalScore, items, exclusions, copertura, eligible };
}

// ── NARRATIVE AUTOMATICA ──
function buildNarrative(c, d) {
  const parts = [];
  if (!isNaN(c.ebitda_pct)) {
    if (c.ebitda_pct >= 20) parts.push(`L'EBITDA margin del ${fp(c.ebitda_pct)} è eccellente, con forte capacità di generare cassa operativa.`);
    else if (c.ebitda_pct >= 10) parts.push(`L'EBITDA margin del ${fp(c.ebitda_pct)} è nella norma per il settore.`);
    else parts.push(`L'EBITDA margin del ${fp(c.ebitda_pct)} è contenuto: attenzione ai costi operativi.`);
  }
  if (!isNaN(c.cr)) {
    if (c.cr >= 1.5) parts.push(`La liquidità corrente (${fx(c.cr)}) garantisce ampi margini a breve.`);
    else if (c.cr >= 1.0) parts.push(`La liquidità corrente (${fx(c.cr)}) è sufficiente ma da monitorare.`);
    else parts.push(`La liquidità corrente (${fx(c.cr)}) è critica: rischio tensioni a breve.`);
  }
  if (!isNaN(c.aut)) {
    if (c.aut >= 40) parts.push(`Struttura patrimoniale solida: autonomia finanziaria ${fp(c.aut)}, oltre la soglia EBA del 30%.`);
    else if (c.aut >= 30) parts.push(`Autonomia finanziaria ${fp(c.aut)}: soddisfa le soglie EBA minime.`);
    else parts.push(`Autonomia finanziaria ${fp(c.aut)}: sotto soglia EBA del 30%.`);
  }
  if (!isNaN(c.dscr)) {
    if (c.dscr >= 1.25) parts.push(`DSCR ${fx(c.dscr)}: capacità di servire il debito ampiamente confermata.`);
    else if (c.dscr >= 1.0) parts.push(`DSCR ${fx(c.dscr)}: borderline rispetto alla soglia EBA di 1,25x.`);
    else parts.push(`DSCR ${fx(c.dscr)}: segnale di allerta EBA Stage 2 formale.`);
  }
  return parts.join(' ');
}

// ── BUILD MAIN HTML ──
function buildReportHTML(data, config) {
  const d = data;
  const c = calcIndici(d);
  const rating = calcRating(c, d);
  const mcc = calcMCC(c, d);
  const anno = config.anno || '2024';
  const nome = config.nome || d.nome || 'Azienda';
  const analista = config.analista || 'AnalisiEBusinessPlan.it';
  const dataReport = config.dataReport || new Date().toLocaleDateString('it-IT');
  const note = config.note || '';
  const colore = config.colore === 'green' ? '#059669' : config.colore === 'dark' ? '#1E293B' : '#1D4ED8';
  const narrative = buildNarrative(c, d);
  const d1 = data._prev || null;
  const c1 = d1 ? calcIndici(d1) : null;
  const annoPrev = d1 ? (parseInt(anno) - 1).toString() : null;
  const hasRF = !!(d.rf_a || d.rf_b || d.rf_c);

  // Prepara dati bar chart (anni multipli)
  const yearsData = [];
  if (d1) yearsData.push({ anno: annoPrev, ricavi: d1.ric_vend || d1.tot_vp || 0, ebitda: c1.ebitda, utile: d1.utile_es || 0 });
  yearsData.push({ anno, ricavi: d.ric_vend || d.tot_vp || 0, ebitda: c.ebitda, utile: d.utile_es || 0 });

  // Waterfall CE
  const wfItems = [
    { label: 'Ricavi', value: d.tot_vp || 0, type: 'start' },
    { label: 'Mat.prime', value: -Math.abs(d.mat_prime || 0), type: 'neg' },
    { label: 'Servizi', value: -Math.abs(d.servizi || 0), type: 'neg' },
    { label: 'Personale', value: -Math.abs(d.personale || 0), type: 'neg' },
    { label: 'EBITDA', value: c.ebitda, type: 'total' },
    { label: 'Ammort.', value: -Math.abs(d.ammort || 0), type: 'neg' },
    { label: 'On.fin.', value: -Math.abs(d.oneri_f || 0), type: 'neg' },
    { label: 'Imposte', value: -Math.abs(d.imposte || 0), type: 'neg' },
    { label: 'Utile/Perd.', value: d.utile_es || 0, type: 'total' },
  ].filter(i => i.value !== 0);

  const varPct = (curr, prev) => {
    if (!prev || prev === 0) return '';
    return ((curr - prev) / Math.abs(prev) * 100).toFixed(1) + '%';
  };
  const varCls = (curr, prev, lower = false) => {
    if (!prev) return '';
    return (lower ? curr <= prev : curr >= prev) ? 'pos' : 'neg';
  };

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@400;700&family=Inter:wght@300;400;500;600;700&display=swap');
  @page{size:A4;margin:0;}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Inter',sans-serif;color:#0F172A;background:#fff;font-size:11px;line-height:1.5;}
  .cover{width:210mm;min-height:297mm;background:#0A1628;color:#fff;padding:52px 48px;display:flex;flex-direction:column;justify-content:space-between;page-break-after:always;position:relative;overflow:hidden;}
  .cover::before{content:'';position:absolute;top:0;right:0;width:55%;height:100%;background:linear-gradient(135deg,transparent 0%,#1E3A5F 50%,#0E2A4A 100%);clip-path:polygon(20% 0%,100% 0%,100% 100%,0% 100%);}
  .cv-brand{font-size:10px;color:rgba(255,255,255,.35);letter-spacing:.18em;text-transform:uppercase;margin-bottom:80px;position:relative;z-index:1;}
  .cv-tipo{font-size:10px;color:#60A5FA;text-transform:uppercase;letter-spacing:.12em;margin-bottom:16px;position:relative;z-index:1;}
  .cv-nome{font-family:'Fraunces',serif;font-size:36px;font-weight:700;line-height:1.05;margin-bottom:8px;position:relative;z-index:1;}
  .cv-sub{font-size:13px;color:rgba(255,255,255,.5);margin-bottom:36px;position:relative;z-index:1;}
  .cv-chip{display:inline-flex;align-items:center;gap:20px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:18px 26px;position:relative;z-index:1;}
  .cv-r-letter{font-family:'Fraunces',serif;font-size:58px;font-weight:700;color:${rating.color};line-height:1;}
  .cv-kpi-strip{display:flex;gap:0;border:1px solid rgba(255,255,255,.12);border-radius:10px;overflow:hidden;margin-bottom:20px;position:relative;z-index:1;}
  .cv-kpi-item{flex:1;padding:10px 14px;border-right:1px solid rgba(255,255,255,.08);}
  .cv-kpi-item:last-child{border-right:none;}
  .cv-kpi-lbl{font-size:8px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px;}
  .cv-kpi-v{font-family:'Fraunces',serif;font-size:16px;font-weight:700;color:#fff;}
  .cv-r-lbl{font-size:9px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;}
  .cv-r-title{font-size:14px;font-weight:600;}
  .cv-divider{height:1px;background:rgba(255,255,255,.08);margin:34px 0;position:relative;z-index:1;}
  .cv-meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:22px;position:relative;z-index:1;}
  .cv-meta-lbl{font-size:9px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px;}
  .cv-meta-val{font-size:13px;font-weight:500;}
  .cv-footer{font-size:9px;color:rgba(255,255,255,.2);position:relative;z-index:1;margin-top:36px;}

  .page{width:210mm;padding:34px 42px 46px;page-break-after:always;min-height:297mm;display:flex;flex-direction:column;}
  .page:last-child{page-break-after:avoid;}
  .ph{border-bottom:2px solid ${colore};padding-bottom:10px;margin-bottom:20px;display:flex;align-items:flex-end;justify-content:space-between;}
  .ph-ey{font-size:9px;font-weight:700;color:${colore};text-transform:uppercase;letter-spacing:.12em;margin-bottom:3px;}
  .ph-ti{font-family:'Fraunces',serif;font-size:20px;font-weight:700;}
  .ph-az{font-size:10px;color:#64748B;text-align:right;line-height:1.6;}
  .pf{display:flex;justify-content:space-between;font-size:8px;color:#94A3B8;border-top:.5px solid #E2E8F0;padding-top:7px;margin-top:auto;}

  .kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:12px;}
  .kpi-box{background:#F8FAFC;border:1px solid #E2E8F0;border-left:3px solid #E2E8F0;border-radius:9px;padding:12px 10px;}
  .kpi-lbl{font-size:7.5px;color:#64748B;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;}
  .kpi-val{font-size:16px;font-weight:700;line-height:1;}
  .pos{color:#059669;}.neg{color:#DC2626;}.neu{color:#1D4ED8;}.warn{color:#D97706;}

  .narr{background:#F0F9FF;border:1px solid #BAE6FD;border-left:4px solid #2563EB;border-radius:0 9px 9px 0;padding:12px 14px;margin-bottom:12px;}
  .narr-t{font-size:9px;font-weight:700;color:#0369A1;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;}
  .narr-b{font-size:9.5px;color:#0F172A;line-height:1.75;}

  .sem-list{display:flex;flex-direction:column;gap:5px;margin-bottom:12px;}
  .sem-item{display:flex;align-items:center;gap:9px;padding:7px 11px;background:#F8FAFC;border-radius:7px;border-left:3px solid transparent;}
  .sem-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
  .sem-name{flex:1;font-size:9.5px;color:#475569;font-weight:500;}
  .sem-val{font-size:10px;font-weight:700;}

  /* CHARTS */
  .charts-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;}
  .chart-box{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:9px;padding:12px;}
  .chart-title{font-size:8.5px;font-weight:700;color:#0F172A;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px;text-align:center;}
  .chart-full{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:9px;padding:12px;margin-bottom:14px;}

  table{width:100%;border-collapse:collapse;font-size:9.5px;margin-bottom:14px;}
  thead th{background:#0F172A;color:#fff;padding:7px 9px;text-align:left;font-weight:600;font-size:8.5px;letter-spacing:.03em;}
  thead th.r{text-align:right;}
  tbody td{padding:5px 9px;border-bottom:.5px solid #F1F5F9;}
  tbody td.r{text-align:right;font-variant-numeric:tabular-nums;}
  tr.sub td{color:#64748B;padding-left:18px;font-size:9px;}
  tr.tot td{background:#F8FAFC;font-weight:700;}
  tr.tot-main td{background:#0F172A;color:#fff;font-weight:700;}
  tr.ebitda-row td{background:#ECFDF5;font-weight:700;color:#059669;}

  .ind-hd{font-size:9px;font-weight:700;color:#fff;background:${colore};padding:6px 11px;border-radius:5px 5px 0 0;text-transform:uppercase;letter-spacing:.08em;margin-bottom:0;}
  .ind-cards{display:grid;grid-template-columns:1fr 1fr;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 6px 6px;overflow:hidden;margin-bottom:14px;}
  .ind-card{padding:11px;border-right:.5px solid #E2E8F0;border-bottom:.5px solid #E2E8F0;}
  .ind-card:nth-child(2n){border-right:none;}
  .ind-card-full{grid-column:1/-1;}
  .ind-name{font-size:9.5px;font-weight:700;color:#0F172A;margin-bottom:1px;}
  .ind-acro{font-size:8px;color:#94A3B8;margin-bottom:5px;}
  .ind-val{font-size:20px;font-weight:700;line-height:1;margin-bottom:3px;}
  .ind-badge{font-size:7.5px;font-weight:700;padding:2px 6px;border-radius:3px;display:inline-block;margin-bottom:4px;}
  .ind-progress{height:3px;background:#E2E8F0;border-radius:2px;margin:5px 0;overflow:hidden;}
  .ind-progress-fill{height:100%;border-radius:2px;}
  .ib-g{background:#ECFDF5;color:#059669;}.ib-r{background:#FEF2F2;color:#DC2626;}.ib-a{background:#FFFBEB;color:#D97706;}
  .ind-formula{font-size:7.5px;color:#1D4ED8;background:#EFF6FF;border-radius:3px;padding:2px 6px;font-family:monospace;margin-bottom:5px;display:inline-block;}
  .ind-bench{font-size:7.5px;color:#64748B;margin-bottom:4px;}
  .ind-bench span{font-weight:600;color:#0F172A;}
  .ind-desc{font-size:8.5px;color:#475569;line-height:1.6;}
  .ind-interp{font-size:8.5px;color:#475569;line-height:1.6;margin-top:4px;padding-top:4px;border-top:.5px solid #F1F5F9;}
  .ind-action{font-size:8px;color:#1D4ED8;line-height:1.5;margin-top:5px;padding:5px 7px;background:#EFF6FF;border-radius:4px;border-left:2px solid #3B82F6;}
  .ind-intro{font-size:9px;color:#334155;line-height:1.7;padding:10px 12px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px 6px 0 0;margin-bottom:0;}

  .banc-intro{font-size:9px;color:#475569;line-height:1.7;margin-bottom:12px;padding:9px 12px;background:#F8FAFC;border-left:3px solid ${colore};border-radius:0 5px 5px 0;}
  .banc-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;}
  .banc-box{border:1px solid #E2E8F0;border-radius:9px;padding:12px;}
  .banc-name{font-size:9.5px;font-weight:700;color:#0F172A;margin-bottom:1px;}
  .banc-acro{font-size:8px;color:#94A3B8;margin-bottom:3px;}
  .banc-formula{font-size:7.5px;color:#1D4ED8;background:#EFF6FF;border-radius:3px;padding:2px 6px;font-family:monospace;margin-bottom:6px;display:inline-block;}
  .banc-val{font-size:22px;font-weight:700;margin-bottom:3px;}
  .banc-verdict{font-size:8px;font-weight:700;padding:2px 7px;border-radius:3px;display:inline-block;margin-bottom:7px;}
  .bv-g{background:#ECFDF5;color:#059669;}.bv-a{background:#FFFBEB;color:#D97706;}.bv-r{background:#FEF2F2;color:#DC2626;}.bv-0{background:#F8FAFC;color:#64748B;}
  .bar-track{height:4px;background:#F1F5F9;border-radius:3px;overflow:hidden;margin-bottom:6px;}
  .bar-fill{height:100%;border-radius:3px;}
  .banc-desc{font-size:8.5px;color:#475569;line-height:1.6;margin-top:6px;padding-top:6px;border-top:.5px solid #F1F5F9;}

  .rf-box{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:9px;padding:11px;margin-bottom:9px;}
  .rf-title{font-size:8.5px;font-weight:700;color:${colore};text-transform:uppercase;letter-spacing:.07em;margin-bottom:7px;}
  .rf-row{display:flex;justify-content:space-between;font-size:9.5px;padding:3px 0;border-bottom:.5px solid #E2E8F0;}
  .rf-row:last-child{border:none;}
  .rf-lbl{color:#64748B;}
  .rf-tot{display:flex;justify-content:space-between;background:#0F172A;color:#fff;border-radius:7px;padding:8px 12px;margin-top:6px;font-weight:700;font-size:10px;}
  .rf-2col{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:9px;}
  .rf-kpi{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:7px;padding:10px;}
  .rf-kpi-lbl{font-size:8px;color:#64748B;text-transform:uppercase;margin-bottom:3px;}
  .rf-kpi-val{font-size:17px;font-weight:700;}

  .rating-center{text-align:center;padding:16px 20px 12px;}
  .r-letter{font-family:'Fraunces',serif;font-size:80px;font-weight:700;color:${rating.color};line-height:1;}
  .r-title{font-family:'Fraunces',serif;font-size:18px;font-weight:700;color:#0F172A;margin:7px 0 5px;}
  .r-desc{font-size:11px;color:#475569;max-width:380px;margin:0 auto;line-height:1.75;}
  .rating-scale{display:flex;border:1px solid #E2E8F0;border-radius:7px;overflow:hidden;margin:12px 0;}
  .rs-item{flex:1;text-align:center;padding:6px 2px;}
  .rs-letter{font-family:'Fraunces',serif;font-size:15px;font-weight:700;line-height:1;margin-bottom:1px;}
  .rs-lbl{font-size:7px;color:#64748B;}
  .rs-active{background:#0F172A;}
  .rs-active .rs-letter{color:${rating.color};}
  .rs-active .rs-lbl{color:rgba(255,255,255,.6);}
  .score-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;background:#0F172A;border-radius:7px 7px 0 0;}
  .score-grid div{padding:6px 8px;color:#fff;font-size:8px;font-weight:700;text-align:right;}
  .score-grid div:first-child{text-align:left;}
  .score-row{display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;border-bottom:.5px solid #F1F5F9;}
  .score-row div{padding:4.5px 8px;font-size:9px;text-align:right;font-variant-numeric:tabular-nums;}
  .score-row div:first-child{text-align:left;color:#475569;font-weight:500;}
  .score-row.hi div{background:#F8FAFC;font-weight:700;}
  .score-table{border:1px solid #E2E8F0;border-radius:7px;overflow:hidden;margin-bottom:12px;}
  .zscore-box{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:9px;padding:12px;margin-bottom:12px;}
  .zscore-title{font-size:8.5px;font-weight:700;color:#0F172A;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;}
  .trigger-box{border-radius:7px;padding:10px 12px;margin-bottom:10px;}
  .trigger-box.ok{background:#ECFDF5;border:1px solid #A7F3D0;}
  .trigger-box.warn{background:#FFFBEB;border:1px solid #FDE68A;}
  .trigger-box.alert{background:#FEF2F2;border:1px solid #FECACA;}
  .trigger-title{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px;}
  .trigger-item{font-size:9px;padding:2.5px 0;border-bottom:.5px solid rgba(0,0,0,.06);}
  .trigger-item:last-child{border:none;}
  .note-box{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:9px;padding:12px;margin-bottom:10px;}
  .note-title{font-size:8.5px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px;}
  .note-text{font-size:9.5px;color:#334155;line-height:1.8;}
  .disclaimer{font-size:7.5px;color:#94A3B8;line-height:1.6;border-top:1px solid #F1F5F9;padding-top:8px;margin-top:8px;}

  /* MCC */
  .mcc-header{background:#0A1628;color:#fff;border-radius:9px 9px 0 0;padding:14px 18px;margin-bottom:0;}
  .mcc-header-top{font-size:8px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px;}
  .mcc-header-title{font-family:'Fraunces',serif;font-size:16px;font-weight:700;}
  .mcc-intro{font-size:8.5px;color:#475569;line-height:1.7;padding:10px 14px;background:#F8FAFC;border:1px solid #E2E8F0;border-top:none;margin-bottom:14px;}
  .mcc-main{display:grid;grid-template-columns:200px 1fr;gap:16px;margin-bottom:14px;}
  .mcc-fascia-box{display:flex;flex-direction:column;align-items:center;justify-content:center;border:2px solid;border-radius:12px;padding:18px 12px;text-align:center;}
  .mcc-fascia-num{font-family:'Fraunces',serif;font-size:52px;font-weight:700;line-height:1;}
  .mcc-fascia-lbl{font-size:10px;font-weight:700;margin-top:4px;}
  .mcc-fascia-sub{font-size:8.5px;color:#64748B;margin-top:3px;}
  .mcc-fascia-copertura{font-size:8px;font-weight:600;padding:4px 10px;border-radius:12px;margin-top:10px;}
  .mcc-scale{display:flex;flex-direction:column;gap:5px;}
  .mcc-scale-item{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;border:1px solid #E2E8F0;}
  .mcc-scale-item.active{border-width:2px;}
  .mcc-scale-num{font-family:'Fraunces',serif;font-size:18px;font-weight:700;width:24px;text-align:center;}
  .mcc-scale-info{flex:1;}
  .mcc-scale-name{font-size:9px;font-weight:700;color:#0F172A;}
  .mcc-scale-cov{font-size:7.5px;color:#64748B;}
  .mcc-score-table{border:1px solid #E2E8F0;border-radius:7px;overflow:hidden;margin-bottom:12px;}
  .mcc-score-hd{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;background:#0A1628;color:#fff;font-size:8px;font-weight:700;}
  .mcc-score-hd div{padding:6px 9px;}
  .mcc-score-hd div:not(:first-child){text-align:right;}
  .mcc-score-row{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;}
  .mcc-score-row div{padding:5px 9px;font-size:9px;border-bottom:.5px solid #F1F5F9;}
  .mcc-score-row div:not(:first-child){text-align:right;font-variant-numeric:tabular-nums;}
  .mcc-score-row.alt{background:#F8FAFC;}
  .mcc-score-row.total{background:#F0F9FF;}
  .mcc-score-row.total div{font-weight:700;color:#0369A1;font-size:9.5px;}
  .mcc-excl{background:#FEF2F2;border:1px solid #FECACA;border-radius:7px;padding:10px 12px;margin-bottom:10px;}
  .mcc-excl-title{font-size:8.5px;font-weight:700;color:#DC2626;text-transform:uppercase;margin-bottom:5px;}
  .mcc-excl-item{font-size:9px;color:#991B1B;padding:2px 0;}
</style>
</head>
<body>

<!-- COPERTINA -->
<div class="cover">
  <div style="position:relative;z-index:1;">
    <div class="cv-brand">AnalisiEBusinessPlan.it — Software professionale di analisi bilancio</div>
    <div class="cv-tipo">Analisi di Bilancio d'Esercizio</div>
    <div class="cv-nome">${nome}</div>
    <div class="cv-sub">Esercizio chiuso al 31/12/${anno}</div>
    <div class="cv-chip">
      <div class="cv-r-letter">${rating.l}</div>
      <div><div class="cv-r-lbl">Rating sintetico di bancabilità</div><div class="cv-r-title">${rating.title}</div></div>
    </div>
  </div>
  <div style="position:relative;z-index:1;">
    <div class="cv-divider"></div>
    <div class="cv-meta">
      <div><div class="cv-meta-lbl">Esercizio</div><div class="cv-meta-val">${anno}</div></div>
      <div><div class="cv-meta-lbl">Analista</div><div class="cv-meta-val">${analista}</div></div>
      <div><div class="cv-meta-lbl">Data report</div><div class="cv-meta-val">${dataReport}</div></div>
    </div>
    <div class="cv-kpi-strip">
      <div class="cv-kpi-item"><div class="cv-kpi-lbl">EBITDA %</div><div class="cv-kpi-v">${fp(c.ebitda_pct)}</div></div>
      <div class="cv-kpi-item"><div class="cv-kpi-lbl">Autonomia fin.</div><div class="cv-kpi-v">${fp(c.aut)}</div></div>
      <div class="cv-kpi-item"><div class="cv-kpi-lbl">DSCR</div><div class="cv-kpi-v">${isNaN(c.dscr)?'—':fx(c.dscr)}</div></div>
      <div class="cv-kpi-item"><div class="cv-kpi-lbl">ROI</div><div class="cv-kpi-v">${fp(c.roi)}</div></div>
      <div class="cv-kpi-item"><div class="cv-kpi-lbl">PFN/EBITDA</div><div class="cv-kpi-v">${(!isNaN(c.pfn_ebitda)&&c.pfn_ebitda>0)?fx(c.pfn_ebitda):(c.pfn<=0?'< 0':'—')}</div></div>
    </div>
    <div class="cv-footer">Documento riservato · AnalisiEBusinessPlan.it · Rating: Z'-Score Altman PMI (30%) + Scorecard EBA/GL/2020/06 (70%) + Trigger CCII</div>
  </div>
</div>

<!-- PAG 2: EXECUTIVE SUMMARY + GRAFICI -->
<div class="page">
  <div class="ph">
    <div><div class="ph-ey">Sezione 1</div><div class="ph-ti">Executive Summary</div></div>
    <div class="ph-az">${nome}<br/>${anno}</div>
  </div>
  <div class="kpi-row">
    <div class="kpi-box" style="border-left-color:#1D4ED8"><div class="kpi-lbl">Valore produzione</div><div class="kpi-val neu">${fmt(d.tot_vp)}</div>${d1?`<div style="font-size:8px;margin-top:3px;color:${(d.tot_vp||0)>=(d1.tot_vp||0)?'#059669':'#DC2626'}">${varPct(d.tot_vp,d1.tot_vp)?((d.tot_vp||0)>=(d1.tot_vp||0)?'▲ ':'▼ ')+varPct(d.tot_vp,d1.tot_vp):''}</div>`:''}</div>
    <div class="kpi-box" style="border-left-color:${c.ebitda>=0?'#059669':'#DC2626'}"><div class="kpi-lbl">EBITDA</div><div class="kpi-val ${c.ebitda>=0?'pos':'neg'}">${fmt(c.ebitda)}</div>${d1?`<div style="font-size:8px;margin-top:3px;color:${c.ebitda>=c1.ebitda?'#059669':'#DC2626'}">${varPct(c.ebitda,c1.ebitda)?(c.ebitda>=c1.ebitda?'▲ ':'▼ ')+varPct(c.ebitda,c1.ebitda):''}</div>`:''}</div>
    <div class="kpi-box" style="border-left-color:${(d.utile_es||0)>=0?'#059669':'#DC2626'}"><div class="kpi-lbl">Utile / Perdita</div><div class="kpi-val ${(d.utile_es||0)>=0?'pos':'neg'}">${fmt(d.utile_es)}</div>${d1?`<div style="font-size:8px;margin-top:3px;color:${(d.utile_es||0)>=(d1.utile_es||0)?'#059669':'#DC2626'}">${varPct(d.utile_es,d1.utile_es)?((d.utile_es||0)>=(d1.utile_es||0)?'▲ ':'▼ ')+varPct(d.utile_es,d1.utile_es):''}</div>`:''}</div>
    <div class="kpi-box" style="border-left-color:#1D4ED8"><div class="kpi-lbl">Totale attivo</div><div class="kpi-val">${fmt(d.tot_att)}</div>${d1?`<div style="font-size:8px;margin-top:3px;color:${(d.tot_att||0)>=(d1.tot_att||0)?'#059669':'#DC2626'}">${varPct(d.tot_att,d1.tot_att)?((d.tot_att||0)>=(d1.tot_att||0)?'▲ ':'▼ ')+varPct(d.tot_att,d1.tot_att):''}</div>`:''}</div>
  </div>
  <div class="kpi-row">
    <div class="kpi-box" style="border-left-color:${(d.tot_pn||0)>0?'#059669':'#DC2626'}"><div class="kpi-lbl">Patrimonio netto</div><div class="kpi-val pos">${fmt(d.tot_pn)}</div>${d1?`<div style="font-size:8px;margin-top:3px;color:${(d.tot_pn||0)>=(d1.tot_pn||0)?'#059669':'#DC2626'}">${varPct(d.tot_pn,d1.tot_pn)?((d.tot_pn||0)>=(d1.tot_pn||0)?'▲ ':'▼ ')+varPct(d.tot_pn,d1.tot_pn):''}</div>`:''}</div>
    <div class="kpi-box" style="border-left-color:${c.pfn<=0?'#059669':'#D97706'}"><div class="kpi-lbl">PFN</div><div class="kpi-val ${c.pfn<=0?'pos':'warn'}">${fmt(c.pfn)}</div>${d1?`<div style="font-size:8px;margin-top:3px;color:${c.pfn<=c1.pfn?'#059669':'#DC2626'}">${varPct(c.pfn,c1.pfn)?(c.pfn<=c1.pfn?'▼ ':'▲ ')+varPct(c.pfn,c1.pfn):''}</div>`:''}</div>
    <div class="kpi-box" style="border-left-color:${c.ebitda_pct>=15?'#059669':c.ebitda_pct>=5?'#D97706':'#DC2626'}"><div class="kpi-lbl">EBITDA margin</div><div class="kpi-val ${c.ebitda_pct>=15?'pos':c.ebitda_pct>=5?'warn':'neg'}">${fp(c.ebitda_pct)}</div>${d1?`<div style="font-size:8px;margin-top:3px;color:${c.ebitda_pct>=c1.ebitda_pct?'#059669':'#DC2626'}">${varPct(c.ebitda_pct,c1.ebitda_pct)?(c.ebitda_pct>=c1.ebitda_pct?'▲ ':'▼ ')+varPct(c.ebitda_pct,c1.ebitda_pct):''}</div>`:''}</div>
    <div class="kpi-box" style="border-left-color:${c.aut>=30?'#059669':c.aut>=15?'#D97706':'#DC2626'}"><div class="kpi-lbl">Autonomia fin.</div><div class="kpi-val ${c.aut>=30?'pos':c.aut>=15?'warn':'neg'}">${fp(c.aut)}</div>${d1?`<div style="font-size:8px;margin-top:3px;color:${c.aut>=c1.aut?'#059669':'#DC2626'}">${varPct(c.aut,c1.aut)?(c.aut>=c1.aut?'▲ ':'▼ ')+varPct(c.aut,c1.aut):''}</div>`:''}</div>
  </div>
  ${narrative?`<div class="narr"><div class="narr-t">📋 Commento sintetico</div><div class="narr-b">${narrative}</div></div>`:''}

  <!-- GRAFICI: Gauge + Radar -->
  <div class="charts-row">
    <div class="chart-box">
      <div class="chart-title">Rating di Bancabilità</div>
      ${svgGauge(rating.l, rating.color)}
    </div>
    <div class="chart-box">
      <div class="chart-title">Radar — Profilo Finanziario</div>
      ${svgRadar(rating.radarScores)}
    </div>
  </div>

  <div class="sem-list">
    ${[
      ['Liquidità corrente (Current Ratio)', c.cr, fx(c.cr), semColor(c.cr,1.5,1.0)],
      ['Redditività capitale proprio (ROE)', c.roe, fp(c.roe), semColor(c.roe,10,5)],
      ['Solidità patrimoniale (Autonomia fin.)', c.aut, fp(c.aut), semColor(c.aut,30,15)],
      ['Indebitamento (Leva D/E)', c.leva, fx(c.leva), semColor(c.leva,2,4,false)],
      ['Bancabilità (DSCR)', c.dscr, isNaN(c.dscr)?'n.d.':fx(c.dscr), semColor(c.dscr,1.25,1.0)],
      ['Redditività operativa (ROI)', c.roi, fp(c.roi), semColor(c.roi,8,3)],
    ].map(([name,,val,color])=>`
    <div class="sem-item" style="border-left-color:${color}">
      <div class="sem-dot" style="background:${color}"></div>
      <span class="sem-name">${name}</span>
      <span class="sem-val" style="color:${color}">${val}</span>
    </div>`).join('')}
  </div>
  <div class="pf"><span>AnalisiEBusinessPlan.it</span><span>${nome} — ${anno}</span><span>Pag. 2</span></div>
</div>

<!-- PAG 3: STATO PATRIMONIALE -->
<div class="page">
  <div class="ph">
    <div><div class="ph-ey">Sezione 2</div><div class="ph-ti">Stato Patrimoniale Riclassificato</div></div>
    <div class="ph-az">${nome}<br/>${anno}${d1?` vs ${annoPrev}`:''}</div>
  </div>
  <table>
    <thead><tr><th>Voce</th><th class="r">${anno}</th>${d1?`<th class="r">${annoPrev}</th><th class="r">Var%</th>`:''}</tr></thead>
    <tbody>
      <tr class="tot"><td>B) Immobilizzazioni</td><td class="r">${fmt(d.tot_imm)}</td>${d1?`<td class="r">${fmt(d1.tot_imm)}</td><td class="r ${varCls(d.tot_imm,d1.tot_imm)}">${varPct(d.tot_imm,d1.tot_imm)}</td>`:''}</tr>
      <tr class="sub"><td>Immobilizzazioni immateriali</td><td class="r">${fmt(d.imm_imm)}</td>${d1?`<td class="r">${fmt(d1.imm_imm)}</td><td></td>`:''}</tr>
      <tr class="sub"><td>Immobilizzazioni materiali</td><td class="r">${fmt(d.imm_mat)}</td>${d1?`<td class="r">${fmt(d1.imm_mat)}</td><td></td>`:''}</tr>
      <tr class="sub"><td>Immobilizzazioni finanziarie</td><td class="r">${fmt(d.imm_fin)}</td>${d1?`<td class="r">${fmt(d1.imm_fin)}</td><td></td>`:''}</tr>
      <tr class="tot"><td>C) Attivo circolante</td><td class="r">${fmt(d.tot_circ)}</td>${d1?`<td class="r">${fmt(d1.tot_circ)}</td><td class="r ${varCls(d.tot_circ,d1.tot_circ)}">${varPct(d.tot_circ,d1.tot_circ)}</td>`:''}</tr>
      <tr class="sub"><td>Rimanenze</td><td class="r">${fmt(d.rimanenze)}</td>${d1?`<td class="r">${fmt(d1.rimanenze)}</td><td></td>`:''}</tr>
      <tr class="sub"><td>Crediti verso clienti</td><td class="r">${fmt(d.cred_cl)}</td>${d1?`<td class="r">${fmt(d1.cred_cl)}</td><td></td>`:''}</tr>
      <tr class="sub"><td>Disponibilità liquide</td><td class="r">${fmt(d.liquidita)}</td>${d1?`<td class="r">${fmt(d1.liquidita)}</td><td></td>`:''}</tr>
      <tr class="tot-main"><td>TOTALE ATTIVO</td><td class="r">${fmt(d.tot_att)}</td>${d1?`<td class="r">${fmt(d1.tot_att)}</td><td class="r ${varCls(d.tot_att,d1.tot_att)}">${varPct(d.tot_att,d1.tot_att)}</td>`:''}</tr>
      <tr class="tot"><td>A) Patrimonio netto</td><td class="r">${fmt(d.tot_pn)}</td>${d1?`<td class="r">${fmt(d1.tot_pn)}</td><td class="r ${varCls(d.tot_pn,d1.tot_pn)}">${varPct(d.tot_pn,d1.tot_pn)}</td>`:''}</tr>
      <tr class="sub"><td>Capitale sociale</td><td class="r">${fmt(d.cap_sociale)}</td>${d1?`<td class="r">${fmt(d1.cap_sociale)}</td><td></td>`:''}</tr>
      <tr class="sub"><td>Utile / Perdita esercizio</td><td class="r ${(d.utile_es||0)>=0?'pos':'neg'}">${fmt(d.utile_es)}</td>${d1?`<td class="r">${fmt(d1.utile_es)}</td><td></td>`:''}</tr>
      <tr class="tot"><td>D) Debiti totali</td><td class="r">${fmt(d.tot_deb)}</td>${d1?`<td class="r">${fmt(d1.tot_deb)}</td><td class="r ${varCls(d.tot_deb,d1.tot_deb,true)}">${varPct(d.tot_deb,d1.tot_deb)}</td>`:''}</tr>
      <tr class="sub"><td>Debiti verso banche (bt+lt)</td><td class="r">${fmt((d.deb_b_bt||0)+(d.deb_b_lt||0))}</td>${d1?`<td class="r">${fmt((d1.deb_b_bt||0)+(d1.deb_b_lt||0))}</td><td></td>`:''}</tr>
      <tr class="sub"><td>Debiti verso fornitori</td><td class="r">${fmt(d.deb_for)}</td>${d1?`<td class="r">${fmt(d1.deb_for)}</td><td></td>`:''}</tr>
      <tr class="tot-main"><td>TOTALE PASSIVO</td><td class="r">${fmt(d.tot_att)}</td>${d1?`<td class="r">${fmt(d1.tot_att)}</td><td></td>`:''}</tr>
    </tbody>
  </table>
  <div class="pf"><span>AnalisiEBusinessPlan.it</span><span>${nome} — ${anno}</span><span>Pag. 3</span></div>
</div>

<!-- PAG 4: CONTO ECONOMICO + WATERFALL -->
<div class="page">
  <div class="ph">
    <div><div class="ph-ey">Sezione 3</div><div class="ph-ti">Conto Economico Riclassificato</div></div>
    <div class="ph-az">${nome}<br/>${anno}${d1?` vs ${annoPrev}`:''}</div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start;">
    <table style="margin-bottom:0;">
      <thead><tr><th>Voce</th><th class="r">${anno}</th>${d1?`<th class="r">Var%</th>`:''}</tr></thead>
      <tbody>
        <tr class="tot"><td>A) Valore produzione</td><td class="r">${fmt(d.tot_vp)}</td>${d1?`<td class="r ${varCls(d.tot_vp,d1.tot_vp)}">${varPct(d.tot_vp,d1.tot_vp)}</td>`:''}</tr>
        <tr class="sub"><td>Ricavi delle vendite</td><td class="r">${fmt(d.ric_vend)}</td>${d1?`<td class="r ${varCls(d.ric_vend,d1.ric_vend)}">${varPct(d.ric_vend,d1.ric_vend)}</td>`:''}</tr>
        <tr class="sub"><td>Altri ricavi</td><td class="r">${fmt(d.alt_ric)}</td>${d1?`<td class="r"></td>`:''}</tr>
        <tr class="tot"><td>B) Costi produzione</td><td class="r">${fmt(d.tot_cos)}</td>${d1?`<td class="r ${varCls(d.tot_cos,d1.tot_cos,true)}">${varPct(d.tot_cos,d1.tot_cos)}</td>`:''}</tr>
        <tr class="sub"><td>Materie prime</td><td class="r">${fmt(d.mat_prime)}</td>${d1?`<td class="r"></td>`:''}</tr>
        <tr class="sub"><td>Servizi</td><td class="r">${fmt(d.servizi)}</td>${d1?`<td class="r"></td>`:''}</tr>
        <tr class="sub"><td>Personale</td><td class="r">${fmt(d.personale)}</td>${d1?`<td class="r"></td>`:''}</tr>
        <tr class="sub"><td>Ammortamenti</td><td class="r">${fmt(d.ammort)}</td>${d1?`<td class="r"></td>`:''}</tr>
        <tr class="ebitda-row"><td><strong>EBITDA</strong></td><td class="r">${fmt(c.ebitda)}</td>${d1?`<td class="r ${varCls(c.ebitda,c1.ebitda)}">${varPct(c.ebitda,c1.ebitda)}</td>`:''}</tr>
        <tr class="sub"><td>EBITDA margin</td><td class="r">${fp(c.ebitda_pct)}</td>${d1?`<td class="r"></td>`:''}</tr>
        <tr><td>EBIT</td><td class="r ${c.ebit>=0?'pos':'neg'}">${fmt(c.ebit)}</td>${d1?`<td class="r"></td>`:''}</tr>
        <tr><td>Oneri finanziari</td><td class="r neg">−${fmt(d.oneri_f)}</td>${d1?`<td class="r"></td>`:''}</tr>
        <tr><td>Imposte</td><td class="r neg">−${fmt(d.imposte)}</td>${d1?`<td class="r"></td>`:''}</tr>
        <tr class="tot-main"><td>UTILE / PERDITA</td><td class="r ${(d.utile_es||0)>=0?'pos':'neg'}">${fmt(d.utile_es)}</td>${d1?`<td class="r ${varCls(d.utile_es,d1.utile_es)}">${varPct(d.utile_es,d1.utile_es)}</td>`:''}</tr>
      </tbody>
    </table>
    <div>
      <div class="chart-box" style="margin-bottom:12px;">
        <div class="chart-title">Confronto ricavi/EBITDA/utile${d1?' (anni)':''}</div>
        ${svgBarChart(yearsData)}
      </div>
      <div class="chart-box">
        <div class="chart-title">Waterfall — Da ricavi a utile</div>
        ${svgWaterfall(wfItems)}
      </div>
    </div>
  </div>
  <div class="pf"><span>AnalisiEBusinessPlan.it</span><span>${nome} — ${anno}</span><span>Pag. 4</span></div>
</div>

<!-- PAG 5: INDICI DETTAGLIATI -->
<div class="page">
  <div class="ph">
    <div><div class="ph-ey">Sezione 4</div><div class="ph-ti">Indici di Bilancio — Redditività e Liquidità</div></div>
    <div class="ph-az">${nome}<br/>${anno}</div>
  </div>
  <div class="ind-intro">Gli <strong>indici di redditività</strong> misurano la capacità dell'azienda di generare profitto in relazione alle risorse impiegate. Sono gli indicatori più osservati da soci, investitori e banche per valutare la qualità del business e la sostenibilità nel tempo. Un'azienda redditizia non è necessariamente liquida, ma un'azienda strutturalmente in perdita non è finanziabile.</div>
  <div class="ind-hd">📊 Indici di Redditività</div>
  <div class="ind-cards">
    ${[
      ['Return on Equity','ROE',c.roe,fp(c.roe),c.roe>=10,c.roe>=5,
       'ROE = Utile Netto / Patrimonio Netto × 100',`> 5%`,`> 10%`,
       'Misura la redditività del capitale proprio: quanti euro di utile netto produce ogni 100€ investito dai soci. È il principale indicatore di convenienza per i soci rispetto ad investimenti alternativi (es. BTP, fondi).',
       c.roe>=10?`Ottimo (${fp(c.roe)}): i soci ottengono un rendimento eccellente, superiore alla media PMI italiana.`:c.roe>=5?`Sufficiente (${fp(c.roe)}): nella media PMI italiane. Verificare se il trend è in crescita.`:c.roe>=0?`Basso (${fp(c.roe)}): rendimento insufficiente rispetto al rischio imprenditoriale.`:`Negativo (${fp(c.roe)}): perdita d'esercizio. Analizzare se straordinaria o strutturale.`,
       c.roe>=10?'Mantenere la gestione attuale. Valutare distribuzione dividendi o reinvestimento per crescita.':c.roe>=5?'Lavorare su riduzione costi o aumento ricavi per incrementare la marginalità.':c.roe>=0?'Priorità: ridurre i costi fissi e aumentare i ricavi. Valutare la redditività per linea di prodotto.':'Analisi urgente delle perdite. Piano di risanamento necessario se il trend è confermato.'],
      ['Return on Investment','ROI',c.roi,fp(c.roi),c.roi>=8,c.roi>=3,
       'ROI = EBIT / Totale Attivo × 100',`> 3%`,`> 8%`,
       'Misura l\'efficienza con cui l\'azienda utilizza tutti gli asset (propri e di terzi) per generare reddito operativo. È indipendente dalla struttura finanziaria: confronta aziende con diversa leva. Se ROI < costo del debito, la leva finanziaria distrugge valore.',
       c.roi>=8?`Ottimo (${fp(c.roi)}): eccellente efficienza nell\'utilizzo del capitale investito.`:c.roi>=3?`Sufficiente (${fp(c.roi)}): nella norma, con margine di miglioramento.`:`Insufficiente (${fp(c.roi)}): il capitale non viene remunerato adeguatamente.`,
       c.roi>=8?'Ottima gestione degli asset. Valutare se espandere gli investimenti per crescere.':c.roi>=3?'Verificare asset inattivi o sottoutilizzati. Possibile miglioramento con razionalizzazione investimenti.':'Analizzare asset non produttivi. Considerare dismissione di immobilizzazioni non strategiche.'],
      ['Return on Sales','ROS',c.ros,fp(c.ros),c.ros>=10,c.ros>=3,
       'ROS = EBIT / Valore Produzione × 100',`> 3%`,`> 10%`,
       'Indica quanta parte del fatturato si trasforma in reddito operativo dopo aver coperto tutti i costi di produzione (esclusi oneri finanziari e imposte). Un ROS basso indica un\'elevata incidenza dei costi operativi sui ricavi.',
       c.ros>=10?`Eccellente (${fp(c.ros)}): alta capacità di trasformare ricavi in reddito operativo.`:c.ros>=3?`Nella norma (${fp(c.ros)}): migliorabile agendo sui costi variabili.`:`Basso (${fp(c.ros)}): struttura dei costi da rivedere con urgenza.`,
       c.ros>=10?'Ottima marginalità. Monitorare per difenderla dalla pressione competitiva.':c.ros>=3?'Analizzare le singole voci di costo (personale, servizi, materie prime) per trovare inefficienze.':'Revisione urgente del pricing e/o dei costi. Valutare outsourcing di attività non core.'],
      ['EBITDA Margin','MOL%',c.ebitda_pct,fp(c.ebitda_pct),c.ebitda_pct>=15,c.ebitda_pct>=5,
       'EBITDA Margin = EBITDA / Valore Produzione × 100',`> 5%`,`> 15%`,
       'Misura la capacità di generare cassa operativa al lordo di ammortamenti, oneri finanziari e imposte. È l\'indicatore preferito dalle banche per valutare la capacità di rimborso (DSCR). Non risente delle politiche di ammortamento né della struttura del debito.',
       c.ebitda_pct>=15?`Eccellente (${fp(c.ebitda_pct)}): il business genera cassa operativa abbondante.`:c.ebitda_pct>=5?`Sufficiente (${fp(c.ebitda_pct)}): margine accettabile, da migliorare.`:`Critico (${fp(c.ebitda_pct)}): difficoltà a generare cassa operativa per servire il debito.`,
       c.ebitda_pct>=15?'Azienda bancabile. Utilizzare l\'EBITDA come leva per negoziare condizioni migliori con le banche.':c.ebitda_pct>=5?'Lavorare sulla riduzione dei costi variabili (materie prime, servizi) prima di espandersi.':'Emergenza: l\'azienda non genera cassa sufficiente. Rinegoziare il debito e tagliare i costi fissi.'],
    ].map(([name,acro,val,disp,verde,giallo,formula,sogMin,sogOtt,desc,interp,action],idx)=>{
    const thresholds = [20, 16, 20, 30];
    const progressPct = (!isNaN(val)&&isFinite(val)) ? Math.min(Math.max(val/(thresholds[idx]||20)*100,0),100) : 0;
    const progressColor = verde?'#059669':giallo?'#D97706':'#DC2626';
    return `
    <div class="ind-card">
      <div class="ind-name">${name}</div><div class="ind-acro">${acro}</div>
      <div class="ind-val" style="color:${verde?'#059669':giallo?'#D97706':'#DC2626'}">${disp}</div>
      <span class="ind-badge ${verde?'ib-g':giallo?'ib-a':'ib-r'}">${verde?'✓ Ottimo':giallo?'⚠ Sufficiente':'✗ Critico'}</span>
      <div class="ind-progress"><div class="ind-progress-fill" style="width:${progressPct.toFixed(0)}%;background:${progressColor}"></div></div>
      <div class="ind-formula">${formula}</div>
      <div class="ind-bench">Minima: <span>${sogMin}</span> · Ottimale: <span>${sogOtt}</span></div>
      <div class="ind-desc">${desc}</div>
      <div class="ind-interp">${interp}</div>
      <div class="ind-action">💡 <strong>Cosa fare:</strong> ${action}</div>
    </div>`;}).join('')}
  </div>
  <div class="ind-intro">Gli <strong>indici di liquidità</strong> misurano la capacità dell'azienda di far fronte agli impegni a breve termine senza ricorrere a nuove fonti di finanziamento. Un'azienda redditizia può comunque trovarsi in crisi di liquidità se i tempi di incasso e pagamento non sono bilanciati. Questi indici sono fondamentali per la valutazione EBA Stage 2.</div>
  <div class="ind-hd">💧 Indici di Liquidità</div>
  <div class="ind-cards">
    <div class="ind-card">
      <div class="ind-name">Current Ratio</div><div class="ind-acro">Liquidità corrente</div>
      <div class="ind-val" style="color:${semColor(c.cr,1.5,1.0)}">${fx(c.cr)}</div>
      <span class="ind-badge ${c.cr>=1.5?'ib-g':c.cr>=1.0?'ib-a':'ib-r'}">${c.cr>=1.5?'✓ Ottimo':c.cr>=1.0?'⚠ Sufficiente':'✗ Critico'}</span>
      <div class="ind-formula">Attivo Circolante / Passività a Breve</div>
      <div class="ind-bench">Critico: <span>&lt;1,0x</span> · Ottimale: <span>&gt;1,5x</span></div>
      <div class="ind-desc">Indica quante volte l'attivo circolante (cassa, crediti, rimanenze) copre i debiti in scadenza entro l'anno. Un valore inferiore a 1 significa che le uscite a breve superano le entrate disponibili: segnale di allerta EBA Stage 2 che può precludere l'accesso al credito.</div>
      <div class="ind-interp">${isNaN(c.cr)?'n.d.':c.cr>=1.5?`Ottimale (${fx(c.cr)}): nessun rischio di tensioni di liquidità nel breve.`:c.cr>=1.0?`Sufficiente (${fx(c.cr)}): da monitorare mensilmente. Evitare investimenti che immobilizzino liquidità.`:`Critico (${fx(c.cr)}): le passività a breve superano l'attivo circolante. Rischio insolvenza a breve.`}</div>
      <div class="ind-action">💡 <strong>Cosa fare:</strong> ${c.cr>=1.5?'Situazione solida. Ottimizzare il circolante per massimizzare i rendimenti.':c.cr>=1.0?'Accelerare i tempi di incasso, allungare i termini di pagamento fornitori, valutare utilizzo di linee di credito a breve.':'Urgente: rinegoziare le scadenze dei debiti a breve, cercare liquidità straordinaria, valutare factoring sui crediti.'}</div>
    </div>
    <div class="ind-card">
      <div class="ind-name">Acid Test (Quick Ratio)</div><div class="ind-acro">Liquidità immediata</div>
      <div class="ind-val" style="color:${semColor(c.acid,1.0,0.7)}">${fx(c.acid)}</div>
      <span class="ind-badge ${c.acid>=1.0?'ib-g':c.acid>=0.7?'ib-a':'ib-r'}">${c.acid>=1.0?'✓ Ottimo':c.acid>=0.7?'⚠ Sufficiente':'✗ Basso'}</span>
      <div class="ind-formula">(Att. Circ. − Rimanenze) / Passività a Breve</div>
      <div class="ind-bench">Critico: <span>&lt;0,7x</span> · Ottimale: <span>&gt;1,0x</span></div>
      <div class="ind-desc">Versione più severa del Current Ratio: esclude le rimanenze perché non sono immediatamente liquidabili (richiedono tempo per la vendita). Misura la capacità di far fronte ai debiti a breve con sole disponibilità liquide e crediti commerciali. È il test preferito dalle banche per valutare la liquidità reale.</div>
      <div class="ind-interp">${isNaN(c.acid)?'n.d.':c.acid>=1.0?`Ottimale (${fx(c.acid)}): liquidità solida anche senza smobilizzare il magazzino.`:c.acid>=0.7?`Accettabile (${fx(c.acid)}): le rimanenze pesano sulla liquidità immediata. Monitorare la rotazione del magazzino.`:`Basso (${fx(c.acid)}): l'azienda dipende dalla vendita del magazzino per pagare i debiti a breve.`}</div>
      <div class="ind-action">💡 <strong>Cosa fare:</strong> ${c.acid>=1.0?'Ottima posizione. Mantenere una gestione prudente del magazzino.':c.acid>=0.7?'Ridurre le scorte di magazzino e velocizzare gli incassi. Valutare anticipo fatture.':'Riduzione urgente del magazzino (sconti, promozioni), accelerare gli incassi, sospendere nuovi acquisti di stock.'}</div>
    </div>
  </div>
  <div class="pf"><span>AnalisiEBusinessPlan.it</span><span>${nome} — ${anno}</span><span>Pag. 5</span></div>
</div>

<!-- PAG 6: SOLIDITÀ + EFFICIENZA -->
<div class="page">
  <div class="ph">
    <div><div class="ph-ey">Sezione 4 (continua)</div><div class="ph-ti">Indici di Bilancio — Solidità ed Efficienza</div></div>
    <div class="ph-az">${nome}<br/>${anno}</div>
  </div>
  <div class="ind-intro">Gli <strong>indici di solidità patrimoniale</strong> misurano la stabilità strutturale dell'azienda nel lungo periodo e la sua capacità di assorbire perdite o shock economici. Sono determinanti per le banche nella valutazione del merito creditizio secondo le Linee Guida EBA: un'azienda con bassa autonomia finanziaria è considerata ad alto rischio sistemico.</div>
  <div class="ind-hd">🏛️ Indici di Solidità Patrimoniale</div>
  <div class="ind-cards">
    <div class="ind-card">
      <div class="ind-name">Autonomia Finanziaria</div><div class="ind-acro">Equity Ratio</div>
      <div class="ind-val" style="color:${semColor(c.aut,30,15)}">${fp(c.aut)}</div>
      <span class="ind-badge ${c.aut>=30?'ib-g':c.aut>=15?'ib-a':'ib-r'}">${c.aut>=30?'✓ Ottimo EBA':c.aut>=15?'⚠ Sufficiente':'✗ Sotto soglia'}</span>
      <div class="ind-formula">Patrimonio Netto / Totale Attivo × 100</div>
      <div class="ind-bench">Soglia EBA: <span>&gt;30%</span> · Ottimale: <span>&gt;40%</span></div>
      <div class="ind-desc">Indica quanta parte degli impieghi totali è finanziata con capitale proprio (non rimborsabile). È l'indicatore cardine EBA/GL/2020/06: esprime l'indipendenza dai creditori e la capacità di assorbire perdite senza compromettere la continuità aziendale. Sotto il 30% l'azienda viene classificata come strutturalmente fragile.</div>
      <div class="ind-interp">${isNaN(c.aut)?'n.d.':c.aut>=40?`Eccellente (${fp(c.aut)}): struttura patrimoniale robusta, ampiamente sopra la soglia EBA del 30%.`:c.aut>=30?`Sufficiente (${fp(c.aut)}): soddisfa le soglie EBA minime. Lavorare per avvicinarsi al 40%.`:`Sotto soglia EBA (${fp(c.aut)}): struttura patrimoniale fragile. Rischio classificazione Stage 2.`}</div>
      <div class="ind-action">💡 <strong>Cosa fare:</strong> ${c.aut>=40?'Struttura solida. Valutare investimenti strategici o distribuzione di utili ai soci.':c.aut>=30?'Accantonare gli utili a riserva invece di distribuirli. Evitare nuovi indebitamenti non strettamente necessari.':'Urgente rafforzamento patrimoniale: versamenti soci, conversione finanziamenti soci in capitale, riduzione debiti. Evitare distribuzione di utili.'}</div>
    </div>
    <div class="ind-card">
      <div class="ind-name">Leva Finanziaria</div><div class="ind-acro">D/E Ratio</div>
      <div class="ind-val" style="color:${semColor(c.leva,2,4,false)}">${fx(c.leva)}</div>
      <span class="ind-badge ${c.leva<=2?'ib-g':c.leva<=4?'ib-a':'ib-r'}">${c.leva<=2?'✓ Conservativo':c.leva<=4?'⚠ Moderato':'✗ Elevato'}</span>
      <div class="ind-formula">Totale Debiti / Patrimonio Netto</div>
      <div class="ind-bench">Attenzione: <span>&gt;2x</span> · Critico: <span>&gt;4x</span></div>
      <div class="ind-desc">Esprime quanti euro di debiti (verso banche, fornitori, erario) esistono per ogni euro di patrimonio netto. Una leva alta amplifica sia i rendimenti (in fase positiva) che i rischi (in fase negativa). Con leva >4x la maggior parte del valore aziendale appartiene ai creditori, non ai soci.</div>
      <div class="ind-interp">${isNaN(c.leva)?'n.d.':c.leva<=2?`Conservativo (${fx(c.leva)}): ampi margini di manovra per nuova finanza se necessario.`:c.leva<=4?`Moderato (${fx(c.leva)}): da monitorare. Evitare ulteriore indebitamento senza crescita dell'EBITDA.`:`Elevato (${fx(c.leva)}): ridurre il debito è priorità assoluta. Le banche potrebbero rifiutare nuovi fidi.`}</div>
      <div class="ind-action">💡 <strong>Cosa fare:</strong> ${c.leva<=2?'Ottima posizione. Possibile utilizzare leva per finanziare crescita mantenendo un profilo conservativo.':c.leva<=4?'Non aumentare il debito. Destinare parte degli utili alla riduzione del debito bancario.':'Piano di riduzione del debito urgente: cessione asset non strategici, aumento capitale, rinegoziazione scadenze.'}</div>
    </div>
  </div>
  <div class="ind-intro" style="margin-top:16px">Gli <strong>indici di efficienza operativa</strong> (ciclo del circolante) misurano la velocità con cui l'azienda trasforma le sue attività operative in liquidità. Il ciclo del capitale circolante netto (CCN) indica quanti giorni di fatturato l'azienda deve "anticipare" prima di incassare: più è lungo, più fabbisogno finanziario genera.</div>
  <div class="ind-hd">⚙️ Efficienza Operativa — Ciclo del Circolante</div>
  <div class="ind-hd">⚙️ Efficienza Operativa — Ciclo del Circolante</div>
  <div class="ind-cards">
    <div class="ind-card">
      <div class="ind-name">Rotazione Rimanenze (DSI)</div><div class="ind-acro">Days Sales in Inventory</div>
      <div class="ind-val" style="color:${isNaN(c.dsi)?'#94A3B8':c.dsi<=60?'#059669':c.dsi<=90?'#D97706':'#DC2626'}">${fgg(c.dsi)}</div>
      <span class="ind-badge ${isNaN(c.dsi)?'ib-a':c.dsi<=60?'ib-g':c.dsi<=90?'ib-a':'ib-r'}">${isNaN(c.dsi)?'n.d.':c.dsi<=60?'✓ Buono':c.dsi<=90?'⚠ Nella norma':'✗ Lento'}</span>
      <div class="ind-formula">(Rimanenze / Costo del Venduto) × 365</div>
      <div class="ind-bench">Manifattura: <span>45–90 gg</span> · Commercio: <span>30–60 gg</span></div>
      <div class="ind-desc">Ogni quanti giorni il magazzino viene rinnovato. Alta rotazione = efficienza. Bassa rotazione = capitale immobilizzato.</div>
      <div class="ind-interp">${isNaN(c.dsi)?'Inserire rimanenze e costo del venduto.':c.dsi<=60?`Buona rotazione (${fgg(c.dsi)}): magazzino efficiente.`:c.dsi<=90?`Nella norma (${fgg(c.dsi)}): monitorare per evitare accumulo scorte obsolete.`:`Lento (${fgg(c.dsi)}): capitale immobilizzato in magazzino. Valutare promozioni o razionalizzazione dell'assortimento.`}</div>
      <div class="ind-action">💡 <strong>Cosa fare:</strong> ${isNaN(c.dsi)?'Inserire i dati di rimanenze e costo del venduto per calcolare questo indice.':c.dsi<=60?'Buona gestione. Mantenere il livello di scorte attuale.':c.dsi<=90?'Analizzare le referenze a bassa rotazione e ridurre gli ordini di riassortimento.':'Liquidazione scorte obsolete con sconti, revisione politica acquisti, adozione sistema just-in-time.'}</div>
    </div>
    <div class="ind-card">
      <div class="ind-name">Giorni Credito Clienti (DSO)</div><div class="ind-acro">Days Sales Outstanding</div>
      <div class="ind-val" style="color:${isNaN(c.dso)?'#94A3B8':c.dso<=60?'#059669':c.dso<=90?'#D97706':'#DC2626'}">${fgg(c.dso)}</div>
      <span class="ind-badge ${isNaN(c.dso)?'ib-a':c.dso<=60?'ib-g':c.dso<=90?'ib-a':'ib-r'}">${isNaN(c.dso)?'n.d.':c.dso<=60?'✓ Ottimo':c.dso<=90?'⚠ Nella norma':'✗ Elevato'}</span>
      <div class="ind-formula">(Crediti Clienti / Ricavi) × 365</div>
      <div class="ind-bench">Ottimale: <span>&lt;60 gg</span> · Media Italia PMI: <span>75–90 gg</span></div>
      <div class="ind-desc">Tempo medio tra vendita e incasso. Più è alto, più capitale è congelato nei crediti commerciali.</div>
      <div class="ind-interp">${isNaN(c.dso)?'Inserire crediti clienti e ricavi.':c.dso<=60?`Ottimo (${fgg(c.dso)}): incasso rapido, basso fabbisogno finanziario.`:c.dso<=90?`Nella norma italiana (${fgg(c.dso)}): valutare credit management più stringente per ridurre l'esposizione.`:`Elevato (${fgg(c.dso)}): potenziali difficoltà di incasso o clienti con ritardi sistematici.`}</div>
      <div class="ind-action">💡 <strong>Cosa fare:</strong> ${isNaN(c.dso)?'Inserire i dati di crediti verso clienti e ricavi per calcolare questo indice.':c.dso<=60?'Eccellente. Mantenere le condizioni di pagamento attuali.':c.dso<=90?'Introdurre sconti per pagamento anticipato, bonifici bancari invece di assegni, monitorare gli insoluti.':'Analisi clienti per anzianità credito, solleciti sistematici, valutare factoring o cessione crediti, rivedere fidi concessi.'}</div>
    </div>
    <div class="ind-card ind-card-full">
      <div class="ind-name">Giorni Debito Fornitori (DPO)</div><div class="ind-acro">Days Payable Outstanding — Ciclo CCN: ${fgg(c.ccn_giorni)}</div>
      <div class="ind-val" style="color:${isNaN(c.dpo)?'#94A3B8':c.dpo>=60?'#059669':c.dpo>=30?'#D97706':'#DC2626'}">${fgg(c.dpo)}</div>
      <span class="ind-badge ${isNaN(c.dpo)?'ib-a':c.dpo>=60?'ib-g':c.dpo>=30?'ib-a':'ib-r'}">${isNaN(c.dpo)?'n.d.':c.dpo>=60?'✓ Ottimale':c.dpo>=30?'⚠ Sufficiente':'✗ Basso'}</span>
      <div class="ind-formula">DPO = (Debiti Fornitori / Acquisti) × 365 · Ciclo CCN = DSI + DSO − DPO</div>
      <div class="ind-bench">Ottimale: <span>60–90 gg</span> · Ciclo CCN ottimale: <span>&lt;60 gg</span></div>
      <div class="ind-desc">Ogni quanti giorni si pagano i fornitori. DPO elevato = uso del credito fornitori come fonte di finanziamento gratuita. Il ciclo CCN indica il fabbisogno netto di finanziamento del circolante.</div>
      <div class="ind-interp">${isNaN(c.dpo)?'Inserire debiti fornitori e acquisti.':`DPO ${fgg(c.dpo)}: ${c.dpo>=60?'buona gestione del credito fornitori — finanziamento gratuito.':c.dpo>=30?'possibilità di negoziare termini più dilazionati con i fornitori.':'l\'azienda paga troppo rapidamente, rinunciando a liquidità gratuita.'}${!isNaN(c.ccn_giorni)?' Ciclo CCN: '+fgg(c.ccn_giorni)+' — fabbisogno finanziario '+(c.ccn_giorni>90?'elevato: richiede linee di credito consistenti.':c.ccn_giorni>60?'moderato: ottimizzare incassi e pagamenti.':'contenuto: gestione circolante efficiente.'):''}` }</div>
      <div class="ind-action">💡 <strong>Cosa fare:</strong> ${isNaN(c.dpo)?'Inserire i dati di debiti verso fornitori e acquisti per calcolare questo indice.':c.dpo>=60?'Ottima gestione. Mantenere i termini negoziati con i fornitori.':c.dpo>=30?'Negoziare con i fornitori principali dilazioni a 60-90 gg. Offrire garanzie o volumi per ottenere condizioni migliori.':'Rinegoziare immediatamente i termini di pagamento. Ogni giorno in più è liquidità gratuita.'}</div>
    </div>
  </div>
  <div class="pf"><span>AnalisiEBusinessPlan.it</span><span>${nome} — ${anno}</span><span>Pag. 6</span></div>
</div>

<!-- PAG 7: BANCABILITÀ EBA -->
<div class="page">
  <div class="ph">
    <div><div class="ph-ey">Sezione 5</div><div class="ph-ti">Analisi Bancabilità EBA/GL/2020/06</div></div>
    <div class="ph-az">${nome}<br/>${anno}</div>
  </div>
  <div class="banc-intro">Le <strong>Linee Guida EBA/GL/2020/06</strong> (in vigore dal 30/06/2021) obbligano gli istituti bancari europei a valutare il merito creditizio tramite indicatori standardizzati. Il superamento delle soglie critiche classifica l'impresa in <strong>Stage 2</strong> (watch list) con impatto diretto su tassi, garanzie e accesso al credito.</div>
  <div class="banc-grid">
    ${[
      ['DSCR','Debt Service Coverage Ratio','EBITDA / (Quote capitale + Interessi)', c.dscr, isNaN(c.dscr)?'n.d.':fx(c.dscr), isNaN(c.dscr)?'bv-0':c.dscr>=1.25?'bv-g':c.dscr>=1.0?'bv-a':'bv-r', isNaN(c.dscr)?'Inserire servizio debito':c.dscr>=1.25?'✓ Bancabile ≥ 1,25x':c.dscr>=1.0?'⚠ Borderline':'✗ Stage 2 EBA', isNaN(c.dscr)?null:Math.min(c.dscr/3*100,100), semColor(c.dscr,1.25,1.0), 'Indicatore chiave per le banche. DSCR &lt;1,1 = trigger allerta EBA formale. DSCR &lt;1,0 = i flussi non coprono il servizio del debito.'],
      ['PFN/EBITDA','Posizione Finanziaria Netta su EBITDA','(Deb.fin. − Liquidità) / EBITDA', c.pfn_ebitda, (!isNaN(c.pfn_ebitda)&&c.pfn_ebitda>0)?fx(c.pfn_ebitda,2):(c.pfn<=0?'< 0 ✓':'—'), (!isNaN(c.pfn_ebitda)&&c.pfn_ebitda>0)?(c.pfn_ebitda<3?'bv-g':c.pfn_ebitda<6?'bv-a':'bv-r'):'bv-g', (!isNaN(c.pfn_ebitda)&&c.pfn_ebitda>0)?(c.pfn_ebitda<3?'✓ Ottimo <3x':c.pfn_ebitda<6?'⚠ Accettabile <6x':'✗ Stage 2 BCE >6x'):'✓ PFN nulla o negativa', null, null, 'Anni di EBITDA per rimborsare il debito netto. Soglia BCE: 6x. Prassi di mercato: ottimale <3x.'],
      ['ICR','Interest Coverage Ratio','EBIT / Oneri Finanziari', c.icr, isNaN(c.icr)?'n.d.':fx(c.icr), isNaN(c.icr)?'bv-0':c.icr>=3?'bv-g':c.icr>=1.5?'bv-a':'bv-r', isNaN(c.icr)?'Nessun onere fin.':c.icr>=3?'✓ Ottimo >3x':c.icr>=1.5?'⚠ Sufficiente':'✗ Critico', isNaN(c.icr)?null:Math.min(c.icr/6*100,100), semColor(c.icr,3,1.5), 'Quante volte il reddito operativo copre gli interessi. ICR &lt;1 = impossibile pagare gli interessi con l\'EBIT.'],
      ['Current Ratio','Liquidità corrente EBA','Attivo Circolante / Passività a Breve', c.cr, fx(c.cr), c.cr>=1.5?'bv-g':c.cr>=1.0?'bv-a':'bv-r', c.cr>=1.5?'✓ Ottimo >1,5x':c.cr>=1.0?'⚠ Sufficiente >1,0x':'✗ Stage 2 <1,0x', Math.min(c.cr/3*100,100), semColor(c.cr,1.5,1.0), 'Current Ratio &lt;1 è segnale di allerta EBA formale che può portare alla classificazione Stage 2.'],
    ].map(([name,acro,formula,val,disp,verdict_cls,verdict_lbl,barPct,barColor,desc])=>`
    <div class="banc-box">
      <div class="banc-name">${name}</div>
      <div class="banc-acro">${acro}</div>
      <div class="banc-formula">${formula}</div>
      <div class="banc-val" style="color:${barColor||'#94A3B8'}">${disp}</div>
      <span class="banc-verdict ${verdict_cls}">${verdict_lbl}</span>
      ${barPct!==null&&barPct!==undefined?`<div class="bar-track"><div class="bar-fill" style="width:${barPct}%;background:${barColor}"></div></div>`:''}
      <div class="banc-desc">${desc}</div>
    </div>`).join('')}
  </div>
  <div class="pf"><span>AnalisiEBusinessPlan.it</span><span>${nome} — ${anno}</span><span>Pag. 7</span></div>
</div>

${hasRF ? `
<!-- PAG 8: RENDICONTO -->
<div class="page">
  <div class="ph">
    <div><div class="ph-ey">Sezione 6</div><div class="ph-ti">Rendiconto Finanziario</div></div>
    <div class="ph-az">${nome}<br/>${anno}</div>
  </div>
  <div class="rf-box">
    <div class="rf-title">A) Flussi da attività operativa</div>
    <div class="rf-row"><span class="rf-lbl">Utile/perdita esercizio</span><span class="${(d.rf_utile||d.utile_es||0)>=0?'pos':'neg'}">${fmt(d.rf_utile||d.utile_es)}</span></div>
    <div class="rf-row"><span class="rf-lbl">+ Ammortamenti</span><span>+${fmt(d.rf_ammort||d.ammort)}</span></div>
    <div class="rf-row"><span class="rf-lbl">± Variazione capitale circolante</span><span>${fmt((d.rf_rim||0)+(d.rf_cred||0)+(d.rf_deb||0)+(d.rf_ccn||0))}</span></div>
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
    <div class="rf-row"><span class="rf-lbl">± Variazione debiti bancari</span><span>${fmt(d.rf_fin_bt||0)}</span></div>
    <div class="rf-row"><span class="rf-lbl">− Rimborso finanziamenti</span><span class="neg">−${fmt(Math.abs(d.rf_rimb||0))}</span></div>
    <div class="rf-tot"><span>Flusso finanziamento (C)</span><span style="color:${(d.rf_c||0)>=0?'#6EE7B7':'#FCA5A5'}">${fmt(d.rf_c)}</span></div>
  </div>
  <div class="rf-2col">
    <div class="rf-kpi"><div class="rf-kpi-lbl">Variazione liquidità (A+B+C)</div><div class="rf-kpi-val ${((d.rf_a||0)+(d.rf_b||0)+(d.rf_c||0))>=0?'pos':'neg'}">${fmt((d.rf_a||0)+(d.rf_b||0)+(d.rf_c||0))}</div></div>
    <div class="rf-kpi"><div class="rf-kpi-lbl">Free Cash Flow (A+B)</div><div class="rf-kpi-val ${((d.rf_a||0)+(d.rf_b||0))>=0?'pos':'neg'}">${fmt((d.rf_a||0)+(d.rf_b||0))}</div></div>
  </div>
  <div class="pf"><span>AnalisiEBusinessPlan.it</span><span>${nome} — ${anno}</span><span>Pag. 8</span></div>
</div>` : ''}

<!-- PAG RATING FINALE -->
<div class="page">
  <div class="ph">
    <div><div class="ph-ey">Sezione ${hasRF?'7':'6'}</div><div class="ph-ti">Rating Sintetico di Bancabilità</div></div>
    <div class="ph-az">${nome}<br/>${anno}</div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:12px;">
    <div>
      <div class="rating-center">
        ${svgGauge(rating.l, rating.color)}
        <div class="r-title">${rating.title}</div>
        ${rating.penalized?`<div style="font-size:8px;color:#DC2626;background:#FEF2F2;border:1px solid #FECACA;border-radius:5px;padding:6px 9px;margin-top:8px;">${rating.triggerNote}</div>`:''}
      </div>
      <div class="rating-scale">
        ${[['D','Critico','#DC2626'],['C','Limitata','#D97706'],['B','Discreta','#3B82F6'],['B+','Buona','#2563EB'],['A','Ottima','#059669'],['A+','Eccellente','#047857']].map(([l,lbl,col])=>`
        <div class="rs-item${rating.l===l?' rs-active':''}">
          <div class="rs-letter" style="color:${rating.l===l?col:col+'88'}">${l}</div>
          <div class="rs-lbl">${lbl}</div>
        </div>`).join('')}
      </div>
    </div>
    <div>
      <div class="zscore-box">
        <div class="zscore-title">Z'-Score Altman PMI Italia</div>
        <div style="display:flex;align-items:baseline;gap:10px;">
          <div style="font-family:'Fraunces',serif;font-size:26px;font-weight:700;color:${rating.zClass==='pos'?'#059669':rating.zClass==='warn'?'#D97706':'#DC2626'}">${rating.zScore!==null?rating.zScore.toFixed(2):'n.d.'}</div>
          <div style="font-size:9.5px;font-weight:600;color:${rating.zClass==='pos'?'#059669':rating.zClass==='warn'?'#D97706':'#DC2626'}">${rating.zLabel}</div>
        </div>
        <div style="font-size:8.5px;color:#64748B;margin-top:5px;line-height:1.6;">Soglie: Z&gt;2,90=zona sicura · 1,23–2,90=zona grigia · Z&lt;1,23=zona insolvenza. Peso nel rating: 30%.</div>
      </div>
      <div class="${rating.triggers.length===0?'trigger-box ok':rating.triggers.length===1?'trigger-box warn':'trigger-box alert'}">
        <div class="trigger-title" style="color:${rating.triggers.length===0?'#059669':rating.triggers.length===1?'#D97706':'#DC2626'}">
          ${rating.triggers.length===0?'✓ Nessun segnale allerta CCII':'⚠ '+rating.triggers.length+' segnali allerta CCII'}
        </div>
        ${rating.triggers.length===0?'<div style="font-size:8.5px;color:#059669;">Nessuno dei 7 indicatori di allerta del Codice della Crisi risulta attivo.</div>':rating.triggers.map(t=>`<div class="trigger-item">⚠ ${t}</div>`).join('')}
      </div>
      <div class="chart-box">
        <div class="chart-title">Radar — Profilo Finanziario Complessivo</div>
        ${svgRadar(rating.radarScores)}
      </div>
    </div>
  </div>
  <div class="score-table">
    <div class="score-grid">
      <div>Indicatore EBA</div><div>Valore</div><div>Soglia</div><div>Giudizio</div><div>Score</div>
    </div>
    ${rating.ebaDetails.map((e,i)=>`
    <div class="score-row${i%2===0?' hi':''}">
      <div>${e.nome}</div>
      <div>${isNaN(e.val)||!isFinite(e.val)?'n.d.':e.g<10&&e.g>-10?fx(e.val):fp(e.val)}</div>
      <div>${e.higher?'≥':'≤'} ${e.g}${e.g<10?'x':'%'}</div>
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
  ${note?`<div class="note-box"><div class="note-title">Note analista</div><div class="note-text">${note}</div></div>`:''}
  <div class="disclaimer">Report generato da AnalisiEBusinessPlan.it · Rating: Z'-Score Altman PMI (30%) + Scorecard EBA/GL/2020/06 (70%) + verifica trigger CCII (D.Lgs. 14/2019) · Generato il ${dataReport} · Basato esclusivamente su dati di bilancio (non include componente andamentale Centrale Rischi).</div>
  <div class="pf"><span>AnalisiEBusinessPlan.it</span><span>${nome} — ${anno}</span><span>Pag. ${hasRF?'8':'7'}</span></div>
</div>

<!-- PAG MCC: RATING FONDO DI GARANZIA PMI -->
<div class="page">
  <div class="ph">
    <div><div class="ph-ey">Sezione ${hasRF?'8':'7'}</div><div class="ph-ti">Rating MCC — Fondo di Garanzia PMI</div></div>
    <div class="ph-az">${nome}<br/>${anno}</div>
  </div>
  <div class="mcc-header">
    <div class="mcc-header-top">Mediocredito Centrale · D.Lgs. 79/2024 · Modello valutativo PMI</div>
    <div class="mcc-header-title">Rating Fondo di Garanzia — Fascia ${mcc.fascia}</div>
  </div>
  <div class="mcc-intro">
    Il <strong>Fondo di Garanzia PMI</strong> (gestito da Mediocredito Centrale per conto del MiSE/MIMIT) concede garanzie dirette o controgaranzie sui finanziamenti bancari alle PMI italiane. L'ammissibilità e la percentuale di copertura dipendono dalla fascia di rischio attribuita all'impresa sulla base di 5 indicatori di bilancio. Le imprese in <strong>Fascia 1–4 sono ammissibili</strong>; la Fascia 5 indica un profilo di rischio elevato che preclude l'accesso alla garanzia pubblica nella forma ordinaria.
  </div>
  <div class="mcc-main">
    <div>
      <div class="mcc-fascia-box" style="border-color:${mcc.fasciaColor};">
        <div style="font-size:8px;color:#94A3B8;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;">Fascia MCC</div>
        <div class="mcc-fascia-num" style="color:${mcc.fasciaColor}">${mcc.fascia}</div>
        <div class="mcc-fascia-lbl" style="color:${mcc.fasciaColor}">${mcc.fasciaLabel}</div>
        <div class="mcc-fascia-sub">Score: ${mcc.totalScore}/100</div>
        <div class="mcc-fascia-copertura" style="background:${mcc.eligible?'#ECFDF5':'#FEF2F2'};color:${mcc.eligible?'#059669':'#DC2626'};">
          ${mcc.eligible?'✓ Ammissibile':'✗ Non ammissibile'}
        </div>
        <div style="font-size:8px;color:#64748B;margin-top:6px;">Garanzia: <strong>${mcc.copertura}</strong></div>
      </div>
    </div>
    <div>
      <div class="mcc-scale">
        ${[
          [1,'Eccellente','fino all\'80%','#047857',mcc.totalScore>=75],
          [2,'Buona bancabilità','fino al 70%','#059669',mcc.totalScore>=55&&mcc.totalScore<75],
          [3,'Bancabilità media','fino al 60%','#2563EB',mcc.totalScore>=35&&mcc.totalScore<55],
          [4,'Bancabilità bassa','fino al 40%','#D97706',mcc.totalScore>=15&&mcc.totalScore<35],
          [5,'Non ammissibile','garanzia esclusa','#DC2626',mcc.totalScore<15||((d.tot_pn||0)<=0)],
        ].map(([n,lbl,cov,col,active])=>`
        <div class="mcc-scale-item${active?' active':''}" style="${active?`border-color:${col};background:${col}11;`:''}">
          <div class="mcc-scale-num" style="color:${active?col:'#94A3B8'}">${n}</div>
          <div class="mcc-scale-info">
            <div class="mcc-scale-name" style="${active?'color:'+col:''}">${lbl}</div>
            <div class="mcc-scale-cov">${cov}</div>
          </div>
          ${active?`<div style="font-size:8px;font-weight:700;color:${col};background:${col}22;padding:2px 7px;border-radius:10px;">▶ Attuale</div>`:''}
        </div>`).join('')}
      </div>
    </div>
  </div>

  ${mcc.exclusions.length>0?`
  <div class="mcc-excl">
    <div class="mcc-excl-title">⚠ Motivi di esclusione rilevati</div>
    ${mcc.exclusions.map(e=>`<div class="mcc-excl-item">• ${e}</div>`).join('')}
  </div>`:''}

  <div class="mcc-score-table">
    <div class="mcc-score-hd">
      <div>Indicatore</div><div>Valore</div><div>Soglie (bassa / media / alta)</div><div>Punteggio</div>
    </div>
    ${mcc.items.map((item,i)=>`
    <div class="mcc-score-row${i%2===0?' alt':''}">
      <div style="font-weight:500">${item.nome}</div>
      <div style="font-weight:700;color:${item.pts>=item.peso*0.7?'#059669':item.pts>=item.peso*0.35?'#D97706':'#DC2626'}">${item.disp}</div>
      <div style="color:#64748B">${item.soglie}</div>
      <div style="font-weight:700;color:${item.pts>=item.peso*0.7?'#059669':item.pts>=item.peso*0.35?'#D97706':'#DC2626'}">${item.pts}/${item.peso}</div>
    </div>`).join('')}
    <div class="mcc-score-row total">
      <div>Punteggio totale MCC</div><div></div><div></div>
      <div>${mcc.totalScore}/100</div>
    </div>
  </div>

  <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:9px;padding:12px 14px;">
    <div style="font-size:8.5px;font-weight:700;color:#0F172A;text-transform:uppercase;letter-spacing:.07em;margin-bottom:7px;">Linee guida interpretative</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:8.5px;color:#475569;line-height:1.7;">
      <div><strong>Garanzia diretta:</strong> la banca presenta la pratica a MCC che garantisce direttamente il finanziamento (fino all'80% per Fascia 1). Il beneficio per l'impresa è l'accesso al credito a condizioni migliori (tassi ridotti, minori garanzie reali richieste).</div>
      <div><strong>Controgaranzia:</strong> MCC garantisce i Confidi che a loro volta garantiscono la banca. Fascia 1–3 hanno accesso facilitato; Fascia 4 richiede istruttoria rafforzata; Fascia 5 è esclusa dalla garanzia ordinaria ma può accedere a strumenti straordinari (es. SACE, garanzie regionali).</div>
    </div>
  </div>

  <div class="pf"><span>AnalisiEBusinessPlan.it</span><span>${nome} — ${anno}</span><span>Ultima pagina</span></div>
</div>

</body></html>`;
}

// ── HANDLER ──
module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { data, config } = req.body;
  if (!data) return res.status(400).json({ error: 'Dati bilancio mancanti' });
  try {
    const html = buildReportHTML(data, config || {});
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.status(200).send(html);
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ error: 'Errore generazione report: ' + error.message });
  }
};
