// api/genera-bp.js — Business Plan Finanziario
// EBA/GL/2020/06 compliant · 3-statement model (CE + SP + CF)

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const d = req.body;
    const result = buildBusinessPlan(d);
    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
function buildBusinessPlan(d) {
  const annoBase = d.anno_base || 2024;

  // ── Tassi di crescita ricavi
  const g = [d.g1 / 100, d.g2 / 100, d.g3 / 100];

  // ── Ricavi proiettati
  const R0 = d.ricavi_base || 0;
  const R1 = R0 * (1 + g[0]) + (d.new_products_rev || 0) + (d.new_markets_rev || 0);
  const R2 = R1 * (1 + g[1]);
  const R3 = R2 * (1 + g[2]);

  // ── EBITDA margin atteso
  const emPct = (d.ebitda_margin || 0) / 100;
  const EBITDA0 = d.ebitda_storico || 0;
  const EBITDA1 = R1 * emPct;
  const EBITDA2 = R2 * emPct;
  const EBITDA3 = R3 * emPct;

  // ── Costo personale
  const incrP = (d.incr_pers || 2) / 100;
  let CP0 = d.costo_pers_storico || (d.n_dip * d.costo_medio_dip) || 0;
  if (!CP0 && d.n_dip && d.costo_medio_dip) CP0 = d.n_dip * d.costo_medio_dip;

  // Extra assunzioni
  const extraCP = [0, 0, 0];
  (d.assunzioni || []).forEach(a => {
    const idx = (a.anno || 1) - 1;
    const cost = (a.n || 1) * (a.costo || 35000);
    for (let i = idx; i < 3; i++) extraCP[i] += cost;
  });
  const consul = d.consulenze || 0;
  const CP1 = CP0 * (1 + incrP) + extraCP[0] + consul;
  const CP2 = CP1 * (1 + incrP) + extraCP[1];
  const CP3 = CP2 * (1 + incrP) + extraCP[2];

  // ── Ammortamenti (fissi + nuovi capex)
  const ammBase = d.ammortamenti || 0;
  const capexAmm = calcCapexAmm(d.capex || []);
  const AMM1 = ammBase + capexAmm[0];
  const AMM2 = ammBase + capexAmm[1];
  const AMM3 = ammBase + capexAmm[2];

  // ── EBIT = EBITDA − Ammortamenti
  const EBIT1 = EBITDA1 - AMM1;
  const EBIT2 = EBITDA2 - AMM2;
  const EBIT3 = EBITDA3 - AMM3;

  // ── Oneri finanziari
  const OF_exist = d.interessi_esistenti || 0;
  let OF_new1 = 0, OF_new2 = 0, OF_new3 = 0;
  let rcap_new1 = 0, rcap_new2 = 0, rcap_new3 = 0;
  if (d.nuovo_fin && d.fin_importo) {
    const { schedule } = calcMutuo(d.fin_importo, d.fin_durata, d.fin_tasso / 100, d.pre_amm || 0);
    OF_new1 = schedule[0]?.interessi || 0;
    OF_new2 = schedule[1]?.interessi || 0;
    OF_new3 = schedule[2]?.interessi || 0;
    rcap_new1 = schedule[0]?.capitale || 0;
    rcap_new2 = schedule[1]?.capitale || 0;
    rcap_new3 = schedule[2]?.capitale || 0;
  }
  const OF1 = OF_exist + OF_new1;
  const OF2 = OF_exist + OF_new2;
  const OF3 = OF_exist + OF_new3;

  // Costi fissi con inflazione
  const incrF = (d.incr_fissi || 2) / 100;
  const CF0 = d.costi_fissi || 0;
  const CostFissi1 = CF0 * (1 + incrF);
  const CostFissi2 = CostFissi1 * (1 + incrF);
  const CostFissi3 = CostFissi2 * (1 + incrF);

  // Costi variabili (da % su ricavi se non usiamo EBITDA margin direttamente)
  // Se l'utente ha fornito EBITDA margin, usiamo quello come driver primario
  // I costi variabili sono impliciti in EBITDA

  // ── EBT = EBIT − OF
  const EBT1 = EBIT1 - OF1;
  const EBT2 = EBIT2 - OF2;
  const EBT3 = EBIT3 - OF3;

  // ── Imposte
  const taxR = (d.tax_rate || 27.9) / 100;
  const TAX1 = Math.max(EBT1 * taxR, 0);
  const TAX2 = Math.max(EBT2 * taxR, 0);
  const TAX3 = Math.max(EBT3 * taxR, 0);

  // ── Utile netto
  const UN1 = EBT1 - TAX1;
  const UN2 = EBT2 - TAX2;
  const UN3 = EBT3 - TAX3;

  // ── CONTO ECONOMICO rows
  const CE = buildCERows(R0, R1, R2, R3, EBITDA0, EBITDA1, EBITDA2, EBITDA3,
    CP0, CP1, CP2, CP3, AMM1, AMM2, AMM3, EBIT1, EBIT2, EBIT3,
    OF1, OF2, OF3, EBT1, EBT2, EBT3, TAX1, TAX2, TAX3, UN1, UN2, UN3, d);

  // ── CAPEX totali
  const CAPEX1 = sumCapex(d.capex, 1);
  const CAPEX2 = sumCapex(d.capex, 2);
  const CAPEX3 = sumCapex(d.capex, 3);

  // ── Variazione CCN (Capitale Circolante Netto)
  const pCCN = (d.perc_ccn || 8) / 100;
  const CCN0 = R0 * pCCN;
  const CCN1 = R1 * pCCN;
  const CCN2 = R2 * pCCN;
  const CCN3 = R3 * pCCN;
  const dCCN1 = CCN1 - CCN0;
  const dCCN2 = CCN2 - CCN1;
  const dCCN3 = CCN3 - CCN2;

  // ── Rata capitale finanziamenti esistenti
  const RCAP_exist = d.rata_esistente || 0;
  const RCAP1 = RCAP_exist + rcap_new1;
  const RCAP2 = RCAP_exist + rcap_new2;
  const RCAP3 = RCAP_exist + rcap_new3;

  // ── CASH FLOW
  // FCO = EBITDA − variazione CCN − imposte
  const FCO1 = EBITDA1 - dCCN1 - TAX1;
  const FCO2 = EBITDA2 - dCCN2 - TAX2;
  const FCO3 = EBITDA3 - dCCN3 - TAX3;

  // FCI = −CAPEX
  const FCI1 = -CAPEX1;
  const FCI2 = -CAPEX2;
  const FCI3 = -CAPEX3;

  // FFF = +finanziamenti ricevuti − rimborsi capitale − interessi − dividendi
  const finRicevuto1 = d.nuovo_fin ? d.fin_importo : 0;
  const DIV = d.dividendi || 0;
  const FFF1 = finRicevuto1 - RCAP1 - OF1 - DIV + (d.aum_capitale || 0);
  const FFF2 = -RCAP2 - OF2 - DIV;
  const FFF3 = -RCAP3 - OF3 - DIV;

  // Free Cash Flow to Equity
  const FCFF1 = FCO1 + FCI1;
  const FCFF2 = FCO2 + FCI2;
  const FCFF3 = FCO3 + FCI3;

  const CF_NETTO1 = FCO1 + FCI1 + FFF1;
  const CF_NETTO2 = FCO2 + FCI2 + FFF2;
  const CF_NETTO3 = FCO3 + FCI3 + FFF3;

  // Cassa cumulata
  const CASSA0 = 0; // base (non conosciuta, partiamo da 0)
  const CASSA1 = CASSA0 + CF_NETTO1;
  const CASSA2 = CASSA1 + CF_NETTO2;
  const CASSA3 = CASSA2 + CF_NETTO3;

  const CF = buildCFRows(EBITDA0, EBITDA1, EBITDA2, EBITDA3,
    dCCN1, dCCN2, dCCN3, TAX1, TAX2, TAX3, FCO1, FCO2, FCO3,
    CAPEX1, CAPEX2, CAPEX3, FCI1, FCI2, FCI3,
    finRicevuto1, RCAP1, RCAP2, RCAP3, OF1, OF2, OF3, DIV,
    FFF1, FFF2, FFF3, CF_NETTO1, CF_NETTO2, CF_NETTO3,
    CASSA0, CASSA1, CASSA2, CASSA3);

  // ── STATO PATRIMONIALE
  const PFN0 = d.pfn_storico || 0;
  const PFN1 = PFN0 + CAPEX1 - FCFF1;
  const PFN2 = PFN1 + CAPEX2 - FCFF2;
  const PFN3 = PFN2 + CAPEX3 - FCFF3;

  const PN0 = d.pn_attuale || 0;
  const PN1 = PN0 + UN1 - DIV + (d.aum_capitale || 0);
  const PN2 = PN1 + UN2 - DIV;
  const PN3 = PN2 + UN3 - DIV;

  // Immobilizzazioni nette
  const IMM0 = PFN0 + PN0; // approssimazione
  const IMM1 = IMM0 + CAPEX1 - AMM1;
  const IMM2 = IMM1 + CAPEX2 - AMM2;
  const IMM3 = IMM2 + CAPEX3 - AMM3;

  const SP = buildSPRows(IMM0, IMM1, IMM2, IMM3,
    CCN0, CCN1, CCN2, CCN3, CASSA0, CASSA1, CASSA2, CASSA3,
    PN0, PN1, PN2, PN3, PFN0, PFN1, PFN2, PFN3);

  // ── BREAK-EVEN (Anno 1)
  const costiFissiTotali1 = CostFissi1 + CP1 + AMM1 + OF1;
  const percVar1 = 1 - emPct - (costiFissiTotali1 / R1 || 0);
  const margContrib = 1 - (d.perc_var || 0) / 100;
  const BE_ricavi = margContrib > 0 ? (CostFissi1 + CP1 + AMM1 + OF1) / margContrib : R1;
  const BE_utilizzo = R1 > 0 ? (BE_ricavi / R1) * 100 : 0;
  const BE_margSic = R1 - BE_ricavi;
  const BE_margSicPerc = R1 > 0 ? (BE_margSic / R1) * 100 : 0;

  const be = {
    ricavi_be: BE_ricavi,
    ricavi_a1: R1,
    utilizzo_cap: Math.min(BE_utilizzo, 100),
    margine_sicurezza: BE_margSic,
    margine_perc: BE_margSicPerc,
  };

  // ── KPI / DSCR
  const DSCR1 = (RCAP1 + OF1) > 0 ? EBITDA1 / (RCAP1 + OF1) : null;
  const DSCR2 = (RCAP2 + OF2) > 0 ? EBITDA2 / (RCAP2 + OF2) : null;
  const DSCR3 = (RCAP3 + OF3) > 0 ? EBITDA3 / (RCAP3 + OF3) : null;
  const DSCR0 = d.ebitda_storico && (d.rata_esistente || d.interessi_esistenti)
    ? EBITDA0 / ((d.rata_esistente || 0) + (d.interessi_esistenti || 0)) : null;

  const ICR1 = OF1 > 0 ? EBIT1 / OF1 : null;
  const ICR0 = OF_exist > 0 && d.ebitda_storico ? (EBITDA0 - ammBase) / OF_exist : null;

  const PFNEBITDA0 = EBITDA0 > 0 ? PFN0 / EBITDA0 : null;
  const PFNEBITDA1 = EBITDA1 > 0 ? PFN1 / EBITDA1 : null;
  const PFNEBITDA2 = EBITDA2 > 0 ? PFN2 / EBITDA2 : null;
  const PFNEBITDA3 = EBITDA3 > 0 ? PFN3 / EBITDA3 : null;

  const ROE0 = PN0 > 0 ? (d.ebitda_storico / PN0) * 100 : null;
  const ROE1 = PN1 > 0 ? (UN1 / PN1) * 100 : null;
  const ROE2 = PN2 > 0 ? (UN2 / PN2) * 100 : null;
  const ROE3 = PN3 > 0 ? (UN3 / PN3) * 100 : null;

  const EBITDAM0 = R0 > 0 ? (EBITDA0 / R0) * 100 : null;
  const EBITDAM1 = R1 > 0 ? (EBITDA1 / R1) * 100 : null;
  const EBITDAM2 = R2 > 0 ? (EBITDA2 / R2) * 100 : null;
  const EBITDAM3 = R3 > 0 ? (EBITDA3 / R3) * 100 : null;

  const kpi = [
    { label: 'Ricavi (€)', s: R0, a1: R1, a2: R2, a3: R3, soglia: '' },
    { label: 'EBITDA Margin (%)', s: EBITDAM0, a1: EBITDAM1, a2: EBITDAM2, a3: EBITDAM3, soglia: '> 5%' },
    { label: 'DSCR', s: DSCR0, a1: DSCR1, a2: DSCR2, a3: DSCR3, soglia: '≥ 1,10x', ok: DSCR1 === null || DSCR1 >= 1.1 },
    { label: 'ICR (EBIT/OF)', s: ICR0, a1: ICR1, a2: OF2 > 0 ? EBIT2 / OF2 : null, a3: OF3 > 0 ? EBIT3 / OF3 : null, soglia: '≥ 1,5x' },
    { label: 'PFN/EBITDA', s: PFNEBITDA0, a1: PFNEBITDA1, a2: PFNEBITDA2, a3: PFNEBITDA3, soglia: '< 4x' },
    { label: 'ROE (%)', s: ROE0, a1: ROE1, a2: ROE2, a3: ROE3, soglia: '> 5%' },
    { label: 'Free Cash Flow (€)', s: null, a1: FCFF1, a2: FCFF2, a3: FCFF3, soglia: '> 0' },
  ];

  // ── Alerts
  const alerts = [];
  if (DSCR1 !== null && DSCR1 < 1.1)
    alerts.push({ type: 'danger', icon: '🚨', msg: `DSCR Anno 1 = ${DSCR1.toFixed(2)}x — SOTTO SOGLIA MINIMA 1,10x. Necessario rivedere il piano di rimborso o aumentare l'EBITDA. (EBA/GL/2020/06)` });
  else if (DSCR1 !== null)
    alerts.push({ type: 'success', icon: '✅', msg: `DSCR Anno 1 = ${DSCR1.toFixed(2)}x — Sopra la soglia minima bancaria di 1,10x (EBA/GL/2020/06).` });
  if (PFN1 / (EBITDA1 || 1) > 4)
    alerts.push({ type: 'warning', icon: '⚠️', msg: `PFN/EBITDA Anno 1 = ${(PFN1 / EBITDA1).toFixed(1)}x — Supera la soglia di attenzione di 4x. Le banche potrebbero richiedere garanzie aggiuntive.` });
  if (FCFF1 < 0)
    alerts.push({ type: 'warning', icon: '⚠️', msg: `Free Cash Flow Anno 1 negativo (${fmtN(FCFF1)} €). Verificare il piano di investimenti e la tempistica degli incassi.` });
  if (UN1 < 0)
    alerts.push({ type: 'danger', icon: '🚨', msg: `Utile Netto Anno 1 negativo (${fmtN(UN1)} €). Rivedere margini, costi o struttura finanziaria.` });

  // ── HTML report
  const html = buildHTMLReport(d, { CE, SP, CF, be, kpi, alerts },
    { R0, R1, R2, R3, EBITDA0, EBITDA1, EBITDA2, EBITDA3,
      UN1, UN2, UN3, PFN1, PFN2, PFN3, PN1, PN2, PN3,
      DSCR1, DSCR2, DSCR3, EBITDAM1, EBITDAM2, EBITDAM3, annoBase });

  return { ce: CE, sp: SP, cf: CF, be, kpi, alerts, html };
}

