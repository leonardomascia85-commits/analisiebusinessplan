// api/genera-excel.js — genera report analisi di bilancio in formato Excel (.xls) SpreadsheetML

// ── FORMATTERS ──
const fmtN = (n) => (n === undefined || n === null || isNaN(n) || !isFinite(n)) ? '' : Math.round(n);
const fmtPct = (n, d = 1) => (isNaN(n) || !isFinite(n)) ? '' : parseFloat(n.toFixed(d));
const fmtX = (n, d = 2) => (isNaN(n) || !isFinite(n)) ? '' : parseFloat(n.toFixed(d));
const escXml = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ── CALCOLA INDICI ──
function calcIndici(d) {
  const ebitda = (d.tot_vp || 0) - ((d.mat_prime||0)+(d.servizi||0)+(d.godimento||0)+(d.personale||0)+(d.var_mat||0)+(d.oneri_div||0));
  const ebit = ebitda - (d.ammort || 0);
  const dbt_bt = (d.deb_b_bt||0) + (d.deb_for||0) + (d.deb_trib||0);
  const pfn = ((d.deb_b_bt||0) + (d.deb_b_lt||0)) - (d.liquidita||0);
  const roe = d.tot_pn > 0 ? (d.utile_es||0) / d.tot_pn * 100 : NaN;
  const roi = d.tot_att > 0 ? ebit / d.tot_att * 100 : NaN;
  const ros = d.tot_vp > 0 ? ebit / d.tot_vp * 100 : NaN;
  const cr  = dbt_bt > 0 ? (d.tot_circ||0) / dbt_bt : NaN;
  const acid= dbt_bt > 0 ? ((d.tot_circ||0) - (d.rimanenze||0)) / dbt_bt : NaN;
  const leva= d.tot_pn > 0 ? (d.tot_deb||0) / d.tot_pn : NaN;
  const aut = d.tot_att > 0 ? (d.tot_pn||0) / d.tot_att * 100 : NaN;
  const ebitda_pct = d.tot_vp > 0 ? ebitda / d.tot_vp * 100 : NaN;
  const pfn_ebitda = ebitda > 0 && pfn > 0 ? pfn / ebitda : NaN;
  const icr = (d.oneri_f||0) > 0 ? ebit / d.oneri_f : NaN;
  const servizio = (d.rate_cap||0) + (d.interessi || d.oneri_f || 0);
  const dscr = servizio > 0 && ebitda > 0 ? ebitda / servizio : NaN;
  const dsi = d.mat_prime > 0 && d.rimanenze > 0 ? d.rimanenze / d.mat_prime * 365 : NaN;
  const dso = d.ric_vend > 0 && d.cred_cl > 0 ? d.cred_cl / d.ric_vend * 365 : NaN;
  const dpo = d.mat_prime > 0 && d.deb_for > 0 ? d.deb_for / d.mat_prime * 365 : NaN;
  const ccn_giorni = (!isNaN(dsi)&&!isNaN(dso)&&!isNaN(dpo)) ? dsi+dso-dpo : NaN;
  return { ebitda, ebit, pfn, roe, roi, ros, cr, acid, leva, aut, ebitda_pct, pfn_ebitda, icr, dscr, servizio, dsi, dso, dpo, ccn_giorni };
}

// ── CALCOLA RATING ──
function calcRating(c, d) {
  const v = (x) => (!isNaN(x) && isFinite(x));
  let zScore = null, zLabel = '—', zClass = '';
  const totAtt = d.tot_att || 0;
  if (totAtt > 0) {
    const ccn = (d.tot_circ||0) - ((d.deb_b_bt||0)+(d.deb_for||0)+(d.deb_trib||0));
    const riserve = (d.tot_pn||0) - (d.cap_sociale||0) - (d.utile_es||0);
    const X1=ccn/totAtt, X2=riserve/totAtt, X3=c.ebit/totAtt;
    const X4=d.tot_pn>0&&d.tot_deb>0 ? d.tot_pn/d.tot_deb : (d.tot_pn>0?999:0);
    const X5=(d.ric_vend||d.tot_vp||0)/totAtt;
    zScore=0.877*X1+0.847*X2+3.107*X3+0.420*X4+0.998*X5;
    if(zScore>=2.90){zLabel='Zona sicura (Z > 2,90)';zClass='verde';}
    else if(zScore>=1.23){zLabel='Zona grigia (1,23–2,90)';zClass='giallo';}
    else{zLabel='Zona insolvenza (Z < 1,23)';zClass='rosso';}
  }
  const items=[
    [c.dscr,1.25,1.0,true,25,'DSCR'],
    [c.pfn_ebitda,3.0,5.0,false,20,'PFN/EBITDA'],
    [c.aut,30,15,true,15,'Autonomia fin.'],
    [c.cr,1.5,1.0,true,15,'Current Ratio'],
    [c.roi,8,3,true,10,'ROI'],
    [c.icr,3.0,1.5,true,10,'ICR'],
    [c.leva,2.0,3.5,false,5,'Leva D/E'],
  ];
  let scoreEBA=0, maxEBA=0, ebaDetails=[];
  for(const [val,g,a,higher,peso,nome] of items){
    maxEBA+=peso*2;
    let punti=0, giudizio='n.d.';
    if(v(val)){
      const verde=higher?val>=g:val<=g;
      const giallo=higher?val>=a:val<=a;
      punti=verde?peso*2:giallo?peso:0;
      giudizio=verde?'Ottimo':giallo?'Sufficiente':'Critico';
    }
    scoreEBA+=punti;
    ebaDetails.push({nome,val,g,a,higher,peso,punti,giudizio});
  }
  const pctEBA=maxEBA>0?scoreEBA/maxEBA:0;
  const triggers=[];
  if(v(c.dscr)&&c.dscr<1.1)triggers.push('DSCR < 1,1');
  if(v(c.pfn_ebitda)&&c.pfn_ebitda>6)triggers.push('PFN/EBITDA > 6x');
  if((d.utile_es||0)<0)triggers.push('Perdita d\'esercizio');
  if(v(c.aut)&&c.aut<15)triggers.push('Autonomia < 15%');
  if(v(c.cr)&&c.cr<1.0)triggers.push('Current Ratio < 1,0');
  let ratingScore=pctEBA;
  if(zScore!==null){const zN=zScore>=2.90?1:zScore>=1.23?0.5:0;ratingScore=pctEBA*0.70+zN*0.30;}
  let rating;
  if(ratingScore>=0.82)      rating={l:'A+',title:'Eccellente'};
  else if(ratingScore>=0.68) rating={l:'A', title:'Ottima bancabilità'};
  else if(ratingScore>=0.55) rating={l:'B+',title:'Buona bancabilità'};
  else if(ratingScore>=0.42) rating={l:'B', title:'Bancabilità discreta'};
  else if(ratingScore>=0.28) rating={l:'C', title:'Bancabilità limitata'};
  else                        rating={l:'D', title:'Profilo critico'};
  if(triggers.length>=2){const s=['A+','A','B+','B','C','D'],dn=['A','B+','B','C','D','D'];const i=s.indexOf(rating.l);if(i>=0)rating.l=dn[i];rating.penalized=true;}
  return {...rating,zScore,zLabel,zClass,pctEBA,scoreEBA,maxEBA,ebaDetails,triggers,ratingScore};
}

function calcMCC(c, d) {
  const vv=(x)=>(!isNaN(x)&&isFinite(x));
  const exclusions=[];
  if((d.tot_pn||0)<=0)exclusions.push('Patrimonio netto negativo o nullo — esclusione automatica');
  const pfnPn=(d.tot_pn||0)>0?c.pfn/d.tot_pn:NaN;
  const items=[
    {nome:'ROI — Redditività investimenti',disp:vv(c.roi)?c.roi.toFixed(1)+'%':'n.d.',soglie:'>=0% / >=4% / >=8%',peso:20,pts:vv(c.roi)?(c.roi>=8?20:c.roi>=4?14:c.roi>=0?7:0):0},
    {nome:'EBITDA Margin',disp:vv(c.ebitda_pct)?c.ebitda_pct.toFixed(1)+'%':'n.d.',soglie:'>=3% / >=8% / >=15%',peso:20,pts:vv(c.ebitda_pct)?(c.ebitda_pct>=15?20:c.ebitda_pct>=8?14:c.ebitda_pct>=3?7:0):0},
    {nome:'Autonomia finanziaria',disp:vv(c.aut)?c.aut.toFixed(1)+'%':'n.d.',soglie:'>=15% / >=25% / >=40%',peso:25,pts:vv(c.aut)?(c.aut>=40?25:c.aut>=25?17:c.aut>=15?9:0):0},
    {nome:'Current Ratio',disp:vv(c.cr)?c.cr.toFixed(2)+'x':'n.d.',soglie:'>=0.7x / >=1.0x / >=1.5x',peso:20,pts:vv(c.cr)?(c.cr>=1.5?20:c.cr>=1.0?13:c.cr>=0.7?6:0):0},
    {nome:'PFN / Patrimonio netto',disp:c.pfn<=0?'< 0 OK':vv(pfnPn)?pfnPn.toFixed(2)+'x':'n.d.',soglie:'<=4x / <=2x / <=1x',peso:15,pts:c.pfn<=0?15:vv(pfnPn)?(pfnPn<=1?15:pfnPn<=2?10:pfnPn<=4?5:0):0},
  ];
  const totalScore=items.reduce((s,i)=>s+i.pts,0);
  let fascia, fasciaLabel, copertura, eligible;
  if(exclusions.length>0&&(d.tot_pn||0)<=0){fascia=5;fasciaLabel='Non ammissibile';copertura='—';eligible=false;}
  else if(totalScore>=75){fascia=1;fasciaLabel='Eccellente';copertura="fino all'80%";eligible=true;}
  else if(totalScore>=55){fascia=2;fasciaLabel='Buona bancabilità';copertura='fino al 70%';eligible=true;}
  else if(totalScore>=35){fascia=3;fasciaLabel='Bancabilità media';copertura='fino al 60%';eligible=true;}
  else if(totalScore>=15){fascia=4;fasciaLabel='Bancabilità bassa';copertura='fino al 40%';eligible=true;}
  else{fascia=5;fasciaLabel='Non ammissibile';copertura='—';eligible=false;}
  return{fascia,fasciaLabel,totalScore,items,exclusions,copertura,eligible};
}

// ── HELPER CELLA SpreadsheetML ──
function cell(row, col, value, type, styleId) {
  const t = type || (typeof value === 'number' ? 'Number' : 'String');
  const s = styleId ? ` ss:StyleID="${styleId}"` : '';
  const v = value === '' || value === null || value === undefined ? '' : escXml(String(value));
  return `<Cell${s}><Data ss:Type="${t}">${v}</Data></Cell>`;
}

function rowHdr(cells) {
  return `<Row>${cells}</Row>\n`;
}