// ─── CE rows ──────────────────────────────────────────────────────────────────
function buildCERows(R0, R1, R2, R3, E0, E1, E2, E3,
  CP0, CP1, CP2, CP3, AMM1, AMM2, AMM3,
  EBIT1, EBIT2, EBIT3, OF1, OF2, OF3,
  EBT1, EBT2, EBT3, TAX1, TAX2, TAX3, UN1, UN2, UN3, d) {

  const ammBase = d.ammortamenti || 0;
  // Costi operativi impliciti = Ricavi − EBITDA (incluso personale)
  const OPEX0 = R0 - E0 - CP0;
  const OPEX1 = R1 - E1 - CP1;
  const OPEX2 = R2 - E2 - CP2;
  const OPEX3 = R3 - E3 - CP3;

  return [
    { label: 'RICAVI DELLE VENDITE', s: R0, a1: R1, a2: R2, a3: R3, total: true },
    { label: 'Variazione ricavi', s: null, a1: pct(R1, R0), a2: pct(R2, R1), a3: pct(R3, R2) },
    { label: '', s: null, a1: null, a2: null, a3: null, section: true },
    { label: 'COSTI OPERATIVI', s: null, a1: null, a2: null, a3: null, section: true },
    { label: 'Costi per materie/merci/servizi', s: -Math.abs(OPEX0), a1: -Math.abs(OPEX1), a2: -Math.abs(OPEX2), a3: -Math.abs(OPEX3), sub: true },
    { label: 'Costo del personale', s: -CP0, a1: -CP1, a2: -CP2, a3: -CP3, sub: true },
    { label: '', s: null, a1: null, a2: null, a3: null, section: true },
    { label: 'EBITDA', s: E0, a1: E1, a2: E2, a3: E3, total: true, positive: true },
    { label: 'EBITDA Margin %', s: R0 > 0 ? pct(E0, R0) : null, a1: pct(E1, R1), a2: pct(E2, R2), a3: pct(E3, R3) },
    { label: 'Ammortamenti e svalutazioni', s: -ammBase, a1: -AMM1, a2: -AMM2, a3: -AMM3, sub: true },
    { label: 'EBIT (Risultato operativo)', s: E0 - ammBase, a1: EBIT1, a2: EBIT2, a3: EBIT3, total: true },
    { label: 'Oneri finanziari netti', s: -(d.interessi_esistenti || 0), a1: -OF1, a2: -OF2, a3: -OF3, sub: true },
    { label: 'EBT (Risultato ante imposte)', s: E0 - ammBase - (d.interessi_esistenti || 0), a1: EBT1, a2: EBT2, a3: EBT3, total: true },
    { label: 'Imposte sul reddito', s: null, a1: -TAX1, a2: -TAX2, a3: -TAX3, sub: true },
    { label: 'UTILE NETTO', s: null, a1: UN1, a2: UN2, a3: UN3, total: true, positive: UN1 > 0, negative: UN1 < 0 },
  ];
}

// ─── CF rows ──────────────────────────────────────────────────────────────────
function buildCFRows(E0, E1, E2, E3,
  dCCN1, dCCN2, dCCN3, T1, T2, T3, FCO1, FCO2, FCO3,
  CAP1, CAP2, CAP3, FCI1, FCI2, FCI3,
  finRic1, RC1, RC2, RC3, OF1, OF2, OF3, DIV,
  FFF1, FFF2, FFF3, NET1, NET2, NET3,
  CASSA0, CASSA1, CASSA2, CASSA3) {
  return [
    { label: 'FLUSSI DA ATTIVITÀ OPERATIVA', s: null, a1: null, a2: null, a3: null, section: true },
    { label: 'EBITDA', s: E0, a1: E1, a2: E2, a3: E3, sub: true },
    { label: 'Variazione Capitale Circolante Netto', s: null, a1: -dCCN1, a2: -dCCN2, a3: -dCCN3, sub: true },
    { label: 'Imposte pagate', s: null, a1: -T1, a2: -T2, a3: -T3, sub: true },
    { label: 'Cash Flow Operativo (FCO)', s: null, a1: FCO1, a2: FCO2, a3: FCO3, total: true, positive: true },
    { label: '', s: null, a1: null, a2: null, a3: null, section: true },
    { label: 'FLUSSI DA ATTIVITÀ DI INVESTIMENTO', s: null, a1: null, a2: null, a3: null, section: true },
    { label: 'Investimenti (CAPEX)', s: null, a1: -CAP1, a2: -CAP2, a3: -CAP3, sub: true },
    { label: 'Cash Flow da Investimento (FCI)', s: null, a1: FCI1, a2: FCI2, a3: FCI3, total: true },
    { label: '', s: null, a1: null, a2: null, a3: null, section: true },
    { label: 'FREE CASH FLOW (FCO + FCI)', s: null, a1: FCO1 + FCI1, a2: FCO2 + FCI2, a3: FCO3 + FCI3, total: true, positive: (FCO1 + FCI1) > 0, negative: (FCO1 + FCI1) < 0 },
    { label: '', s: null, a1: null, a2: null, a3: null, section: true },
    { label: 'FLUSSI DA ATTIVITÀ FINANZIARIA', s: null, a1: null, a2: null, a3: null, section: true },
    { label: 'Nuovi finanziamenti', s: null, a1: finRic1, a2: 0, a3: 0, sub: true },
    { label: 'Rimborso quota capitale', s: null, a1: -RC1, a2: -RC2, a3: -RC3, sub: true },
    { label: 'Oneri finanziari pagati', s: null, a1: -OF1, a2: -OF2, a3: -OF3, sub: true },
    { label: 'Dividendi distribuiti', s: null, a1: -DIV, a2: -DIV, a3: -DIV, sub: true },
    { label: 'Cash Flow Finanziario (FFF)', s: null, a1: FFF1, a2: FFF2, a3: FFF3, total: true },
    { label: '', s: null, a1: null, a2: null, a3: null, section: true },
    { label: 'VARIAZIONE NETTA DI CASSA', s: null, a1: NET1, a2: NET2, a3: NET3, total: true, positive: NET1 > 0, negative: NET1 < 0 },
    { label: 'Cassa inizio periodo', s: 0, a1: CASSA0, a2: CASSA1, a3: CASSA2, sub: true },
    { label: 'Cassa fine periodo', s: null, a1: CASSA1, a2: CASSA2, a3: CASSA3, total: true },
  ];
}