function buildExcelXML(data, config, prevData) {
  const d = data;
  const c = calcIndici(d);
  const rating = calcRating(c, d);
  const mcc = calcMCC(c, d);
  const nome = config.nome || 'Azienda';
  const anno = config.anno || new Date().getFullYear();
  const dataReport = config.dataReport || new Date().toLocaleDateString('it-IT');

  // Calcola anno precedente se presente
  let cp = null;
  if (prevData) cp = calcIndici(prevData);

  // ── STILI ──
  const styles = `
  <Styles>
    <Style ss:ID="Default"><Alignment ss:Vertical="Bottom"/><Font ss:FontName="Calibri" ss:Size="10"/></Style>
    <Style ss:ID="hdr1"><Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#0A1628"/><Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#2563EB"/></Borders></Style>
    <Style ss:ID="hdr2"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0A1628" ss:Pattern="Solid"/></Style>
    <Style ss:ID="tot"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1"/><Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/></Style>
    <Style ss:ID="ebitda"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#065F46"/><Interior ss:Color="#D1FAE5" ss:Pattern="Solid"/></Style>
    <Style ss:ID="pos"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#059669"/></Style>
    <Style ss:ID="neg"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#DC2626"/></Style>
    <Style ss:ID="warn"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#D97706"/></Style>
    <Style ss:ID="num"><Alignment ss:Horizontal="Right"/><NumberFormat ss:Format="#,##0"/></Style>
    <Style ss:ID="totnum"><Alignment ss:Horizontal="Right"/><NumberFormat ss:Format="#,##0"/><Font ss:Bold="1"/><Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/></Style>
    <Style ss:ID="ebitdanum"><Alignment ss:Horizontal="Right"/><NumberFormat ss:Format="#,##0"/><Font ss:Bold="1" ss:Color="#065F46"/><Interior ss:Color="#D1FAE5" ss:Pattern="Solid"/></Style>
    <Style ss:ID="pct"><Alignment ss:Horizontal="Right"/><NumberFormat ss:Format="0.0&quot;%&quot;"/></Style>
    <Style ss:ID="mult"><Alignment ss:Horizontal="Right"/><NumberFormat ss:Format="0.00&quot;x&quot;"/></Style>
    <Style ss:ID="grey"><Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/><Font ss:Bold="1" ss:Color="#334155"/></Style>
    <Style ss:ID="cover"><Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#0A1628"/></Style>
    <Style ss:ID="label"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#64748B"/></Style>
  </Styles>`;

  // ── FOGLIO 1: RIEPILOGO ──
  const sRiep = (() => {
    let r = '';
    r += `<Row ss:Height="30"><Cell ss:MergeAcross="3" ss:StyleID="hdr1"><Data ss:Type="String">ANALISI DI BILANCIO — ${escXml(nome)} — Esercizio ${anno}</Data></Cell></Row>\n`;
    r += `<Row><Cell ss:StyleID="label"><Data ss:Type="String">Data elaborazione</Data></Cell><Cell><Data ss:Type="String">${dataReport}</Data></Cell></Row>\n`;
    r += `<Row/>\n`;
    r += `<Row><Cell ss:MergeAcross="3" ss:StyleID="hdr2"><Data ss:Type="String">RATING E BANCABILITÀ</Data></Cell></Row>\n`;
    r += `<Row><Cell ss:StyleID="grey"><Data ss:Type="String">Rating</Data></Cell><Cell><Data ss:Type="String">${rating.l} — ${rating.title}</Data></Cell></Row>\n`;
    r += `<Row><Cell ss:StyleID="grey"><Data ss:Type="String">Score EBA</Data></Cell><Cell><Data ss:Type="Number">${Math.round(rating.pctEBA*100)}</Data></Cell><Cell ss:StyleID="label"><Data ss:Type="String">%</Data></Cell></Row>\n`;
    r += `<Row><Cell ss:StyleID="grey"><Data ss:Type="String">Z-Score Altman</Data></Cell><Cell><Data ss:Type="${rating.zScore!==null?'Number':'String'}">${rating.zScore!==null?parseFloat(rating.zScore.toFixed(2)):'n.d.'}</Data></Cell><Cell ss:StyleID="label"><Data ss:Type="String">${rating.zLabel}</Data></Cell></Row>\n`;
    r += `<Row/>\n`;
    r += `<Row><Cell ss:MergeAcross="3" ss:StyleID="hdr2"><Data ss:Type="String">INDICATORI CHIAVE</Data></Cell></Row>\n`;
    const kpi = [
      ['EBITDA (€)', fmtN(c.ebitda), 'num'],
      ['EBIT (€)', fmtN(c.ebit), 'num'],
      ['PFN (€)', fmtN(c.pfn), 'num'],
      ['ROE', fmtPct(c.roe), 'pct'],
      ['ROI', fmtPct(c.roi), 'pct'],
      ['ROS', fmtPct(c.ros), 'pct'],
      ['EBITDA Margin', fmtPct(c.ebitda_pct), 'pct'],
      ['Current Ratio', fmtX(c.cr), 'mult'],
      ['Autonomia finanziaria', fmtPct(c.aut), 'pct'],
      ['DSCR', fmtX(c.dscr), 'mult'],
      ['PFN/EBITDA', fmtX(c.pfn_ebitda), 'mult'],
      ['ICR', fmtX(c.icr), 'mult'],
      ['Leva D/E', fmtX(c.leva), 'mult'],
    ];
    for(const [lbl,val,fmt] of kpi){
      const sId = val==='' ? 'grey' : fmt;
      r += `<Row><Cell ss:StyleID="grey"><Data ss:Type="String">${lbl}</Data></Cell><Cell ss:StyleID="${sId}"><Data ss:Type="${val===''?'String':'Number'}">${val===''?'n.d.':val}</Data></Cell></Row>\n`;
    }
    r += `<Row/>\n`;
    r += `<Row><Cell ss:MergeAcross="3" ss:StyleID="hdr2"><Data ss:Type="String">MCC — FONDO CENTRALE DI GARANZIA</Data></Cell></Row>\n`;
    r += `<Row><Cell ss:StyleID="grey"><Data ss:Type="String">Fascia MCC</Data></Cell><Cell><Data ss:Type="String">${mcc.fascia} — ${mcc.fasciaLabel}</Data></Cell></Row>\n`;
    r += `<Row><Cell ss:StyleID="grey"><Data ss:Type="String">Punteggio</Data></Cell><Cell><Data ss:Type="Number">${mcc.totalScore}</Data></Cell><Cell ss:StyleID="label"><Data ss:Type="String">/ 100</Data></Cell></Row>\n`;
    r += `<Row><Cell ss:StyleID="grey"><Data ss:Type="String">Copertura garanzia</Data></Cell><Cell><Data ss:Type="String">${mcc.copertura}</Data></Cell></Row>\n`;
    if(rating.triggers.length>0){
      r += `<Row/>\n`;
      r += `<Row><Cell ss:MergeAcross="3" ss:StyleID="hdr2"><Data ss:Type="String">SEGNALI DI ALLERTA CCII</Data></Cell></Row>\n`;
      rating.triggers.forEach(t => { r += `<Row><Cell><Data ss:Type="String">⚠ ${escXml(t)}</Data></Cell></Row>\n`; });
    }
    return `<Worksheet ss:Name="Riepilogo"><Table ss:DefaultColumnWidth="160">\n${r}</Table></Worksheet>`;
  })();

  // ── FOGLIO 2: STATO PATRIMONIALE ──
  const sSP = (() => {
    let r = '';
    r += `<Row ss:Height="24"><Cell ss:MergeAcross="${cp?2:1}" ss:StyleID="hdr1"><Data ss:Type="String">STATO PATRIMONIALE — ${escXml(nome)}</Data></Cell></Row>\n`;
    const hdrRow = cp
      ? `<Row><Cell ss:StyleID="hdr2"><Data ss:Type="String">Voce</Data></Cell><Cell ss:StyleID="hdr2"><Data ss:Type="String">Anno ${anno} (€)</Data></Cell><Cell ss:StyleID="hdr2"><Data ss:Type="String">Anno prec. (€)</Data></Cell></Row>\n`
      : `<Row><Cell ss:StyleID="hdr2"><Data ss:Type="String">Voce</Data></Cell><Cell ss:StyleID="hdr2"><Data ss:Type="String">Anno ${anno} (€)</Data></Cell></Row>\n`;
    r += hdrRow;

    const rows = [
      ['ATTIVO', null, true, 'sect'],
      ['Immobilizzazioni immateriali', d.imm_imm, false, null, prevData?.imm_imm],
      ['Immobilizzazioni materiali', d.imm_mat, false, null, prevData?.imm_mat],
      ['Immobilizzazioni finanziarie', d.imm_fin, false, null, prevData?.imm_fin],
      ['Totale Attivo Fisso', d.tot_fisso, true, null, prevData?.tot_fisso],
      ['Rimanenze', d.rimanenze, false, null, prevData?.rimanenze],
      ['Crediti verso clienti', d.cred_cl, false, null, prevData?.cred_cl],
      ['Altri crediti', d.alt_cr, false, null, prevData?.alt_cr],
      ['Liquidità', d.liquidita, false, null, prevData?.liquidita],
      ['Ratei e risconti attivi', d.ratei_att, false, null, prevData?.ratei_att],
      ['Totale Attivo Circolante', d.tot_circ, true, null, prevData?.tot_circ],
      ['TOTALE ATTIVO', d.tot_att, true, 'bold', prevData?.tot_att],
      ['', null, false, 'empty'],
      ['PASSIVO', null, true, 'sect'],
      ['Capitale sociale', d.cap_sociale, false, null, prevData?.cap_sociale],
      ['Riserve', d.riserve, false, null, prevData?.riserve],
      ['Utile (Perdita) di esercizio', d.utile_es, false, null, prevData?.utile_es],
      ['Totale Patrimonio Netto', d.tot_pn, true, null, prevData?.tot_pn],
      ['Debiti bancari a lungo termine', d.deb_b_lt, false, null, prevData?.deb_b_lt],
      ['Fondo TFR', d.tfr, false, null, prevData?.tfr],
      ['Totale Passivo a Lungo', d.tot_plt, true, null, prevData?.tot_plt],
      ['Debiti bancari a breve', d.deb_b_bt, false, null, prevData?.deb_b_bt],
      ['Debiti verso fornitori', d.deb_for, false, null, prevData?.deb_for],
      ['Debiti tributari/previdenziali', d.deb_trib, false, null, prevData?.deb_trib],
      ['Altri debiti', d.alt_deb, false, null, prevData?.alt_deb],
      ['Ratei e risconti passivi', d.ratei_pas, false, null, prevData?.ratei_pas],
      ['Totale Passivo a Breve', d.tot_pbt, true, null, prevData?.tot_pbt],
      ['TOTALE PASSIVO', d.tot_pas, true, 'bold', prevData?.tot_pas],
    ];

    for(const [lbl, val, bold, spec, prevVal] of rows){
      if(spec==='empty'){r+=`<Row/>\n`;continue;}
      if(spec==='sect'){
        r+=`<Row><Cell ss:MergeAcross="${cp?2:1}" ss:StyleID="grey"><Data ss:Type="String">${escXml(lbl)}</Data></Cell></Row>\n`;
        continue;
      }
      const ls = bold?'tot':'Default';
      const ns = bold?'totnum':'num';
      const v = val!=null&&val!==0&&!isNaN(val) ? fmtN(val) : '';
      let rowStr = `<Cell ss:StyleID="${ls}"><Data ss:Type="String">${escXml(lbl)}</Data></Cell>`;
      rowStr += `<Cell ss:StyleID="${ns}"><Data ss:Type="${v!==''?'Number':'String'}">${v!==''?v:''}</Data></Cell>`;
      if(cp){
        const pv = prevVal!=null&&prevVal!==0&&!isNaN(prevVal) ? fmtN(prevVal) : '';
        rowStr += `<Cell ss:StyleID="${ns}"><Data ss:Type="${pv!==''?'Number':'String'}">${pv}</Data></Cell>`;
      }
      r += `<Row>${rowStr}</Row>\n`;
    }

    // Variazioni se anno precedente
    if(cp){
      r += `<Row/>\n`;
      r += `<Row><Cell ss:MergeAcross="2" ss:StyleID="hdr2"><Data ss:Type="String">VARIAZIONI ANNO SU ANNO</Data></Cell></Row>\n`;
      r += `<Row><Cell ss:StyleID="hdr2"><Data ss:Type="String">Voce</Data></Cell><Cell ss:StyleID="hdr2"><Data ss:Type="String">Var. assoluta (€)</Data></Cell><Cell ss:StyleID="hdr2"><Data ss:Type="String">Var. %</Data></Cell></Row>\n`;
      const varRows = [
        ['Totale Attivo', d.tot_att, prevData.tot_att],
        ['Patrimonio Netto', d.tot_pn, prevData.tot_pn],
        ['Passivo a Lungo', d.tot_plt, prevData.tot_plt],
        ['Passivo a Breve', d.tot_pbt, prevData.tot_pbt],
      ];
      for(const [lbl, cur, prev] of varRows){
        if(!cur||!prev)continue;
        const diff = cur - prev;
        const pct = prev !== 0 ? (diff/Math.abs(prev)*100) : NaN;
        const sId = diff>=0?'pos':'neg';
        r += `<Row><Cell ss:StyleID="grey"><Data ss:Type="String">${escXml(lbl)}</Data></Cell><Cell ss:StyleID="${sId}"><Data ss:Type="Number">${fmtN(diff)}</Data></Cell><Cell ss:StyleID="${sId}"><Data ss:Type="${isNaN(pct)?'String':'Number'}">${isNaN(pct)?'n.d.':fmtPct(pct)}</Data></Cell></Row>\n`;
      }
    }

    return `<Worksheet ss:Name="Stato Patrimoniale"><Table ss:DefaultColumnWidth="200">\n${r}</Table></Worksheet>`;
  })();

  // ── FOGLIO 3: CONTO ECONOMICO ──
  const sCE = (() => {
    let r = '';
    r += `<Row ss:Height="24"><Cell ss:MergeAcross="${cp?2:1}" ss:StyleID="hdr1"><Data ss:Type="String">CONTO ECONOMICO — ${escXml(nome)}</Data></Cell></Row>\n`;
    const hdrRow = cp
      ? `<Row><Cell ss:StyleID="hdr2"><Data ss:Type="String">Voce</Data></Cell><Cell ss:StyleID="hdr2"><Data ss:Type="String">Anno ${anno} (€)</Data></Cell><Cell ss:StyleID="hdr2"><Data ss:Type="String">Anno prec. (€)</Data></Cell></Row>\n`
      : `<Row><Cell ss:StyleID="hdr2"><Data ss:Type="String">Voce</Data></Cell><Cell ss:StyleID="hdr2"><Data ss:Type="String">Anno ${anno} (€)</Data></Cell></Row>\n`;
    r += hdrRow;

    const rows = [
      ['Ricavi di vendita', d.ric_vend, false, null, prevData?.ric_vend],
      ['Variazione rimanenze', d.var_mag, false, null, prevData?.var_mag],
      ['Altri ricavi', d.alt_ric, false, null, prevData?.alt_ric],
      ['Totale Valore della Produzione', d.tot_vp, true, null, prevData?.tot_vp],
      ['Materie prime e consumo', d.mat_prime, false, null, prevData?.mat_prime],
      ['Variazione materie prime', d.var_mat, false, null, prevData?.var_mat],
      ['Servizi', d.servizi, false, null, prevData?.servizi],
      ['Godimento beni di terzi', d.godimento, false, null, prevData?.godimento],
      ['Costo del personale', d.personale, false, null, prevData?.personale],
      ['Oneri diversi di gestione', d.oneri_div, false, null, prevData?.oneri_div],
      ['EBITDA', c.ebitda, true, 'ebitda', cp?.ebitda],
      ['Ammortamenti e svalutazioni', d.ammort, false, null, prevData?.ammort],
      ['EBIT (Reddito operativo)', c.ebit, true, null, cp?.ebit],
      ['Proventi finanziari', d.prov_fin, false, null, prevData?.prov_fin],
      ['Oneri finanziari', d.oneri_f, false, null, prevData?.oneri_f],
      ['Risultato ante imposte', c.ebit+(d.prov_fin||0)-(d.oneri_f||0), true, null, cp?(cp.ebit+(prevData?.prov_fin||0)-(prevData?.oneri_f||0)):null],
      ['Imposte', d.imposte, false, null, prevData?.imposte],
      ['Utile (Perdita) netto', d.utile_es, true, null, prevData?.utile_es],
    ];

    for(const [lbl, val, bold, spec, prevVal] of rows){
      const isEbitda = spec==='ebitda';
      const ls = isEbitda?'ebitda':bold?'tot':'Default';
      const ns = isEbitda?'ebitdanum':bold?'totnum':'num';
      const v = val!=null&&!isNaN(val)&&val!==0 ? fmtN(val) : '';
      let rowStr = `<Cell ss:StyleID="${ls}"><Data ss:Type="String">${escXml(lbl)}</Data></Cell>`;
      rowStr += `<Cell ss:StyleID="${ns}"><Data ss:Type="${v!==''?'Number':'String'}">${v}</Data></Cell>`;
      if(cp){
        const pv = prevVal!=null&&!isNaN(prevVal)&&prevVal!==0 ? fmtN(prevVal) : '';
        rowStr += `<Cell ss:StyleID="${ns}"><Data ss:Type="${pv!==''?'Number':'String'}">${pv}</Data></Cell>`;
      }
      r += `<Row>${rowStr}</Row>\n`;
    }

    // KPI Margini
    r += `<Row/>\n`;
    r += `<Row><Cell ss:MergeAcross="${cp?2:1}" ss:StyleID="hdr2"><Data ss:Type="String">MARGINI E REDDITIVITÀ</Data></Cell></Row>\n`;
    r += `<Row><Cell ss:StyleID="hdr2"><Data ss:Type="String">Indice</Data></Cell><Cell ss:StyleID="hdr2"><Data ss:Type="String">Anno ${anno}</Data></Cell>${cp?`<Cell ss:StyleID="hdr2"><Data ss:Type="String">Anno prec.</Data></Cell>`:''}</Row>\n`;
    const margins = [
      ['EBITDA Margin', fmtPct(c.ebitda_pct), 'pct', cp?fmtPct(cp.ebitda_pct):null],
      ['EBIT Margin (ROS)', fmtPct(c.ros), 'pct', cp?fmtPct(cp.ros):null],
      ['Utile netto / Fatturato', d.tot_vp>0?fmtPct((d.utile_es||0)/d.tot_vp*100):null, 'pct', (cp&&prevData?.tot_vp>0)?fmtPct((prevData?.utile_es||0)/prevData.tot_vp*100):null],
      ['Costo personale / Fatturato', d.tot_vp>0?fmtPct((d.personale||0)/d.tot_vp*100):null, 'pct', null],
    ];
    for(const [lbl, val, fmt, prevVal] of margins){
      const v = val!=null&&val!=='' ? val : '';
      let rowStr = `<Cell ss:StyleID="grey"><Data ss:Type="String">${escXml(lbl)}</Data></Cell><Cell ss:StyleID="${fmt}"><Data ss:Type="${v!==''?'Number':'String'}">${v}</Data></Cell>`;
      if(cp){ const pv=prevVal!=null&&prevVal!==''?prevVal:''; rowStr+=`<Cell ss:StyleID="${fmt}"><Data ss:Type="${pv!==''?'Number':'String'}">${pv}</Data></Cell>`; }
      r += `<Row>${rowStr}</Row>\n`;
    }

    return `<Worksheet ss:Name="Conto Economico"><Table ss:DefaultColumnWidth="200">\n${r}</Table></Worksheet>`;
  })();

  // ── FOGLIO 4: INDICI ──
  const sIndici = (() => {
    let r = '';
    r += `<Row ss:Height="24"><Cell ss:MergeAcross="${cp?3:2}" ss:StyleID="hdr1"><Data ss:Type="String">INDICI DI BILANCIO — ${escXml(nome)}</Data></Cell></Row>\n`;
    r += `<Row><Cell ss:StyleID="hdr2"><Data ss:Type="String">Indicatore</Data></Cell><Cell ss:StyleID="hdr2"><Data ss:Type="String">Anno ${anno}</Data></Cell>${cp?`<Cell ss:StyleID="hdr2"><Data ss:Type="String">Anno prec.</Data></Cell>`:''}<Cell ss:StyleID="hdr2"><Data ss:Type="String">Giudizio</Data></Cell></Row>\n`;

    const indici = [
      {cat:'REDDITIVITÀ', items:[
        ['ROE — Redditività c. proprio', c.roe, 'pct', cp?.roe, true, 10, 5],
        ['ROI — Redditività c. investito', c.roi, 'pct', cp?.roi, true, 8, 3],
        ['ROS — Redditività vendite', c.ros, 'pct', cp?.ros, true, 5, 2],
        ['EBITDA Margin', c.ebitda_pct, 'pct', cp?.ebitda_pct, true, 15, 8],
      ]},
      {cat:'LIQUIDITÀ', items:[
        ['Current Ratio', c.cr, 'mult', cp?.cr, true, 1.5, 1.0],
        ['Acid Test', c.acid, 'mult', cp?.acid, true, 1.0, 0.7],
      ]},
      {cat:'STRUTTURA FINANZIARIA', items:[
        ['Autonomia finanziaria', c.aut, 'pct', cp?.aut, true, 40, 15],
        ['Leva finanziaria (D/E)', c.leva, 'mult', cp?.leva, false, 2.0, 3.5],
        ['PFN / EBITDA', c.pfn_ebitda, 'mult', cp?.pfn_ebitda, false, 3.0, 5.0],
      ]},
      {cat:'BANCABILITÀ EBA', items:[
        ['DSCR — Debt Service Coverage', c.dscr, 'mult', cp?.dscr, true, 1.25, 1.0],
        ['ICR — Interest Coverage', c.icr, 'mult', cp?.icr, true, 3.0, 1.5],
        ['PFN (€)', c.pfn, 'num', cp?.pfn, null, null, null],
        ['EBITDA (€)', c.ebitda, 'num', cp?.ebitda, null, null, null],
      ]},
      {cat:'CICLO OPERATIVO', items:[
        ['DSI — Giorni di magazzino', c.dsi, 'num', cp?.dsi, null, null, null],
        ['DSO — Giorni crediti clienti', c.dso, 'num', cp?.dso, null, null, null],
        ['DPO — Giorni debiti fornitori', c.dpo, 'num', cp?.dpo, null, null, null],
        ['CCN — Ciclo cassa (gg)', c.ccn_giorni, 'num', cp?.ccn_giorni, null, null, null],
      ]},
    ];

    const giudizioText = (val, higher, g, a) => {
      if(isNaN(val)||!isFinite(val)||higher===null) return '';
      if(higher) return val>=g?'Ottimo':val>=a?'Sufficiente':'Critico';
      return val<=g?'Ottimo':val<=a?'Sufficiente':'Critico';
    };
    const giudizioStyle = (val, higher, g, a) => {
      if(isNaN(val)||!isFinite(val)||higher===null) return 'Default';
      if(higher) return val>=g?'pos':val>=a?'warn':'neg';
      return val<=g?'pos':val<=a?'warn':'neg';
    };

    for(const {cat, items} of indici){
      r += `<Row><Cell ss:MergeAcross="${cp?3:2}" ss:StyleID="grey"><Data ss:Type="String">${escXml(cat)}</Data></Cell></Row>\n`;
      for(const [lbl, val, fmt, prevVal, higher, g, a] of items){
        const v = val!=null&&!isNaN(val)&&isFinite(val) ? (fmt==='pct'?fmtPct(val):fmt==='mult'?fmtX(val):fmtN(val)) : '';
        const pv = prevVal!=null&&!isNaN(prevVal)&&isFinite(prevVal) ? (fmt==='pct'?fmtPct(prevVal):fmt==='mult'?fmtX(prevVal):fmtN(prevVal)) : '';
        const gText = giudizioText(val, higher, g, a);
        const gSty = giudizioStyle(val, higher, g, a);
        let row = `<Cell ss:StyleID="Default"><Data ss:Type="String">${escXml(lbl)}</Data></Cell>`;
        row += `<Cell ss:StyleID="${fmt}"><Data ss:Type="${v!==''?'Number':'String'}">${v}</Data></Cell>`;
        if(cp) row += `<Cell ss:StyleID="${fmt}"><Data ss:Type="${pv!==''?'Number':'String'}">${pv}</Data></Cell>`;
        row += `<Cell ss:StyleID="${gSty}"><Data ss:Type="String">${escXml(gText)}</Data></Cell>`;
        r += `<Row>${row}</Row>\n`;
      }
    }

    return `<Worksheet ss:Name="Indici"><Table ss:DefaultColumnWidth="180">\n${r}</Table></Worksheet>`;
  })();

  // ── FOGLIO 5: BANCABILITÀ EBA ──
  const sEBA = (() => {
    let r = '';
    r += `<Row ss:Height="24"><Cell ss:MergeAcross="4" ss:StyleID="hdr1"><Data ss:Type="String">SCORECARD BANCABILITÀ EBA — ${escXml(nome)}</Data></Cell></Row>\n`;
    r += `<Row><Cell ss:StyleID="hdr2"><Data ss:Type="String">Indicatore</Data></Cell><Cell ss:StyleID="hdr2"><Data ss:Type="String">Valore</Data></Cell><Cell ss:StyleID="hdr2"><Data ss:Type="String">Soglia verde</Data></Cell><Cell ss:StyleID="hdr2"><Data ss:Type="String">Soglia gialla</Data></Cell><Cell ss:StyleID="hdr2"><Data ss:Type="String">Giudizio</Data></Cell><Cell ss:StyleID="hdr2"><Data ss:Type="String">Punti</Data></Cell></Row>\n`;
    for(const item of rating.ebaDetails){
      const valStr = isNaN(item.val)||!isFinite(item.val)?'n.d.':(item.nome.includes('PFN')||item.nome.includes('DSCR')||item.nome.includes('ICR')||item.nome.includes('Leva')||item.nome.includes('Current')?fmtX(item.val):fmtPct(item.val));
      const gSty = item.punti===item.peso*2?'pos':item.punti>0?'warn':'neg';
      const sogV = item.higher ? `>= ${item.g}` : `<= ${item.g}`;
      const sogA = item.higher ? `>= ${item.a}` : `<= ${item.a}`;
      r += `<Row><Cell><Data ss:Type="String">${escXml(item.nome)}</Data></Cell><Cell ss:StyleID="${item.nome.includes('Autonomia')||item.nome.includes('ROI')?'pct':'mult'}"><Data ss:Type="${isNaN(item.val)||!isFinite(item.val)?'String':'Number'}">${isNaN(item.val)||!isFinite(item.val)?'n.d.':(item.nome.includes('Autonomia')||item.nome.includes('ROI')?fmtPct(item.val):fmtX(item.val))}</Data></Cell><Cell ss:StyleID="label"><Data ss:Type="String">${sogV}</Data></Cell><Cell ss:StyleID="label"><Data ss:Type="String">${sogA}</Data></Cell><Cell ss:StyleID="${gSty}"><Data ss:Type="String">${escXml(item.giudizio)}</Data></Cell><Cell ss:StyleID="num"><Data ss:Type="Number">${item.punti}</Data></Cell></Row>\n`;
    }
    r += `<Row><Cell ss:MergeAcross="4" ss:StyleID="tot"><Data ss:Type="String">TOTALE EBA</Data></Cell><Cell ss:StyleID="totnum"><Data ss:Type="Number">${rating.scoreEBA}</Data></Cell></Row>\n`;
    r += `<Row/>\n`;
    r += `<Row><Cell ss:MergeAcross="5" ss:StyleID="hdr2"><Data ss:Type="String">RATING FINALE</Data></Cell></Row>\n`;
    r += `<Row><Cell ss:StyleID="grey"><Data ss:Type="String">Rating</Data></Cell><Cell ss:MergeAcross="4"><Data ss:Type="String">${rating.l} — ${rating.title}</Data></Cell></Row>\n`;
    r += `<Row><Cell ss:StyleID="grey"><Data ss:Type="String">Score composito</Data></Cell><Cell ss:StyleID="pct"><Data ss:Type="Number">${fmtPct(rating.ratingScore*100)}</Data></Cell></Row>\n`;
    r += `<Row><Cell ss:StyleID="grey"><Data ss:Type="String">Z-Score Altman</Data></Cell><Cell><Data ss:Type="${rating.zScore!==null?'Number':'String'}">${rating.zScore!==null?parseFloat(rating.zScore.toFixed(2)):'n.d.'}</Data></Cell><Cell ss:MergeAcross="3"><Data ss:Type="String">${escXml(rating.zLabel)}</Data></Cell></Row>\n`;
    if(rating.triggers.length>0){
      r += `<Row/>\n`;
      r += `<Row><Cell ss:MergeAcross="5" ss:StyleID="grey"><Data ss:Type="String">SEGNALI DI ALLERTA CCII</Data></Cell></Row>\n`;
      rating.triggers.forEach(t => { r += `<Row><Cell ss:MergeAcross="5" ss:StyleID="neg"><Data ss:Type="String">⚠ ${escXml(t)}</Data></Cell></Row>\n`; });
    }
    return `<Worksheet ss:Name="Bancabilità EBA"><Table ss:DefaultColumnWidth="150">\n${r}</Table></Worksheet>`;
  })();

  // ── FOGLIO 6: MCC ──
  const sMCC = (() => {
    let r = '';
    r += `<Row ss:Height="24"><Cell ss:MergeAcross="3" ss:StyleID="hdr1"><Data ss:Type="String">RATING MCC — FONDO CENTRALE DI GARANZIA — ${escXml(nome)}</Data></Cell></Row>\n`;
    r += `<Row><Cell ss:StyleID="hdr2"><Data ss:Type="String">Criterio</Data></Cell><Cell ss:StyleID="hdr2"><Data ss:Type="String">Valore</Data></Cell><Cell ss:StyleID="hdr2"><Data ss:Type="String">Soglie</Data></Cell><Cell ss:StyleID="hdr2"><Data ss:Type="String">Punti / Peso</Data></Cell></Row>\n`;
    for(const item of mcc.items){
      const pts = `${item.pts} / ${item.peso}`;
      const sId = item.pts===item.peso?'pos':item.pts>0?'warn':'neg';
      r += `<Row><Cell><Data ss:Type="String">${escXml(item.nome)}</Data></Cell><Cell><Data ss:Type="String">${escXml(item.disp)}</Data></Cell><Cell ss:StyleID="label"><Data ss:Type="String">${escXml(item.soglie)}</Data></Cell><Cell ss:StyleID="${sId}"><Data ss:Type="String">${pts}</Data></Cell></Row>\n`;
    }
    r += `<Row><Cell ss:MergeAcross="2" ss:StyleID="tot"><Data ss:Type="String">PUNTEGGIO TOTALE</Data></Cell><Cell ss:StyleID="totnum"><Data ss:Type="Number">${mcc.totalScore}</Data></Cell></Row>\n`;
    r += `<Row/>\n`;
    r += `<Row><Cell ss:MergeAcross="3" ss:StyleID="hdr2"><Data ss:Type="String">ESITO</Data></Cell></Row>\n`;
    r += `<Row><Cell ss:StyleID="grey"><Data ss:Type="String">Fascia MCC</Data></Cell><Cell ss:MergeAcross="2"><Data ss:Type="String">${mcc.fascia} — ${mcc.fasciaLabel}</Data></Cell></Row>\n`;
    r += `<Row><Cell ss:StyleID="grey"><Data ss:Type="String">Punteggio</Data></Cell><Cell><Data ss:Type="Number">${mcc.totalScore}</Data></Cell><Cell ss:StyleID="label"><Data ss:Type="String">su 100</Data></Cell></Row>\n`;
    r += `<Row><Cell ss:StyleID="grey"><Data ss:Type="String">Copertura garanzia</Data></Cell><Cell ss:MergeAcross="2"><Data ss:Type="String">${escXml(mcc.copertura)}</Data></Cell></Row>\n`;
    r += `<Row><Cell ss:StyleID="grey"><Data ss:Type="String">Ammissibilità</Data></Cell><Cell ss:MergeAcross="2" ss:StyleID="${mcc.eligible?'pos':'neg'}"><Data ss:Type="String">${mcc.eligible?'Ammissibile':'Non ammissibile'}</Data></Cell></Row>\n`;
    if(mcc.exclusions.length>0){
      r += `<Row/>\n`;
      mcc.exclusions.forEach(e => { r += `<Row><Cell ss:MergeAcross="3" ss:StyleID="neg"><Data ss:Type="String">${escXml(e)}</Data></Cell></Row>\n`; });
    }
    return `<Worksheet ss:Name="Rating MCC"><Table ss:DefaultColumnWidth="200">\n${r}</Table></Worksheet>`;
  })();

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
<DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>Analisi di Bilancio Web App</Author>
  <Title>Analisi Bilancio ${escXml(nome)} ${anno}</Title>
  <Created>${new Date().toISOString()}</Created>
</DocumentProperties>
${styles}
${sRiep}
${sSP}
${sCE}
${sIndici}
${sEBA}
${sMCC}
</Workbook>`;
}

module.exports = function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { data, config } = req.body;
  if (!data) return res.status(400).json({ error: 'Dati bilancio mancanti' });
  try {
    const prevData = data._prev || null;
    const xml = buildExcelXML(data, config || {}, prevData);
    const nome = (config?.nome || 'Report').replace(/[^a-zA-Z0-9]/g, '-');
    const anno = config?.anno || new Date().getFullYear();
    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader('Content-Disposition', `attachment; filename="Analisi-Bilancio-${nome}-${anno}.xls"`);
    res.status(200).send(xml);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