// ─── SP rows ──────────────────────────────────────────────────────────────────
function buildSPRows(IMM0, IMM1, IMM2, IMM3,
  CCN0, CCN1, CCN2, CCN3, CASSA0, CASSA1, CASSA2, CASSA3,
  PN0, PN1, PN2, PN3, PFN0, PFN1, PFN2, PFN3) {

  const TOT_ATT0 = IMM0 + CCN0 + CASSA0;
  const TOT_ATT1 = IMM1 + CCN1 + CASSA1;
  const TOT_ATT2 = IMM2 + CCN2 + CASSA2;
  const TOT_ATT3 = IMM3 + CCN3 + CASSA3;

  return [
    { label: 'ATTIVO', s: null, a1: null, a2: null, a3: null, section: true },
    { label: 'Immobilizzazioni nette', s: IMM0, a1: IMM1, a2: IMM2, a3: IMM3, sub: true },
    { label: 'Capitale Circolante Netto (CCN)', s: CCN0, a1: CCN1, a2: CCN2, a3: CCN3, sub: true },
    { label: 'Cassa e disponibilità', s: CASSA0, a1: CASSA1, a2: CASSA2, a3: CASSA3, sub: true },
    { label: 'TOTALE ATTIVO', s: TOT_ATT0, a1: TOT_ATT1, a2: TOT_ATT2, a3: TOT_ATT3, total: true },
    { label: '', s: null, a1: null, a2: null, a3: null, section: true },
    { label: 'PASSIVO E PATRIMONIO NETTO', s: null, a1: null, a2: null, a3: null, section: true },
    { label: 'Patrimonio Netto', s: PN0, a1: PN1, a2: PN2, a3: PN3, sub: true },
    { label: 'Posizione Finanziaria Netta (PFN)', s: PFN0, a1: PFN1, a2: PFN2, a3: PFN3, sub: true },
    { label: 'TOTALE FONTI', s: PN0 + PFN0, a1: PN1 + PFN1, a2: PN2 + PFN2, a3: PN3 + PFN3, total: true },
  ];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcMutuo(importo, durata, tasso, preAmm) {
  const schedule = [];
  let debRes = importo;
  const rataCapAnn = importo / durata;
  for (let i = 0; i < Math.min(durata, 10); i++) {
    const interessi = debRes * tasso;
    const capitale = i < (preAmm / 12) ? 0 : rataCapAnn;
    debRes -= capitale;
    schedule.push({ anno: i + 1, capitale, interessi, debResiduo: Math.max(debRes, 0) });
  }
  return { schedule };
}

function calcCapexAmm(capexList) {
  // Ammortamenti aggiuntivi su nuovi capex, quota anno
  const amm = [0, 0, 0];
  capexList.forEach(c => {
    const vita = c.vita || 5;
    if (c.a1) { amm[0] += c.a1 / vita; amm[1] += c.a1 / vita; amm[2] += c.a1 / vita; }
    if (c.a2) { amm[1] += c.a2 / vita; amm[2] += c.a2 / vita; }
    if (c.a3) { amm[2] += c.a3 / vita; }
  });
  return amm;
}

function sumCapex(capexList, anno) {
  return (capexList || []).reduce((s, c) => s + (c['a' + anno] || 0), 0);
}

function pct(a, b) { return b !== 0 ? ((a - b) / b * 100).toFixed(1) + '%' : null; }
function fmtN(n) { return n === null || n === undefined ? '—' : Math.round(n).toLocaleString('it-IT'); }
function fmtE(n) { if (n === null || n === undefined) return '—'; return (n < 0 ? '− ' : '') + Math.abs(Math.round(n)).toLocaleString('it-IT') + ' €'; }

// ─── HTML REPORT ──────────────────────────────────────────────────────────────
function buildHTMLReport(d, { CE, SP, CF, be, kpi, alerts }, calc) {
  const {R0,R1,R2,R3,EBITDA1,EBITDA2,EBITDA3,UN1,UN2,UN3,PFN1,DSCR1,DSCR2,DSCR3,EBITDAM1,annoBase} = calc;

  const now = d.data_report || new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  const nome = d.nome || 'Azienda';
  const analista = d.analista || 'Dr. Leonardo Mascia';
  const scenarioLabel = { bassa: 'Crescita Bassa (+2–4%)', moderata: 'Crescita Moderata (+5–8%)', alta: 'Crescita Alta (+9–15%)', custom: 'Crescita Personalizzata' }[d.scenario] || d.scenario;

  const cssReport = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',sans-serif;color:#1e293b;background:#f8fafc;font-size:14px}
    .page{width:210mm;min-height:297mm;background:#fff;margin:0 auto 20px;padding:20mm 18mm;position:relative;box-shadow:0 4px 24px rgba(0,0,0,.1)}
    @media print{body{background:#fff}.page{box-shadow:none;margin:0;page-break-after:always}}
    h1{font-size:2.2rem;font-weight:800;color:#1a3a5c;line-height:1.2}
    h2{font-size:1.1rem;font-weight:700;color:#1a3a5c;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin-bottom:14px}
    h3{font-size:.9rem;font-weight:700;color:#2563eb;margin-bottom:8px}
    .cover{background:linear-gradient(135deg,#1a3a5c 0%,#2563eb 100%);color:#fff;padding:28mm 22mm}
    .cover h1{color:#fff;font-size:2.6rem}
    .cover .sub{font-size:1.1rem;opacity:.85;margin-top:10px}
    .cover .meta{margin-top:40px;font-size:.9rem;opacity:.75;line-height:2}
    .cover .badge-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:30px}
    .cover .badge{background:rgba(255,255,255,.12);border-radius:6px;padding:8px 12px;font-size:.75rem;font-weight:600}
    .kv{display:flex;gap:0;margin-bottom:4px}
    .kv .k{width:200px;color:#64748b;flex-shrink:0}
    .kv .val{font-weight:600}
    table.rep{width:100%;border-collapse:collapse;font-size:.83rem;margin-top:8px}
    table.rep th{background:#1a3a5c;color:#fff;padding:8px 10px;text-align:right;font-size:.75rem}
    table.rep th:first-child{text-align:left}
    table.rep td{padding:7px 10px;border-bottom:1px solid #f1f5f9;text-align:right}
    table.rep td:first-child{text-align:left}
    table.rep tr.sec td{background:#f8fafc;font-weight:700;font-size:.72rem;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;padding:5px 10px}
    table.rep tr.sub td:first-child{padding-left:20px;color:#64748b}
    table.rep tr.tot td{font-weight:700;background:#f0f9ff;border-top:1px solid #bfdbfe}
    table.rep tr.utile-pos td{color:#16a34a}
    table.rep tr.utile-neg td{color:#dc2626}
    .kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:12px 0}
    .kpi-card{border-radius:8px;padding:14px;text-align:center;background:#f8fafc;border:1px solid #e2e8f0}
    .kpi-card .val{font-size:1.5rem;font-weight:800;color:#1a3a5c}
    .kpi-card .label{font-size:.72rem;color:#64748b;margin-top:3px}
    .kpi-card .soglia{font-size:.68rem;color:#94a3b8;margin-top:2px}
    .kpi-card.ok{border-color:#bbf7d0;background:#f0fdf4}.kpi-card.ok .val{color:#16a34a}
    .kpi-card.warn{border-color:#fde68a;background:#fefce8}.kpi-card.warn .val{color:#d97706}
    .kpi-card.bad{border-color:#fecaca;background:#fef2f2}.kpi-card.bad .val{color:#dc2626}
    .be-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:12px 0}
    .be-card{border-radius:8px;padding:14px;text-align:center;background:#eff6ff;border:1px solid #bfdbfe}
    .be-card .val{font-size:1.4rem;font-weight:800;color:#1e40af}
    .be-card .label{font-size:.72rem;color:#64748b;margin-top:3px}
    .scenario-box{background:#eff6ff;border-radius:8px;padding:14px;margin-bottom:16px;border-left:4px solid #2563eb}
    .scenario-box strong{color:#1e40af}
    .alert-print{border-radius:6px;padding:10px 14px;margin-bottom:8px;font-size:.8rem;display:flex;gap:8px}
    .alert-print.ok{background:#dcfce7;border-left:4px solid #16a34a;color:#166534}
    .alert-print.warn{background:#fef3c7;border-left:4px solid #f59e0b;color:#92400e}
    .alert-print.bad{background:#fee2e2;border-left:4px solid #dc2626;color:#991b1b}
    .stress-box{background:#fef3c7;border-radius:8px;padding:14px;margin-top:12px;border-left:4px solid #f59e0b}
    .print-bar{position:fixed;bottom:20px;right:20px;display:flex;gap:8px;z-index:999}
    .print-bar button{padding:10px 18px;border-radius:8px;font-weight:600;cursor:pointer;font-size:.88rem;border:none}
    .print-bar .btn-print{background:#2563eb;color:#fff}
    .print-bar .btn-dl{background:#fff;border:1.5px solid #e2e8f0;color:#1e293b}
    @media print{.print-bar{display:none}}
    .footer-page{position:absolute;bottom:12mm;left:18mm;right:18mm;display:flex;justify-content:space-between;font-size:.7rem;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:6px}
  `;

  const buildTableHTML = (rows, headers) => {
    let h = `<table class="rep"><thead><tr><th>${headers[0]}</th>${headers.slice(1).map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>`;
    rows.forEach(r => {
      let cls = '';
      if (r.section) cls = 'sec';
      else if (r.total) cls = 'tot';
      if (r.sub) cls += ' sub';
      if (r.positive && r.total) cls += ' utile-pos';
      if (r.negative && r.total) cls += ' utile-neg';
      h += `<tr class="${cls.trim()}"><td>${r.label || ''}</td>`;
      ['s', 'a1', 'a2', 'a3'].forEach(k => {
        const val = r[k];
        if (r.section || (!r.section && val === null)) h += '<td></td>';
        else if (typeof val === 'string') h += `<td style="text-align:center">${val}</td>`;
        else h += `<td>${fmtE(val)}</td>`;
      });
      h += '</tr>';
    });
    h += '</tbody></table>';
    return h;
  };

  const years = [`Storico ${annoBase}`, `Anno 1 (${annoBase + 1})`, `Anno 2 (${annoBase + 2})`, `Anno 3 (${annoBase + 3})`];

  const kpiCls = (val, ok, warn) => {
    if (val === null) return '';
    if (ok(val)) return 'ok';
    if (warn && warn(val)) return 'warn';
    return 'bad';
  };

  const kpiHTML = `
    <div class="kpi-grid">
      <div class="kpi-card ${kpiCls(DSCR1, v => v >= 1.1, v => v >= 0.9)}">
        <div class="val">${DSCR1 !== null ? DSCR1.toFixed(2) + 'x' : 'N/D'}</div>
        <div class="label">DSCR Anno 1</div>
        <div class="soglia">Soglia banca: ≥ 1,10x</div>
      </div>
      <div class="kpi-card ${kpiCls(EBITDAM1, v => v >= 8, v => v >= 4)}">
        <div class="val">${EBITDAM1 !== null ? EBITDAM1.toFixed(1) + '%' : 'N/D'}</div>
        <div class="label">EBITDA Margin Anno 1</div>
        <div class="soglia">Target: > 8%</div>
      </div>
      <div class="kpi-card ${kpiCls(PFN1 / (EBITDA1 || 1), v => v <= 3, v => v <= 4)}">
        <div class="val">${EBITDA1 > 0 ? (PFN1 / EBITDA1).toFixed(1) + 'x' : 'N/D'}</div>
        <div class="label">PFN/EBITDA Anno 1</div>
        <div class="soglia">Attenzione: > 4x</div>
      </div>
      <div class="kpi-card ${kpiCls(R1, v => v > R0, null)}">
        <div class="val">${d.g1}%</div>
        <div class="label">Crescita Ricavi Anno 1</div>
        <div class="soglia">Scenario: ${scenarioLabel}</div>
      </div>
      <div class="kpi-card ${kpiCls(UN1, v => v > 0, null)}">
        <div class="val">${fmtE(UN1)}</div>
        <div class="label">Utile Netto Anno 1</div>
        <div class="soglia">Obiettivo: positivo</div>
      </div>
      <div class="kpi-card">
        <div class="val">${be ? fmtE(be.ricavi_be) : 'N/D'}</div>
        <div class="label">Ricavi Break-Even</div>
        <div class="soglia">Sicurezza: ${be ? be.margine_perc.toFixed(1) + '%' : '—'}</div>
      </div>
    </div>`;

  const alertsHTML = alerts.map(a => {
    const t = a.type === 'success' ? 'ok' : a.type === 'warning' ? 'warn' : 'bad';
    return `<div class="alert-print ${t}">${a.icon} ${a.msg}</div>`;
  }).join('');

  const stressR1 = R1 * 0.8;
  const stressEBITDA1 = stressR1 * (EBITDAM1 / 100 - 0.03);
  const stressDSCR1 = DSCR1 !== null && EBITDA1 > 0 ? (stressEBITDA1 / EBITDA1) * DSCR1 : null;

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>Business Plan — ${nome}</title>
<style>${cssReport}</style>
</head>
<body>

<div class="print-bar">
  <button class="btn-print" onclick="window.print()">🖨 Stampa / PDF</button>
  <button class="btn-dl" onclick="downloadHTML()">⬇ Scarica HTML</button>
</div>

<!-- COPERTINA -->
<div class="page cover">
  <div style="font-size:.9rem;opacity:.7;margin-bottom:16px;text-transform:uppercase;letter-spacing:1px">Business Plan Finanziario</div>
  <h1>${nome}</h1>
  <div class="sub">Piano Economico-Finanziario ${annoBase + 1}–${annoBase + 3}</div>
  <div class="meta">
    <div>Data: ${now}</div>
    <div>Analista: ${analista}</div>
    <div>Settore: ${d.settore || '—'}</div>
    <div>Scenario: ${scenarioLabel}</div>
    <div>Anno base: ${annoBase}</div>
  </div>
  <div class="badge-grid">
    <div class="badge">📋 EBA/GL/2020/06 Compliant</div>
    <div class="badge">🏛 D.Lgs. 14/2019 CCII</div>
    <div class="badge">📊 Modello 3-Statement CE+SP+CF</div>
    <div class="badge">🎯 Break-Even &amp; Scenario Analysis</div>
  </div>
  <div class="footer-page"><span>RISERVATO E CONFIDENZIALE</span><span>1</span></div>
</div>

<!-- EXECUTIVE SUMMARY -->
<div class="page">
  <h2>1. Executive Summary</h2>
  <div class="scenario-box">
    <strong>Scenario selezionato: ${scenarioLabel}</strong><br>
    Crescita ricavi: Anno 1 +${d.g1}% · Anno 2 +${d.g2}% · Anno 3 +${d.g3}%
    ${d.nuovo_fin ? ` · Nuovo finanziamento: ${fmtE(d.fin_importo)}` : ''}
  </div>

  <h3>Principali risultati attesi</h3>
  ${kpiHTML}

  <h3 style="margin-top:16px">Alert e raccomandazioni</h3>
  ${alertsHTML || '<div class="alert-print ok">✅ Nessuna criticità rilevata. Il piano è sostenibile nelle ipotesi indicate.</div>'}

  ${d.nota_metodologica ? `<h3 style="margin-top:16px">Nota metodologica</h3><p style="font-size:.82rem;color:#475569;line-height:1.6">${d.nota_metodologica}</p>` : ''}

  <div class="footer-page"><span>${nome} — Business Plan ${annoBase + 1}–${annoBase + 3}</span><span>2</span></div>
</div>

<!-- CONTO ECONOMICO -->
<div class="page">
  <h2>2. Conto Economico Proiettato</h2>
  <p style="font-size:.8rem;color:#64748b;margin-bottom:10px">Valori in €. Crescita ricavi: +${d.g1}% / +${d.g2}% / +${d.g3}%. EBITDA margin target: ${d.ebitda_margin}%.</p>
  ${buildTableHTML(CE, years)}
  <div class="footer-page"><span>${nome} — Business Plan ${annoBase + 1}–${annoBase + 3}</span><span>3</span></div>
</div>

<!-- STATO PATRIMONIALE -->
<div class="page">
  <h2>3. Stato Patrimoniale Proiettato</h2>
  <p style="font-size:.8rem;color:#64748b;margin-bottom:10px">Proiezione semplificata basata sul modello CE+CF integrato.</p>
  ${buildTableHTML(SP, years)}
  <div class="footer-page"><span>${nome} — Business Plan ${annoBase + 1}–${annoBase + 3}</span><span>4</span></div>
</div>

<!-- CASH FLOW -->
<div class="page">
  <h2>4. Cash Flow Statement</h2>
  <p style="font-size:.8rem;color:#64748b;margin-bottom:10px">Metodo indiretto. Il Free Cash Flow è la liquidità disponibile dopo investimenti ma prima del servizio del debito.</p>
  ${buildTableHTML(CF, years)}
  <div class="footer-page"><span>${nome} — Business Plan ${annoBase + 1}–${annoBase + 3}</span><span>5</span></div>
</div>

<!-- BREAK-EVEN + DSCR -->
<div class="page">
  <h2>5. Analisi Break-Even e Sostenibilità Finanziaria</h2>

  <h3>Break-Even Analysis (Anno 1)</h3>
  ${be ? `<div class="be-grid">
    <div class="be-card"><div class="val">${fmtE(be.ricavi_be)}</div><div class="label">Ricavi Break-Even</div></div>
    <div class="be-card"><div class="val">${be.utilizzo_cap.toFixed(1)}%</div><div class="label">% capacità necessaria</div></div>
    <div class="be-card"><div class="val">${fmtE(be.margine_sicurezza)}</div><div class="label">Margine di sicurezza</div></div>
  </div>
  <p style="font-size:.82rem;color:#475569;margin-top:8px">Il break-even viene raggiunto a <strong>${fmtE(be.ricavi_be)}</strong>. Con i ricavi proiettati Anno 1 (${fmtE(be.ricavi_a1)}), il margine di sicurezza è <strong>${be.margine_perc.toFixed(1)}%</strong>.</p>` : ''}

  <h3 style="margin-top:20px">DSCR — Debt Service Coverage Ratio (EBA/GL/2020/06)</h3>
  <table class="rep" style="margin-top:8px">
    <thead><tr><th>Indicatore</th><th>Storico</th><th>Anno 1</th><th>Anno 2</th><th>Anno 3</th><th>Soglia</th></tr></thead>
    <tbody>
      ${kpi.map(k => `<tr><td>${k.label}</td><td>${k.s !== null ? (typeof k.s === 'string' ? k.s : k.s.toFixed(2)) : '—'}</td><td>${k.a1 !== null ? (typeof k.a1 === 'string' ? k.a1 : k.a1.toFixed(2)) : '—'}</td><td>${k.a2 !== null ? (typeof k.a2 === 'string' ? k.a2 : k.a2.toFixed(2)) : '—'}</td><td>${k.a3 !== null ? (typeof k.a3 === 'string' ? k.a3 : k.a3.toFixed(2)) : '—'}</td><td style="color:#94a3b8;font-size:.75rem">${k.soglia || ''}</td></tr>`).join('')}
    </tbody>
  </table>

  <h3 style="margin-top:20px">Scenario Stress (−20% ricavi)</h3>
  <div class="stress-box">
    <p style="font-size:.82rem;color:#92400e"><strong>In scenario prudenziale (ricavi −20%):</strong><br>
    Ricavi Anno 1 stress: ${fmtE(stressR1)} · EBITDA stimato: ${fmtE(stressEBITDA1)} · DSCR stress: ${stressDSCR1 !== null ? stressDSCR1.toFixed(2) + 'x' : 'N/D'}<br>
    ${stressDSCR1 !== null && stressDSCR1 < 1.0 ? '⚠️ In scenario stress il DSCR scende sotto 1x. Raccomandato costituire riserva di liquidità o covenant di sospensione dividendi.' : '✅ Anche in scenario stress il piano rimane gestibile.'}
    </p>
    ${d.ipotesi_stress ? `<p style="font-size:.78rem;color:#78350f;margin-top:8px">${d.ipotesi_stress}</p>` : ''}
  </div>

  <div class="footer-page"><span>${nome} — Business Plan ${annoBase + 1}–${annoBase + 3}</span><span>6</span></div>
</div>

<!-- IPOTESI E PIANO INVESTIMENTI -->
<div class="page">
  <h2>6. Piano degli Investimenti e Ipotesi Chiave</h2>

  <h3>Piano CAPEX</h3>
  <table class="rep">
    <thead><tr><th>Investimento</th><th>Categoria</th><th>Anno 1</th><th>Anno 2</th><th>Anno 3</th><th>Vita utile</th></tr></thead>
    <tbody>
      ${(d.capex || []).map(c => `<tr><td>${c.desc || '—'}</td><td>${c.tipo}</td><td>${fmtE(c.a1)}</td><td>${fmtE(c.a2)}</td><td>${fmtE(c.a3)}</td><td>${c.vita} anni</td></tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#94a3b8">Nessun investimento pianificato</td></tr>'}
      <tr class="tot"><td colspan="2"><strong>TOTALE</strong></td>
        <td>${fmtE(sumCapex(d.capex, 1))}</td>
        <td>${fmtE(sumCapex(d.capex, 2))}</td>
        <td>${fmtE(sumCapex(d.capex, 3))}</td>
        <td></td>
      </tr>
    </tbody>
  </table>

  <h3 style="margin-top:20px">Ipotesi chiave del modello</h3>
  <table class="rep">
    <thead><tr><th>Parametro</th><th>Valore</th><th>Note</th></tr></thead>
    <tbody>
      <tr><td>Scenario crescita</td><td>${scenarioLabel}</td><td>+${d.g1}% / +${d.g2}% / +${d.g3}%</td></tr>
      <tr><td>EBITDA Margin target</td><td>${d.ebitda_margin}%</td><td>Costante nei 3 anni</td></tr>
      <tr><td>Margine Lordo atteso</td><td>${d.margine_lordo || '—'}%</td><td></td></tr>
      <tr><td>Aliquota fiscale effettiva</td><td>${d.tax_rate}%</td><td>IRES 24% + IRAP 3.9%</td></tr>
      <tr><td>Giorni di incasso (DSO)</td><td>${d.dso} gg</td><td>Impatto su CCN e liquidità</td></tr>
      <tr><td>Giorni di pagamento (DPO)</td><td>${d.dpo} gg</td><td>Leva finanziaria sul CCN</td></tr>
      <tr><td>Incremento costo personale</td><td>${d.incr_pers}%/anno</td><td>Adeguamento CCNL + inflazione</td></tr>
      <tr><td>Incremento costi fissi</td><td>${d.incr_fissi}%/anno</td><td>Inflazione strutturale</td></tr>
      ${d.nuovo_fin ? `<tr><td>Finanziamento bancario</td><td>${fmtE(d.fin_importo)}</td><td>${d.fin_tipo} — ${d.fin_durata} anni — ${d.fin_tasso}%</td></tr>` : ''}
    </tbody>
  </table>

  ${d.note_ricavi ? `<h3 style="margin-top:16px">Note sui ricavi</h3><p style="font-size:.82rem;color:#475569;line-height:1.6">${d.note_ricavi}</p>` : ''}

  <div class="footer-page"><span>${nome} — Business Plan ${annoBase + 1}–${annoBase + 3}</span><span>7</span></div>
</div>

<script>
function downloadHTML(){
  const blob=new Blob([document.documentElement.outerHTML],{type:'text/html;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='BusinessPlan_${nome.replace(/\s+/g,'_')}.html';a.click();URL.revokeObjectURL(url);
}
<\/script>
</body>
</html>`;
}

// Helper duplicated for report context
function sumCapex(capexList, anno) {
  return (capexList || []).reduce((s, c) => s + (c['a' + anno] || 0), 0);
}
function fmtE(n) {
  if (n === null || n === undefined || n === 0) return '0 €';
  return (n < 0 ? '− ' : '') + Math.abs(Math.round(n)).toLocaleString('it-IT') + ' €';
}
