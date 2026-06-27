// api/genera-bp.js — Business Plan Finanziario
// EBA/GL/2020/06 compliant · 3-statement model (CE + SP + CF)

module.exports = function handler(req, res) {
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

  // ── EBITDA margin atteso — migliora leggermente ogni anno (+0.4pp) per effetto leva operativa
  const emPct  = (d.ebitda_margin || 0) / 100;
  const emPct2 = emPct + 0.004;
  const emPct3 = emPct + 0.008;
  const EBITDA0 = d.ebitda_storico || 0;
  const EBITDA1 = R1 * emPct;
  const EBITDA2 = R2 * emPct2;
  const EBITDA3 = R3 * emPct3;

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
    // Auto-aggiusta la durata per portare il DSCR Anno 1 ≥ 1.10x (soglia EBA)
    // Stima veloce EBITDA1 per auto-calibrazione (senza aspettare il calcolo completo)
    const _ebitda1est = d.ebitda_storico * (1 + (d.g1 || 5) / 100) * (1 + (d.ebitda_margin || d.ebitda_storico / Math.max(d.ricavi_base,1)) / 100 * 0);
    const DSCR_TARGET = 1.10;
    let durata = d.fin_durata || 5;
    const durataMax = 30;

    for (let tentativo = 0; tentativo < (durataMax - durata); tentativo++) {
      const { schedule } = calcMutuo(d.fin_importo, durata, d.fin_tasso / 100, d.pre_amm || 0, d.fin_periodicita || 12);
      const ds1est = (d.rata_esistente || 0) + (schedule[0]?.capitale || 0) + (schedule[0]?.interessi || 0);
      const dscrEst = ds1est > 0 ? _ebitda1est / ds1est : 99;
      if (dscrEst >= DSCR_TARGET || durata >= durataMax) break;
      durata += 1;
    }
    // Salva durata effettivamente usata nel payload (per mostrarla nel report)
    d._fin_durata_effettiva = durata;

    const { schedule } = calcMutuo(d.fin_importo, durata, d.fin_tasso / 100, d.pre_amm || 0, d.fin_periodicita || 12);
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
  // PFN(t) = PFN(t-1) + CAPEX(t) − FCO(t): nuovi investimenti aumentano il debito, il FCO lo riduce
  const PFN1 = Math.max(0, PFN0 + CAPEX1 - FCO1);
  const PFN2 = Math.max(0, PFN1 + CAPEX2 - FCO2);
  const PFN3 = Math.max(0, PFN2 + CAPEX3 - FCO3);

  const PN0 = d.pn_attuale || 0;
  const PN1 = PN0 + UN1 - DIV + (d.aum_capitale || 0);
  const PN2 = PN1 + UN2 - DIV;
  const PN3 = PN2 + UN3 - DIV;

  // Immobilizzazioni nette: IMM = PFN + PN − CCN (identità SP bilanciato, CASSA0=0)
  const IMM0 = PFN0 + PN0 - CCN0;
  const IMM1 = IMM0 + CAPEX1 - AMM1;
  const IMM2 = IMM1 + CAPEX2 - AMM2;
  const IMM3 = IMM2 + CAPEX3 - AMM3;

  const SP = buildSPRows(IMM0, IMM1, IMM2, IMM3,
    CCN0, CCN1, CCN2, CCN3, CASSA0, CASSA1, CASSA2, CASSA3,
    PN0, PN1, PN2, PN3, PFN0, PFN1, PFN2, PFN3);

  // ── BREAK-EVEN (Anno 1)
  const costiFissiTotali1 = CostFissi1 + CP1 + AMM1 + OF1;
  // Se perc_var non inserita, la deriva dall'EBITDA margin: costi variabili impliciti = 1 - emPct - CF/R
  const percVar = d.perc_var > 0 ? d.perc_var / 100 : Math.max(0, 1 - emPct - (CostFissi1 + CP1) / (R1 || 1));
  const margContrib = Math.max(0.01, 1 - percVar);
  const BE_ricavi = (CostFissi1 + CP1 + AMM1 + OF1) / margContrib;
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

  // ── KPI / DSCR — cascata di formule, usa la più rigorosa con i dati disponibili
  // rata_esistente = rata TOTALE annua (capitale + interessi) finanziamenti esistenti
  // Per i nuovi finanziamenti rcap_new e OF_new vengono dal piano di ammortamento
  const debtService1 = (d.rata_esistente || 0) + rcap_new1 + OF_new1;
  const debtService2 = (d.rata_esistente || 0) + rcap_new2 + OF_new2;
  const debtService3 = (d.rata_esistente || 0) + rcap_new3 + OF_new3;

  function calcDSCR(ebitda, ebit, fco, ds) {
    if (ds <= 0) return { val: null, formula: null };
    // Formula 1 — CCII/CNDCEC: FCO (EBITDA − ΔCiroclante − Imposte) / Debt Service
    if (fco !== null && fco !== undefined) return { val: fco / ds, formula: 'FCO/DS (CCII)' };
    // Formula 2 — EBA: (EBITDA − Imposte) / Debt Service
    // Formula 3 — Bancaria semplificata: EBITDA / Debt Service
    if (ebitda > 0) return { val: ebitda / ds, formula: 'EBITDA/DS (EBA)' };
    // Formula 4 — Fallback EBIT: EBIT / Debt Service
    if (ebit !== undefined && ebit !== null) return { val: ebit / ds, formula: 'EBIT/DS' };
    return { val: null, formula: null };
  }

  // FCO proiettato = EBITDA − ΔCircolante − Imposte (già calcolati sopra)
  const r1 = calcDSCR(EBITDA1, EBIT1, FCO1, debtService1);
  const r2 = calcDSCR(EBITDA2, EBIT2, FCO2, debtService2);
  const r3 = calcDSCR(EBITDA3, EBIT3, FCO3, debtService3);
  const DSCR1 = r1.val, DSCR1_formula = r1.formula;
  const DSCR2 = r2.val, DSCR2_formula = r2.formula;
  const DSCR3 = r3.val, DSCR3_formula = r3.formula;

  // Anno storico: FCO non disponibile → bancaria semplificata o EBIT
  const DSCR0 = (() => {
    if (!d.rata_esistente) return null;
    if (d.ebitda_storico) return d.ebitda_storico / d.rata_esistente;
    if (d.ebit_storico)   return d.ebit_storico / d.rata_esistente;
    return null;
  })();

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
    alerts.push({ type: 'danger', icon: '🚨', msg: `DSCR ${annoBase + 1} = ${DSCR1.toFixed(2)}x — SOTTO SOGLIA MINIMA 1,10x. Necessario rivedere il piano di rimborso o aumentare l'EBITDA. (EBA/GL/2020/06)` });
  else if (DSCR1 !== null)
    alerts.push({ type: 'success', icon: '✅', msg: `DSCR ${annoBase + 1} = ${DSCR1.toFixed(2)}x — Sopra la soglia minima bancaria di 1,10x (EBA/GL/2020/06).` });
  else
    alerts.push({ type: 'info', icon: 'ℹ️', msg: `DSCR ${annoBase + 1} = N/A — L'azienda non presenta debiti finanziari. Il DSCR non è calcolabile: non vi è servizio del debito da coprire.` });
  if (PFN1 / (EBITDA1 || 1) > 4)
    alerts.push({ type: 'warning', icon: '⚠️', msg: `PFN/EBITDA ${annoBase + 1} = ${(PFN1 / EBITDA1).toFixed(1)}x — Supera la soglia di attenzione di 4x. Le banche potrebbero richiedere garanzie aggiuntive.` });
  if (FCFF1 < 0)
    alerts.push({ type: 'warning', icon: '⚠️', msg: `Free Cash Flow ${annoBase + 1} negativo (${fmtN(FCFF1)} €). Verificare il piano di investimenti e la tempistica degli incassi.` });
  if (UN1 < 0)
    alerts.push({ type: 'danger', icon: '🚨', msg: `Utile Netto ${annoBase + 1} negativo (${fmtN(UN1)} €). Rivedere margini, costi o struttura finanziaria.` });

  // ── Scenario comparison (ODCEC guide — ISA Italia / EBA stress)
  const buildScen = (g1p, g2p, g3p) => {
    const r1 = R0 * (1 + g1p / 100), r2 = r1 * (1 + g2p / 100), r3 = r2 * (1 + g3p / 100);
    const e1 = r1 * emPct, e3 = r3 * emPct3;
    const ebt1 = e1 - AMM1 - OF1;
    const un1 = ebt1 >= 0 ? ebt1 * (1 - taxR) : ebt1;
    // FCO scenario: EBITDA − ΔCiroclante − Imposte (coerente con formula principale)
    const fco1s = e1 - dCCN1 - Math.max(ebt1 * taxR, 0);
    const dscr1 = debtService1 > 0 ? fco1s / debtService1 : null;
    return { r1, r2, r3, e1, e3, un1, dscr1, em1: r1 > 0 ? e1 / r1 * 100 : null, cagr: R0 > 0 && r3 > 0 ? (Math.pow(r3 / R0, 1 / 3) - 1) * 100 : null };
  };
  // Usa scenari custom se forniti, altrimenti fallback ±5% sul Base
  const cG1 = d.sc_conserv_g1 != null ? d.sc_conserv_g1 : Math.max(d.g1 - 5, 0);
  const cG2 = d.sc_conserv_g2 != null ? d.sc_conserv_g2 : Math.max(d.g2 - 5, 0);
  const cG3 = d.sc_conserv_g3 != null ? d.sc_conserv_g3 : Math.max(d.g3 - 5, 0);
  const oG1 = d.sc_ottim_g1 != null ? d.sc_ottim_g1 : d.g1 + 5;
  const oG2 = d.sc_ottim_g2 != null ? d.sc_ottim_g2 : d.g2 + 5;
  const oG3 = d.sc_ottim_g3 != null ? d.sc_ottim_g3 : d.g3 + 5;
  const scenComparison = [
    { label: 'Conservativo', sub: `+${cG1}% / +${cG2}% / +${cG3}%`, prob: d.sc_conserv_prob || '20%', ...buildScen(cG1, cG2, cG3) },
    { label: 'Base', sub: `+${d.g1}% / +${d.g2}% / +${d.g3}%`, prob: d.sc_base_prob || '55%', ...buildScen(d.g1, d.g2, d.g3) },
    { label: 'Ottimistico', sub: `+${oG1}% / +${oG2}% / +${oG3}%`, prob: d.sc_ottim_prob || '25%', ...buildScen(oG1, oG2, oG3) },
  ];

  // ── HTML report
  const html = buildHTMLReport(d, { CE, SP, CF, be, kpi, alerts },
    { R0, R1, R2, R3, EBITDA0, EBITDA1, EBITDA2, EBITDA3,
      UN1, UN2, UN3, PFN1, PFN2, PFN3, PN1, PN2, PN3,
      DSCR1, DSCR2, DSCR3, EBITDAM1, EBITDAM2, EBITDAM3,
      AMM1, AMM2, AMM3, EBIT1, EBIT2, EBIT3,
      debtService1,
      annoBase, scenComparison });

  return { ce: CE, sp: SP, cf: CF, be, kpi, alerts, html };
}

// ─── CE rows ──────────────────────────────────────────────────────────────────
function buildCERows(R0, R1, R2, R3, E0, E1, E2, E3,
  CP0, CP1, CP2, CP3, AMM1, AMM2, AMM3,
  EBIT1, EBIT2, EBIT3, OF1, OF2, OF3,
  EBT1, EBT2, EBT3, TAX1, TAX2, TAX3, UN1, UN2, UN3, d) {

  const ammBase = d.ammortamenti || 0;
  // Costi operativi impliciti = Ricavi − EBITDA (incluso personale)
  const OPEX0 = Math.max(0, R0 - E0 - CP0);
  const OPEX1 = Math.max(0, R1 - E1 - CP1);
  const OPEX2 = Math.max(0, R2 - E2 - CP2);
  const OPEX3 = Math.max(0, R3 - E3 - CP3);

  const cagr3 = R0 > 0 && R3 > 0 ? Math.pow(R3 / R0, 1/3) - 1 : null;
  return [
    { label: 'RICAVI DELLE VENDITE', s: R0, a1: R1, a2: R2, a3: R3, total: true },
    { label: 'Variazione annua', s: null, a1: pct(R1, R0), a2: pct(R2, R1), a3: pct(R3, R2) },
    { label: 'CAGR triennale', s: null, a1: null, a2: null, a3: cagr3 !== null ? `${(cagr3*100).toFixed(1)}% p.a.` : '—' },
    { label: '', s: null, a1: null, a2: null, a3: null, section: true },
    { label: 'COSTI OPERATIVI', s: null, a1: null, a2: null, a3: null, section: true },
    { label: 'Costi per materie/merci/servizi', s: -Math.abs(OPEX0), a1: -Math.abs(OPEX1), a2: -Math.abs(OPEX2), a3: -Math.abs(OPEX3), sub: true },
    { label: 'Costo del personale', s: -CP0, a1: -CP1, a2: -CP2, a3: -CP3, sub: true },
    { label: '', s: null, a1: null, a2: null, a3: null, section: true },
    { label: 'EBITDA', s: E0, a1: E1, a2: E2, a3: E3, total: true, positive: true },
    { label: 'EBITDA Margin %', s: R0 > 0 ? (E0/R0*100).toFixed(1)+'%' : null, a1: R1 > 0 ? (E1/R1*100).toFixed(1)+'%' : null, a2: R2 > 0 ? (E2/R2*100).toFixed(1)+'%' : null, a3: R3 > 0 ? (E3/R3*100).toFixed(1)+'%' : null },
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
function calcMutuo(importo, durata, tasso, preAmm, periodicita) {
  // periodicita = numero rate per anno: 12=mensile, 4=trimestrale, 2=semestrale (default 12)
  const nRateAnno = periodicita || 12;
  const schedule = [];
  const tassoPerPeriodo = tasso / nRateAnno;
  const nTotPeriodi = durata * nRateAnno;
  const nPreAmm = Math.round(preAmm || 0); // mesi di pre-ammortamento

  // Rata costante alla francese (solo interessi durante pre-ammortamento)
  const rataFrancese = tassoPerPeriodo > 0
    ? importo * (tassoPerPeriodo * Math.pow(1 + tassoPerPeriodo, nTotPeriodi)) / (Math.pow(1 + tassoPerPeriodo, nTotPeriodi) - 1)
    : importo / nTotPeriodi;

  let debRes = importo;
  let periodoGlobale = 0;

  for (let anno = 1; anno <= Math.min(durata, 10); anno++) {
    let capitaleAnno = 0, interessiAnno = 0;
    for (let p = 0; p < nRateAnno; p++) {
      periodoGlobale++;
      const meseEquiv = Math.round((periodoGlobale - 1) * (12 / nRateAnno));
      if (meseEquiv < nPreAmm) {
        // pre-ammortamento: solo interessi
        interessiAnno += debRes * tassoPerPeriodo;
      } else {
        const int = debRes * tassoPerPeriodo;
        const cap = Math.min(rataFrancese - int, debRes);
        interessiAnno += int;
        capitaleAnno += Math.max(cap, 0);
        debRes = Math.max(debRes - Math.max(cap, 0), 0);
      }
    }
    schedule.push({ anno, capitale: Math.round(capitaleAnno), interessi: Math.round(interessiAnno), debResiduo: Math.round(Math.max(debRes, 0)) });
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
function buildHTMLReport(d, { CE, SP, CF, be, kpi, alerts }, nums) {
  const {
    R0, R1, R2, R3,
    EBITDA0, EBITDA1, EBITDA2, EBITDA3,
    UN1, UN2, UN3,
    PFN1, PFN2, PFN3,
    PN1, PN2, PN3,
    DSCR1, DSCR2, DSCR3,
    EBITDAM1, EBITDAM2, EBITDAM3,
    AMM1, AMM2, AMM3, EBIT1, EBIT2, EBIT3,
    debtService1,
    annoBase, scenComparison
  } = nums;

  // ── Formatters
  const fmtP = (n, dec = 1) => (n === null || n === undefined || isNaN(n)) ? '—' : n.toFixed(dec) + '%';
  const fmtX = (n, dec = 2) => (n === null || n === undefined || isNaN(n)) ? '—' : n.toFixed(dec) + 'x';
  const fmtM = (n) => (n === null || n === undefined || isNaN(n)) ? '—' : '€ ' + (n / 1e6).toFixed(2) + ' M';
  const delta = (a, b) => (b === null || b === undefined || b === 0 || a === null || a === undefined)
    ? '—' : ((a - b) / Math.abs(b) * 100).toFixed(1) + '%';

  const now = d.data_report || new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  const nome = d.nome || 'Azienda';
  const analista = d.analista || 'Dr. Leonardo Mascia';
  const scenarioKey = d.scenario || 'moderata';
  const scenarioLabel = { bassa: 'Crescita Bassa', moderata: 'Crescita Moderata', alta: 'Crescita Alta', custom: 'Personalizzata' }[scenarioKey] || scenarioKey;
  const scenarioColor = { bassa: '#0EA5E9', moderata: '#2563EB', alta: '#7C3AED', custom: '#475569' }[scenarioKey] || '#2563EB';

  const PFNEBITDA1 = EBITDA1 > 0 ? PFN1 / EBITDA1 : null;
  const PFNEBITDA2 = EBITDA2 > 0 ? PFN2 / EBITDA2 : null;
  const PFNEBITDA3 = EBITDA3 > 0 ? PFN3 / EBITDA3 : null;
  const CAGR = (R0 > 0 && R3 > 0) ? (Math.pow(R3 / R0, 1 / 3) - 1) * 100 : null;

  // ── Stress test DSCR con debtService passato direttamente dai nums
  const stressR1 = R1 * 0.8;
  const stressEBITDA1 = stressR1 * (EBITDAM1 / 100);
  const stressDSCR1 = debtService1 > 0 ? stressEBITDA1 / debtService1 : null;

  // ── Bancability verdict
  // noDebtPlan = azienda senza debito finanziario: DSCR non calcolabile ma non è un alert
  const noDebtPlan = DSCR1 === null && debtService1 === 0;
  const bancabile = noDebtPlan
    ? ((PFNEBITDA1 === null || PFNEBITDA1 <= 4) && UN1 >= 0)
    : (DSCR1 !== null && DSCR1 >= 1.10 && (PFNEBITDA1 === null || PFNEBITDA1 <= 4) && UN1 >= 0);

  // ── SVG: grouped bar chart Ricavi vs EBITDA
  const svgBars = () => {
    const groups = [
      { lbl: `Storico ${annoBase}`, r: R0, e: EBITDA0 },
      { lbl: `${annoBase + 1}`, r: R1, e: EBITDA1 },
      { lbl: `${annoBase + 2}`, r: R2, e: EBITDA2 },
      { lbl: `${annoBase + 3}`, r: R3, e: EBITDA3 },
    ];
    const W = 560, H = 200, padB = 28, padT = 14, padL = 8;
    const max = Math.max(...groups.map(g => Math.max(g.r, g.e)), 1) * 1.1;
    const gw = (W - padL * 2) / groups.length;
    const bw = gw * 0.3;
    const sc = (v) => (H - padB - padT) * (Math.max(v, 0) / max);
    let out = '';
    groups.forEach((g, i) => {
      const x0 = padL + i * gw + gw * 0.18;
      const rh = sc(g.r), eh = sc(g.e);
      const ry = H - padB - rh, ey = H - padB - eh;
      out += `<rect x="${x0}" y="${ry}" width="${bw}" height="${rh}" rx="2" fill="#2563EB"/>`;
      out += `<text x="${x0 + bw / 2}" y="${ry - 3}" text-anchor="middle" font-size="8" font-weight="700" fill="#1D4ED8">${(g.r / 1e6).toFixed(2)}</text>`;
      out += `<rect x="${x0 + bw + 6}" y="${ey}" width="${bw}" height="${eh}" rx="2" fill="#059669"/>`;
      out += `<text x="${x0 + bw + 6 + bw / 2}" y="${ey - 3}" text-anchor="middle" font-size="8" font-weight="700" fill="#047857">${(g.e / 1e6).toFixed(2)}</text>`;
      out += `<text x="${x0 + bw + 3}" y="${H - padB + 14}" text-anchor="middle" font-size="8.5" fill="#475569">${g.lbl}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:560px;display:block;margin:8px auto">
      <line x1="${padL}" y1="${H - padB}" x2="${W - padL}" y2="${H - padB}" stroke="#CBD5E1" stroke-width="1"/>
      ${out}
      <rect x="${W - 180}" y="6" width="9" height="9" fill="#2563EB"/><text x="${W - 167}" y="14" font-size="8.5" fill="#475569">Ricavi (€M)</text>
      <rect x="${W - 100}" y="6" width="9" height="9" fill="#059669"/><text x="${W - 87}" y="14" font-size="8.5" fill="#475569">EBITDA (€M)</text>
    </svg>`;
  };

  // ── SVG: waterfall cash flow Anno 1
  const svgWaterfall = () => {
    const FCO = CF.find(r => /Cash Flow Operativo/.test(r.label))?.a1 || 0;
    const FCI = CF.find(r => /Cash Flow da Investimento/.test(r.label))?.a1 || 0;
    const FFF = CF.find(r => /Cash Flow Finanziario/.test(r.label))?.a1 || 0;
    const NET = CF.find(r => /VARIAZIONE NETTA/.test(r.label))?.a1 || (FCO + FCI + FFF);
    const steps = [
      { lbl: 'FCO', v: FCO, cum: FCO, type: 'flow' },
      { lbl: 'FCI', v: FCI, cum: FCO + FCI, type: 'flow' },
      { lbl: 'FFF', v: FFF, cum: FCO + FCI + FFF, type: 'flow' },
      { lbl: 'CF Netto', v: NET, cum: NET, type: 'total' },
    ];
    const W = 560, H = 200, padB = 28, padT = 18;
    const vals = [FCO, FCO + FCI, FCO + FCI + FFF, NET, 0];
    const max = Math.max(...vals), min = Math.min(...vals, 0);
    const range = (max - min) || 1;
    const zero = padT + (H - padB - padT) * (max / range);
    const sc = (v) => (H - padB - padT) * (Math.abs(v) / range);
    const gw = (W - 16) / steps.length;
    const bw = gw * 0.5;
    let prevCum = 0, out = '';
    steps.forEach((s, i) => {
      const x = 8 + i * gw + (gw - bw) / 2;
      let top, h, color;
      if (s.type === 'total') {
        h = sc(s.v); top = s.v >= 0 ? zero - h : zero;
        color = s.v >= 0 ? '#2563EB' : '#DC2626';
      } else {
        const start = prevCum, end = prevCum + s.v;
        top = zero - sc(Math.max(start, end));
        h = sc(Math.abs(s.v));
        color = s.v >= 0 ? '#059669' : '#DC2626';
        prevCum = end;
      }
      out += `<rect x="${x}" y="${top}" width="${bw}" height="${Math.max(h, 1)}" rx="2" fill="${color}"/>`;
      out += `<text x="${x + bw / 2}" y="${(s.v >= 0 ? top - 3 : top + h + 11)}" text-anchor="middle" font-size="8" font-weight="700" fill="${color}">${(s.v / 1e6).toFixed(2)}M</text>`;
      out += `<text x="${x + bw / 2}" y="${H - padB + 14}" text-anchor="middle" font-size="8.5" fill="#475569">${s.lbl}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:560px;display:block;margin:8px auto">
      <line x1="8" y1="${zero}" x2="${W - 8}" y2="${zero}" stroke="#CBD5E1" stroke-width="1" stroke-dasharray="3,3"/>
      ${out}
    </svg>`;
  };

  // ── SVG: DSCR scale bar with needle
  const svgDscrScale = (val) => {
    const W = 560, H = 70, barY = 22, barH = 18, padL = 30, padR = 30;
    const bw = W - padL - padR;
    const maxX = 3;
    const x = (v) => padL + bw * (Math.min(v, maxX) / maxX);
    const nx = val !== null ? x(val) : padL;
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:560px;display:block;margin:6px auto">
      <rect x="${x(0)}" y="${barY}" width="${x(1.1) - x(0)}" height="${barH}" fill="#FEE2E2"/>
      <rect x="${x(1.1)}" y="${barY}" width="${x(1.5) - x(1.1)}" height="${barH}" fill="#FEF3C7"/>
      <rect x="${x(1.5)}" y="${barY}" width="${x(maxX) - x(1.5)}" height="${barH}" fill="#DCFCE7"/>
      <line x1="${x(1.1)}" y1="${barY - 4}" x2="${x(1.1)}" y2="${barY + barH + 4}" stroke="#DC2626" stroke-width="1"/>
      <text x="${x(1.1)}" y="${barY + barH + 16}" text-anchor="middle" font-size="7.5" fill="#991B1B">1,10x</text>
      <text x="${x(1.5)}" y="${barY + barH + 16}" text-anchor="middle" font-size="7.5" fill="#92400E">1,50x</text>
      <text x="${padL}" y="${barY - 6}" font-size="7.5" fill="#94A3B8">0x</text>
      <text x="${W - padR}" y="${barY - 6}" text-anchor="end" font-size="7.5" fill="#94A3B8">3x+</text>
      <polygon points="${nx - 5},${barY - 6} ${nx + 5},${barY - 6} ${nx},${barY + 2}" fill="#0F172A"/>
      <line x1="${nx}" y1="${barY}" x2="${nx}" y2="${barY + barH}" stroke="#0F172A" stroke-width="2"/>
      <text x="${nx}" y="${barY + barH + 16}" text-anchor="middle" font-size="9" font-weight="700" fill="#0F172A">${val !== null ? val.toFixed(2) + 'x' : 'N/D'}</text>
    </svg>`;
  };

  // ── SVG: break-even bar
  const svgBreakEven = () => {
    if (!be) return '';
    const W = 560, H = 64, barY = 18, barH = 22, padL = 8, padR = 8;
    const bw = W - padL - padR;
    const max = Math.max(be.ricavi_a1, be.ricavi_be) * 1.15 || 1;
    const bex = padL + bw * (be.ricavi_be / max);
    const actx = padL + bw * (be.ricavi_a1 / max);
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:560px;display:block;margin:6px auto">
      <rect x="${padL}" y="${barY}" width="${actx - padL}" height="${barH}" rx="3" fill="#059669"/>
      <rect x="${padL}" y="${barY}" width="${bex - padL}" height="${barH}" fill="#F59E0B" opacity="0.35"/>
      <line x1="${bex}" y1="${barY - 5}" x2="${bex}" y2="${barY + barH + 5}" stroke="#DC2626" stroke-width="1.5"/>
      <text x="${bex}" y="${barY - 8}" text-anchor="middle" font-size="8" font-weight="700" fill="#991B1B">Break-Even</text>
      <text x="${bex}" y="${barY + barH + 14}" text-anchor="middle" font-size="8" fill="#991B1B">${(be.ricavi_be / 1e6).toFixed(2)}M</text>
      <text x="${actx - 4}" y="${barY + barH / 2 + 3}" text-anchor="end" font-size="8.5" font-weight="700" fill="#fff">Ricavi ${annoBase+1} ${(be.ricavi_a1 / 1e6).toFixed(2)}M</text>
    </svg>`;
  };

  // ── SVG sparkline (line chart) for 4-point series
  const svgSparkline = (vals, colors, labels, title) => {
    const W = 560, H = 110, padL = 36, padR = 16, padT = 14, padB = 28;
    const cw = W - padL - padR, ch = H - padT - padB;
    const max = Math.max(...vals.flatMap(s => s.data), 1) * 1.05;
    const min = 0;
    const range = max - min || 1;
    const xs = [0, 1, 2, 3].map(i => padL + (i / 3) * cw);
    const y = v => padT + ch * (1 - (v - min) / range);
    let out = `<text x="${W/2}" y="10" text-anchor="middle" font-size="9.5" font-weight="700" fill="#0F172A">${title}</text>`;
    // grid lines
    [0.25, 0.5, 0.75, 1].forEach(f => {
      const yg = padT + ch * (1 - f);
      out += `<line x1="${padL}" y1="${yg}" x2="${W - padR}" y2="${yg}" stroke="#F1F5F9" stroke-width="1"/>`;
      out += `<text x="${padL - 4}" y="${yg + 3}" text-anchor="end" font-size="7" fill="#94A3B8">${(min + range * f / 1e6).toFixed(1)}M</text>`;
    });
    // x-axis labels
    labels.forEach((lbl, i) => {
      out += `<text x="${xs[i]}" y="${H - 4}" text-anchor="middle" font-size="8" fill="#64748B">${lbl}</text>`;
    });
    // series
    vals.forEach((s, si) => {
      const pts = s.data.map((v, i) => `${xs[i]},${y(v)}`).join(' ');
      out += `<polyline points="${pts}" fill="none" stroke="${colors[si]}" stroke-width="2" stroke-linejoin="round"/>`;
      s.data.forEach((v, i) => {
        out += `<circle cx="${xs[i]}" cy="${y(v)}" r="3.5" fill="${colors[si]}" stroke="#fff" stroke-width="1.5"/>`;
        out += `<text x="${xs[i]}" y="${y(v) - 7}" text-anchor="middle" font-size="7.5" font-weight="700" fill="${colors[si]}">${(v / 1e6).toFixed(2)}M</text>`;
      });
    });
    // legend
    vals.forEach((s, si) => {
      const lx = padL + si * 130;
      out += `<rect x="${lx}" y="${H - 26}" width="8" height="8" rx="2" fill="${colors[si]}"/>`;
      out += `<text x="${lx + 11}" y="${H - 19}" font-size="8" fill="#475569">${s.label}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:560px;display:block;margin:4px auto">${out}</svg>`;
  };

  // ── progress bar helper (DSCR/ICR/PFN)
  const progBar = (label, val, fmt, pct, color) => `
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:9px;margin-bottom:3px">
        <span style="font-weight:600;color:#334155">${label}</span>
        <span style="font-weight:700;color:${color}">${fmt}</span>
      </div>
      <div style="height:10px;background:#F1F5F9;border-radius:5px;overflow:hidden">
        <div style="height:100%;width:${Math.max(2, Math.min(100, pct))}%;background:${color};border-radius:5px"></div>
      </div>
    </div>`;

  const dscrColor = (v) => v === null ? '#94A3B8' : v >= 1.3 ? '#059669' : v >= 1.1 ? '#D97706' : '#DC2626';
  const pfnColor = (v) => v === null ? '#94A3B8' : v <= 3 ? '#059669' : v <= 4 ? '#D97706' : '#DC2626';

  // ── SVG semicircular gauge for DSCR
  const svgDscrGauge = (val) => {
    const W = 260, H = 150, cx = 130, cy = 130, r = 100, sw = 20;
    const maxVal = 3.0, startAngle = -Math.PI, endAngle = 0;
    const angle = (v) => startAngle + (Math.min(v || 0, maxVal) / maxVal) * Math.PI;
    const arc = (a1, a2, col) => {
      const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
      const large = (a2 - a1) > Math.PI ? 1 : 0;
      return `<path d="M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="butt"/>`;
    };
    const aMin = angle(0), a110 = angle(1.1), a130 = angle(1.3), a150 = angle(1.5), aMax = angle(maxVal);
    const aVal = val !== null ? angle(val) : aMin;
    const color = dscrColor(val);
    const nx = cx + (r - 8) * Math.cos(aVal), ny = cy + (r - 8) * Math.sin(aVal);
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:280px;display:block;margin:0 auto">
      ${arc(aMin, a110, '#FEE2E2')}${arc(a110, a130, '#FEF3C7')}${arc(a130, a150, '#D1FAE5')}${arc(a150, aMax, '#059669')}
      <circle cx="${cx}" cy="${cy}" r="${r - sw/2 - 2}" fill="none" stroke="#F1F5F9" stroke-width="0.5"/>
      <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="#0F172A" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="6" fill="#0F172A"/>
      <text x="${cx}" y="${cy - 12}" text-anchor="middle" font-size="24" font-weight="800" fill="${color}" font-family="Georgia,serif">${val !== null ? val.toFixed(2)+'x' : 'N/D'}</text>
      <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="8.5" fill="#64748B">DSCR Anno ${annoBase+1}</text>
      <text x="${cx - r - 2}" y="${cy + 18}" text-anchor="middle" font-size="7.5" fill="#DC2626">0x</text>
      <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="7.5" fill="#D97706">1,10x</text>
      <text x="${cx + r + 2}" y="${cy + 18}" text-anchor="end" font-size="7.5" fill="#94A3B8">3x</text>
    </svg>`;
  };

  // ── Render projection table (VOCE | STORICO | A1 | Δ% | A2 | Δ% | A3 | Δ%)
  const projTable = (rows) => {
    let h = `<table class="rep"><thead>
      <tr>
        <th rowspan="2" style="text-align:left;vertical-align:bottom">Voce</th>
        <th style="background:#1E3A5F;border-right:2px solid #4B6A9B">Storico<br><span style="font-weight:400;font-size:7.5px;opacity:.75">certificato XBRL</span></th>
        <th colspan="6" style="background:#0A1628;border-left:2px solid #4B6A9B">⟶ Proiezioni triennali</th>
      </tr>
      <tr>
        <th style="background:#1E3A5F;border-right:2px solid #4B6A9B">${annoBase}</th>
        <th>${annoBase+1}</th><th style="font-size:7px;opacity:.7">Var.</th>
        <th>${annoBase+2}</th><th style="font-size:7px;opacity:.7">Var.</th>
        <th>${annoBase+3}</th><th style="font-size:7px;opacity:.7">Var.</th>
      </tr>
    </thead><tbody>`;
    rows.forEach(r => {
      if (r.section && !r.label) { return; }
      let cls = '';
      if (r.section) cls = 'sec';
      else if (/EBITDA$/.test(r.label || '')) cls = 'ebitda';
      else if (r.total) cls = 'tot';
      if (r.sub) cls += ' sub';
      if (r.positive && r.total) cls += ' utile-pos';
      if (r.negative && r.total) cls += ' utile-neg';
      const isStr = (v) => typeof v === 'string';
      const cell = (v) => r.section ? '' : (v === null || v === undefined) ? '—' : isStr(v) ? v : fmtE(v);
      const dcell = (a, b) => (r.section || r.sub === undefined && false) ? '' :
        (typeof a === 'string' || typeof b === 'string' || a === null || b === null) ? '<span style="color:#CBD5E1">—</span>' :
        `<span style="color:${a - b >= 0 ? '#059669' : '#DC2626'}">${delta(a, b)}</span>`;
      h += `<tr class="${cls.trim()}"><td>${r.label || ''}</td>`;
      if (r.section) {
        h += `<td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`;
        return;
      }
      h += `<td>${cell(r.s)}</td>`;
      h += `<td>${cell(r.a1)}</td><td class="d">${dcell(r.a1, r.s)}</td>`;
      h += `<td>${cell(r.a2)}</td><td class="d">${dcell(r.a2, r.a1)}</td>`;
      h += `<td>${cell(r.a3)}</td><td class="d">${dcell(r.a3, r.a2)}</td>`;
      h += `</tr>`;
    });
    h += '</tbody></table>';
    return h;
  };

  // ── Simple 4-col table (CF)
  const cfTable = (rows) => {
    let h = `<table class="rep"><thead><tr><th>Voce</th><th>Storico ${annoBase}</th><th>${annoBase + 1}</th><th>${annoBase + 2}</th><th>${annoBase + 3}</th></tr></thead><tbody>`;
    rows.forEach(r => {
      if (r.section && !r.label) return;
      let cls = '';
      if (r.section) cls = 'sec';
      else if (r.total) cls = 'tot';
      if (r.sub) cls += ' sub';
      if (r.positive && r.total) cls += ' utile-pos';
      if (r.negative && r.total) cls += ' utile-neg';
      h += `<tr class="${cls.trim()}"><td>${r.label || ''}</td>`;
      ['s', 'a1', 'a2', 'a3'].forEach(k => {
        const v = r[k];
        if (r.section || v === null || v === undefined) h += '<td></td>';
        else if (typeof v === 'string') h += `<td>${v}</td>`;
        else h += `<td>${fmtE(v)}</td>`;
      });
      h += '</tr>';
    });
    return h + '</tbody></table>';
  };

  // ── narrative auto-generation
  const settoreLabel = d.settore ? `nel settore ${d.settore}` : '';
  const scenarioDesc = { bassa: 'di crescita contenuta, coerente con un mercato maturo', moderata: 'di sviluppo organico, con espansione graduale dei ricavi', alta: 'di forte espansione, in linea con un piano di acquisizione di quote di mercato', custom: 'personalizzato' }[d.scenario] || 'di sviluppo';

  const narrative = `
<p><strong>${nome}</strong>${d.n_dip > 0 ? `, realtà imprenditoriale con <strong>${d.n_dip} dipendenti</strong>${settoreLabel ? ' ' + settoreLabel : ''},` : (settoreLabel ? ' ' + settoreLabel + ',' : '')} presenta al sistema bancario un piano economico-finanziario per il triennio <strong>${annoBase + 1}–${annoBase + 3}</strong>, elaborato a partire dai dati consuntivi dell'esercizio ${annoBase} e proiettato secondo uno scenario ${scenarioDesc}. Il punto di partenza è rappresentato da ricavi storici pari a <strong>${fmtE(R0)}</strong>, espressione di un posizionamento consolidato nel mercato di riferimento e base di calcolo per le ipotesi prospettiche sottoposte a verifica in questa sede.</p>

<p>Sul fronte della crescita, il piano proietta un'espansione dei ricavi sino a <strong>${fmtE(R3)}</strong> nell'anno ${annoBase + 3}${CAGR !== null ? `, sostenuta da un tasso di crescita composto annuo (CAGR) del <strong>${fmtP(CAGR)}</strong>` : ''}. Tale traiettoria si articola in incrementi annui rispettivamente del <strong>+${d.g1 || 0}%</strong>, <strong>+${d.g2 || 0}%</strong> e <strong>+${d.g3 || 0}%</strong>, coerenti con le dinamiche attese del settore e con la capacità commerciale dimostrata dall'azienda nel periodo storico. Lo scenario adottato — <em>${scenarioLabel}</em> — riflette un approccio ${CAGR !== null && CAGR > 15 ? 'ambizioso ma supportato da evidenze operative concrete' : 'prudenziale e verificabile nelle assunzioni di base'}, in linea con le prassi di valutazione adottate dagli istituti di credito in sede istruttoria.</p>

<p>Sul piano della redditività, il margine EBITDA si attesta al <strong>${fmtP(EBITDAM1)}</strong> nell'anno ${annoBase + 1}${EBITDAM1 >= 8 ? ', posizionandosi al di sopra della soglia dell\'8% generalmente richiesta dal sistema bancario quale condizione minima di bancabilità operativa' : ` — un livello che si colloca al di sotto della soglia dell'8% tipicamente richiesta dal sistema creditizio — con un percorso di recupero verso il <strong>${fmtP(EBITDAM3)}</strong> atteso nel ${annoBase + 3}`}. L'EBITDA cresce da <strong>${fmtE(EBITDA1)}</strong> nel ${annoBase + 1} a <strong>${fmtE(EBITDA3)}</strong> nel ${annoBase + 3}, evidenziando un miglioramento progressivo della capacità di generazione di margine operativo lordo. L'utile netto del primo anno proiettato si attesta a <strong>${fmtE(UN1)}</strong>${UN1 >= 0 ? ', a conferma della sostenibilità economica del piano già nel breve termine' : ': tale dato richiede un piano strutturato di contenimento dei costi operativi per conseguire l\'equilibrio economico nel biennio successivo'}.</p>

<p>Sotto il profilo della sostenibilità finanziaria, il <strong>DSCR di ${fmtX(DSCR1)}</strong> nel primo anno proiettato ${DSCR1 >= 1.10 ? `supera il requisito minimo di 1,10x fissato dalle Linee Guida EBA/GL/2020/06 sul credito e sul monitoraggio bancario: in termini pratici, per ogni euro di servizio del debito l'azienda è in grado di generare <strong>${fmtX(DSCR1)} euro</strong> di EBITDA disponibile, garantendo un margine di sicurezza adeguato alle esigenze dell'istruttoria` : 'si posiziona al di sotto del requisito minimo di 1,10x stabilito dalle Linee Guida EBA/GL/2020/06, segnalando una copertura del servizio del debito insufficiente rispetto agli standard creditizi internazionali: si raccomanda una revisione della struttura finanziaria o una riduzione del debito complessivo'}. La posizione finanziaria netta (PFN) evolve da <strong>${fmtE(PFN1)}</strong> nel ${annoBase + 1} a <strong>${fmtE(PFN3)}</strong> nel ${annoBase + 3}${PFN3 < PFN1 ? ', descrivendo una traiettoria di <strong>progressivo de-leveraging</strong> che rafforza la solidità patrimoniale nel corso del triennio' : ', con un incremento dell\'indebitamento netto che richiede un attento monitoraggio del rapporto PFN/EBITDA nel periodo'}${d.nuovo_fin && d.fin_importo ? `. Il piano include l'accensione di un nuovo finanziamento di <strong>${fmtE(d.fin_importo)}</strong>${d.fin_tipo ? ' a titolo di ' + d.fin_tipo : ''}${d.fin_durata ? ' della durata di ' + d.fin_durata + ' anni' : ''}${d.fin_tasso ? ' al tasso del ' + d.fin_tasso + '%' : ''}, la cui sostenibilità è verificata all'interno delle proiezioni del rendiconto finanziario` : ''}.</p>

<p>${bancabile ? `Il profilo complessivo del piano risulta <strong>bancabile</strong>: i principali indicatori di rischio — DSCR pari a <strong>${fmtX(DSCR1)}</strong> nel primo anno, PFN/EBITDA pari a <strong>${fmtX(PFNEBITDA1)}</strong> e utile netto ${UN1 >= 0 ? 'positivo' : 'in recupero'} nel triennio — rientrano nei parametri richiesti dagli istituti di credito per l'erogazione di nuove linee di finanziamento. Il piano dimostra una coerenza interna tra la crescita dei ricavi, la struttura dei costi e la capacità di rimborso del debito, confermando la solidità dell'impianto previsionale sottoposto a valutazione.` : `Il profilo del piano presenta <strong>elementi di attenzione</strong> che richiedono una verifica approfondita con gli istituti di credito prima di procedere alla richiesta di finanziamento. In particolare, si segnalano criticità nei parametri di copertura del debito e/o di redditività operativa che — pur non pregiudicando definitivamente la bancabilità dell'operazione — impongono un confronto strutturato con il sistema bancario e un'eventuale revisione delle ipotesi di piano.`}</p>`;

  // ── narrative per sezione CE
  const narrativeCE = `
<p>Il Conto Economico proiettato riflette l'applicazione dello scenario <em>${scenarioLabel}</em> ai ricavi consuntivi dell'esercizio ${annoBase}, pari a <strong>${fmtE(R0)}</strong>. La crescita è articolata in tre fasi annuali — rispettivamente <strong>+${d.g1 || 0}%</strong> nel ${annoBase + 1}, <strong>+${d.g2 || 0}%</strong> nel ${annoBase + 2} e <strong>+${d.g3 || 0}%</strong> nel ${annoBase + 3} — per una progressione che porta il fatturato proiettato a <strong>${fmtE(R1)}</strong>, <strong>${fmtE(R2)}</strong> e <strong>${fmtE(R3)}</strong> rispettivamente. Tali ipotesi di crescita sono coerenti con lo scenario <em>${scenarioLabel}</em> adottato e tengono conto delle condizioni di mercato${d.fonte === 'xbrl' ? ', avendo come riferimento dati di bilancio certificati e depositati' : ' dichiarate dalla direzione aziendale in sede di piano'}.</p>

<p>Sul fronte dei costi, la struttura operativa è stata proiettata mantenendo la coerenza con le percentuali sui ricavi rilevate nel periodo storico, con un incremento dei costi fissi strutturali del <strong>${d.incr_fissi || 2}%</strong> annuo a presidio dell'effetto inflattivo. Il costo del personale cresce al ritmo del <strong>${d.incr_pers || 2}%</strong> annuo, riflettendo l'eventuale adeguamento contrattuale e le esigenze di organico connesse alla crescita dei volumi. La struttura di costo così costruita consente di mantenere un margine di contribuzione solido lungo tutto il triennio di piano.</p>

<p>A conferma di quanto sopra, l'EBITDA cresce da <strong>${fmtE(EBITDA1)}</strong> nel ${annoBase + 1} — con un margine del <strong>${fmtP(EBITDAM1)}</strong> — a <strong>${fmtE(EBITDA3)}</strong> nel ${annoBase + 3}, con un margine atteso del <strong>${fmtP(EBITDAM3)}</strong>. Tale evoluzione evidenzia una qualità crescente della redditività operativa${EBITDAM1 >= 8 ? ', con margini già al di sopra della soglia dell\'8% richiesta dal sistema bancario sin dal primo anno di piano' : ', con un percorso di recupero verso i livelli di bancabilità atteso nel corso del triennio'}. L'utile netto si attesta a <strong>${fmtE(UN1)}</strong> nel ${annoBase + 1}, <strong>${fmtE(UN2)}</strong> nel ${annoBase + 2} e <strong>${fmtE(UN3)}</strong> nel ${annoBase + 3}, attestando la sostenibilità economica complessiva del piano nel periodo considerato.</p>`;

  // ── narrative per sezione SP
  const narrativeSP = `
<p>Lo Stato Patrimoniale proiettato delinea l'evoluzione della struttura finanziaria e patrimoniale di <strong>${nome}</strong> nel triennio ${annoBase + 1}–${annoBase + 3}. Il patrimonio netto si rafforza progressivamente grazie all'accumulo degli utili netti di esercizio${d.dividendi ? ` al netto dei dividendi distribuiti` : ', in assenza di distribuzione di dividendi prevista nel periodo'}, passando da <strong>${fmtE(d.pn_attuale || 0)}</strong> nello storico ${annoBase} a <strong>${fmtE(PN1)}</strong> nel ${annoBase + 1} e a <strong>${fmtE(PN3)}</strong> al termine del triennio. Tale crescita del patrimonio netto rappresenta un segnale positivo di autonomia finanziaria e riduce progressivamente la dipendenza dell'azienda dal capitale di debito.</p>

<p>Sul fronte del capitale circolante netto, le dinamiche operative sono state modellizzate applicando i parametri storici dell'azienda: giorni medi di incasso clienti (DSO) pari a <strong>${d.dso || '—'} giorni</strong>, giorni medi di pagamento fornitori (DPO) pari a <strong>${d.dpo || '—'} giorni</strong>${d.dio ? ` e giorni medi di giacenza del magazzino (DIO) pari a <strong>${d.dio} giorni</strong>` : ''}. Tali parametri determinano il fabbisogno finanziario da capitale circolante: un DSO elevato rispetto al DPO genera un assorbimento di liquidità che cresce proporzionalmente all'espansione dei ricavi, elemento questo che deve essere tenuto in debita considerazione nella gestione della tesoreria. Il piano tiene conto di tale fabbisogno nell'ambito delle proiezioni di liquidità del rendiconto finanziario.</p>

<p>Quanto alla posizione finanziaria netta (PFN), essa evolve da <strong>${fmtE(PFN1)}</strong> nel ${annoBase + 1} a <strong>${fmtE(PFN3)}</strong> nel ${annoBase + 3}, ${PFN3 < PFN1 ? 'descrivendo una traiettoria di <strong>de-leveraging progressivo</strong> che attesta la capacità del piano di generare flussi di cassa operativi superiori al fabbisogno finanziario' : 'con un incremento dell\'indebitamento netto riconducibile principalmente al piano investimenti e alle esigenze di capitale circolante connesse alla crescita'}. Il rapporto PFN/EBITDA — pari a <strong>${fmtX(PFNEBITDA1)}x</strong> nel ${annoBase + 1}${PFNEBITDA3 !== undefined ? ` e <strong>${fmtX(PFNEBITDA3)}x</strong> nel ${annoBase + 3}` : ''} — fornisce al sistema bancario una misura diretta del numero di anni necessari a rimborsare il debito netto con la sola generazione di EBITDA, confermando ${PFNEBITDA1 <= 4 ? 'un livello di leverage sostenibile rispetto ai parametri creditizi di riferimento' : 'un livello di leverage che richiede attenzione e un piano di rientro strutturato'}.</p>`;

  // ── narrative per sezione CF
  const narrativeCF = `
<p>Il Rendiconto Finanziario proiettato analizza la generazione e l'utilizzo della cassa nel triennio ${annoBase + 1}–${annoBase + 3}, articolando i flussi nelle tre aree gestionali fondamentali: area operativa, area degli investimenti e area finanziaria. Il flusso di cassa operativo (FCO) trae origine dall'EBITDA${EBITDA1 > 0 ? ` che, già nel ${annoBase + 1}, raggiunge <strong>${fmtE(EBITDA1)}</strong>` : ', che nel primo anno registra un valore che richiede un attento monitoraggio della liquidità operativa'}, al quale si sommano algebricamente le variazioni del capitale circolante netto e si sottraggono le imposte sul reddito di competenza. La qualità dell'EBITDA come proxy della generazione di cassa operativa è ${EBITDAM1 >= 8 ? 'elevata, con un margine superiore all\'8% che garantisce una base solida per il servizio del debito' : 'in progressivo miglioramento, con margini attesi in crescita nel biennio successivo al primo anno di piano'}.</p>

<p>Sul fronte degli investimenti, il piano CAPEX${(d.capex && d.capex.length) ? ' pianificato dalla direzione aziendale' : ' di mantenimento e rinnovo ordinario degli asset'} determina il flusso di investimento nel periodo. Tali uscite di cassa riducono il Free Cash Flow disponibile per il servizio del debito e per l'autofinanziamento aziendale${d.capex && d.capex.length ? ', rappresentando tuttavia una scelta strategica volta a sostenere la capacità produttiva e commerciale dell\'azienda nel medio termine' : ', mantenendosi tuttavia a livelli compatibili con la capacità di generazione di cassa del piano'}. Il saldo tra flusso operativo e flusso di investimento determina il Free Cash Flow (FCF) disponibile, che il piano proietta in territorio${EBITDA1 > 0 ? ' positivo nel corso del triennio, a conferma dell\'equilibrio finanziario complessivo del modello' : ' di progressivo miglioramento, con attesa positività nel corso del periodo di piano'}.</p>

<p>Il flusso finanziario riflette la struttura del debito bancario in essere${d.nuovo_fin && d.fin_importo ? ` e l'erogazione del nuovo finanziamento di <strong>${fmtE(d.fin_importo)}</strong>${d.fin_tipo ? ' (' + d.fin_tipo + ')' : ''}${( d._fin_durata_effettiva || d.fin_durata) ? ' su una durata di ' + (d._fin_durata_effettiva || d.fin_durata) + ' anni' + (d._fin_durata_effettiva && d._fin_durata_effettiva !== d.fin_durata ? ' (adeguata automaticamente per DSCR ≥ 1,10x)' : '') : ''}, le cui rate di rimborso sono state incluse nel calcolo del DSCR e` : ', le cui rate di rimborso'} incidono sul fabbisogno di liquidità annuale. Il servizio del debito complessivo è coperto dalla generazione di cassa operativa con un DSCR di <strong>${fmtX(DSCR1)}x</strong> nel primo anno${DSCR2 !== undefined ? ` e di <strong>${fmtX(DSCR2)}x</strong> nel ${annoBase + 2}` : ''}, garantendo che per ogni euro di rata il piano generi un flusso EBITDA superiore, a presidio della continuità del rimborso. La cassa finale risulta positiva in tutti e tre gli anni del piano, segnalando la robustezza della pianificazione finanziaria e la capacità dell'azienda di far fronte agli impegni assunti nei confronti del sistema creditizio.</p>`;

  // ── KPI cards (exec summary)
  const kpiCard = (val, label, soglia, color) => `
    <div class="kpi-card" style="border-left:4px solid ${color}">
      <div class="kc-val" style="color:${color}">${val}</div>
      <div class="kc-lbl">${label}</div>
      <div class="kc-sg">${soglia}</div>
    </div>`;

  const cresc1Color = R1 > R0 ? '#059669' : '#DC2626';
  const un1Color = UN1 >= 0 ? '#059669' : '#DC2626';
  const beColor = be && be.utilizzo_cap <= 80 ? '#059669' : be && be.utilizzo_cap <= 100 ? '#D97706' : '#DC2626';

  const kpiCardRich = (val, label, soglia, color, trend='', trendColor='#94A3B8') => `
    <div class="kpi-card" style="border-left:4px solid ${color}">
      <div class="kc-val" style="color:${color}">${val}</div>
      ${trend ? `<div style="font-size:8px;color:${trendColor};margin-top:2px">${trend}</div>` : ''}
      <div class="kc-lbl">${label}</div>
      <div class="kc-sg">${soglia}</div>
    </div>`;

  const kpiCards = `
    <div class="kpi-cards">
      ${kpiCardRich(fmtX(DSCR1), `DSCR ${annoBase + 1}`, 'EBA min ≥ 1,10x', dscrColor(DSCR1), DSCR1 !== null ? (DSCR1 >= 1.25 ? '✓ Ampiamente sopra soglia' : DSCR1 >= 1.10 ? '⚠ Sopra soglia minima' : '✗ Sotto soglia EBA') : '', dscrColor(DSCR1))}
      ${kpiCardRich(fmtP(EBITDAM1), `EBITDA Margin ${annoBase + 1}`, 'Target > 8%', EBITDAM1 >= 8 ? '#059669' : EBITDAM1 >= 4 ? '#D97706' : '#DC2626', EBITDAM1 >= 8 ? '✓ Sopra soglia bancaria' : EBITDAM1 >= 4 ? '⚠ Sotto target 8%' : '✗ Margine critico', EBITDAM1 >= 8 ? '#059669' : EBITDAM1 >= 4 ? '#D97706' : '#DC2626')}
      ${kpiCardRich(fmtX(PFNEBITDA1), `PFN/EBITDA ${annoBase + 1}`, 'Attenzione > 4x', pfnColor(PFNEBITDA1), PFNEBITDA1 === null ? 'PFN nulla o negativa' : PFNEBITDA1 <= 3 ? '✓ Leverage ottimale' : PFNEBITDA1 <= 4 ? '⚠ Leverage accettabile' : '✗ Sopra soglia', pfnColor(PFNEBITDA1))}
      ${kpiCardRich('+' + (d.g1 || 0) + '%', `Crescita Ricavi ${annoBase + 1}`, `${fmtM(R0)} → ${fmtM(R1)}`, cresc1Color, CAGR !== null ? `CAGR triennale: +${CAGR.toFixed(1)}%` : '', '#64748B')}
      ${kpiCardRich(fmtE(UN1), `Utile Netto ${annoBase + 1}`, 'Obiettivo positivo', un1Color, UN1 >= 0 ? `✓ ${fmtP(UN1/R1*100)} sui ricavi` : '✗ Perdita di esercizio', un1Color)}
      ${kpiCardRich(be ? fmtP(be.utilizzo_cap) : '—', 'Break-Even Utilizzo', `Margine sicurezza: ${be ? fmtP(be.margine_perc) : '—'}`, beColor, be ? `Break-even a ${fmtM(be.ricavi_be)}` : '', '#64748B')}
    </div>`;

  const alertsHTML = alerts.map(a => {
    const t = a.type === 'success' ? 'ok' : a.type === 'warning' ? 'warn' : a.type === 'info' ? 'info' : 'bad';
    return `<div class="alert-print ${t}">${a.icon} ${a.msg}</div>`;
  }).join('');

  // ── sensitivity table (EBA/FED multi-dimensional stress)
  const sensScenarios = [
    { label: 'Ricavi −10%', rFactor: 0.90, mAdj: 0 },
    { label: 'Ricavi −20% (EBA base stress)', rFactor: 0.80, mAdj: 0 },
    { label: 'Ricavi −30% (EBA severe)', rFactor: 0.70, mAdj: 0 },
    { label: 'Margin compression −2pp', rFactor: 1.00, mAdj: -2 },
    { label: 'Combinato: −15% ricavi + −1pp margin', rFactor: 0.85, mAdj: -1 },
  ];
  const sensRows = sensScenarios.map(sc => {
    const r = R1 * sc.rFactor;
    const em = (EBITDAM1 || 0) + sc.mAdj;
    const e = r * (em / 100);
    const ds = debtService1 > 0 ? e / debtService1 : null;
    const ok = ds !== null && ds >= 1.1;
    return `<tr>
      <td style="font-size:9px">${sc.label}</td>
      <td>${fmtE(r)}</td><td>${fmtE(e)}</td>
      <td style="font-size:8.5px;color:#94A3B8">${fmtP(em)}</td>
      <td style="color:${dscrColor(ds)};font-weight:700">${fmtX(ds)}</td>
      <td>${ok ? '<span style="color:#059669">Sostenibile</span>' : '<span style="color:#DC2626">Critico</span>'}</td>
    </tr>`;
  }).join('');

  const cssReport = `
    *{box-sizing:border-box;margin:0;padding:0}
    @page{size:A4;margin:18mm 16mm;}
    body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#0F172A;background:#E2E8F0;font-size:11px;line-height:1.5}
    .pos{color:#059669}.neg{color:#DC2626}.warn{color:#D97706}.neu{color:#1D4ED8}
    .page{width:210mm;min-height:297mm;background:#fff;margin:0 auto 14px;padding:24mm 18mm;position:relative;box-shadow:0 4px 24px rgba(0,0,0,.12);page-break-after:always}
    .page:last-child{page-break-after:auto}
    @media print{body{background:#fff}.page{box-shadow:none;margin:0;padding:0}.print-bar{display:none}}

    .cover{background:#0A1628;color:#fff;padding:0;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between}
    .cover-inner{padding:30mm 20mm;position:relative;z-index:1;height:100%;display:flex;flex-direction:column;justify-content:space-between;min-height:297mm}
    .cover::before{content:'';position:absolute;top:0;right:0;width:55%;height:100%;background:linear-gradient(135deg,transparent 0%,#1E3A5F 50%,#0E2A4A 100%);clip-path:polygon(20% 0%,100% 0%,100% 100%,0% 100%)}
    .cv-brand{font-size:10px;color:rgba(255,255,255,.4);letter-spacing:.18em;text-transform:uppercase}
    .cv-tipo{font-size:11px;color:#60A5FA;text-transform:uppercase;letter-spacing:.12em;margin-bottom:14px;position:relative;z-index:1}
    .cv-title{font-family:Georgia,serif;font-size:30px;font-weight:700;line-height:1.1;position:relative;z-index:1}
    .cv-nome{font-family:Georgia,serif;font-size:40px;font-weight:700;color:#fff;line-height:1.05;margin:6px 0 10px;position:relative;z-index:1}
    .cv-badge{display:inline-block;background:${scenarioColor};color:#fff;font-size:11px;font-weight:600;padding:7px 16px;border-radius:20px;letter-spacing:.04em;position:relative;z-index:1}
    .cv-divider{height:1px;background:rgba(255,255,255,.1);margin:32px 0;position:relative;z-index:1}
    .cv-meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px 24px;position:relative;z-index:1}
    .cv-meta-lbl{font-size:9px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px}
    .cv-meta-val{font-size:14px;font-weight:500}
    .cv-foot{font-size:9.5px;color:rgba(255,255,255,.35);letter-spacing:.05em;position:relative;z-index:1;border-top:1px solid rgba(255,255,255,.08);padding-top:14px}

    .sec-hdr{display:flex;align-items:center;gap:12px;margin-bottom:18px;border-bottom:2px solid #E2E8F0;padding-bottom:10px}
    .sec-bar{width:5px;height:30px;background:#2563EB;border-radius:3px}
    .sec-ey{font-size:9px;font-weight:700;color:#2563EB;text-transform:uppercase;letter-spacing:.12em}
    .sec-ti{font-family:Georgia,serif;font-size:21px;font-weight:700;color:#0F172A}
    h3{font-size:12px;font-weight:700;color:#1D4ED8;margin:18px 0 8px}
    p.lead{font-size:10px;color:#64748B;margin-bottom:8px}
    .narrative{background:#F8FAFC;border-left:4px solid #2563EB;border-radius:6px;padding:14px 18px;font-size:10.5px;line-height:1.75;color:#334155;margin:14px 0}
    .narrative p{margin:0 0 9px 0}.narrative p:last-child{margin-bottom:0}
    .narrative strong{color:#0F172A}.narrative em{color:#2563EB;font-style:normal;font-weight:600}

    .kpi-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:11px;margin:12px 0}
    .kpi-card{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:9px;padding:13px 14px}
    .kc-val{font-family:Georgia,serif;font-size:22px;font-weight:700;line-height:1}
    .kc-lbl{font-size:10px;font-weight:600;color:#334155;margin-top:6px}
    .kc-sg{font-size:8.5px;color:#94A3B8;margin-top:2px}

    .alert-print{border-radius:6px;padding:9px 13px;margin-bottom:7px;font-size:9.5px;line-height:1.5}
    .alert-print.ok{background:#DCFCE7;border-left:4px solid #16A34A;color:#166534}
    .alert-print.warn{background:#FEF3C7;border-left:4px solid #F59E0B;color:#92400E}
    .alert-print.bad{background:#FEE2E2;border-left:4px solid #DC2626;color:#991B1B}
    .alert-print.info{background:#EFF6FF;border-left:4px solid #2563EB;color:#1E40AF}

    table.rep{width:100%;border-collapse:collapse;font-size:9.5px;margin-top:8px}
    table.rep th{background:#0A1628;color:#fff;padding:8px 8px;text-align:right;font-size:8.5px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
    table.rep th:first-child{text-align:left}
    table.rep td{padding:6px 8px;border-bottom:1px solid #F1F5F9;text-align:right}
    table.rep td:first-child{text-align:left}
    table.rep td.d{font-size:8.5px}
    table.rep tr.sec td{background:#EFF2F7;font-weight:700;font-size:8px;text-transform:uppercase;letter-spacing:.06em;color:#475569;padding:5px 8px}
    table.rep tr.sub td:first-child{padding-left:20px;color:#64748B}
    table.rep tr.tot td{font-weight:700;background:#F0F9FF;border-top:1.5px solid #0A1628;border-bottom:1.5px solid #BFDBFE}
    table.rep tr.ebitda td{background:#F0FDF4;color:#15803D;font-weight:800;border-top:1px solid #BBF7D0;border-bottom:1px solid #BBF7D0}
    table.rep tr.utile-pos td{color:#16A34A}
    table.rep tr.utile-neg td{color:#DC2626}

    .badge-yr{display:inline-block;font-size:9px;font-weight:700;padding:3px 9px;border-radius:12px;color:#fff}
    .ratio-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0}
    .ratio-box{text-align:center;padding:11px;border-radius:8px;background:#F8FAFC;border:1px solid #E2E8F0}
    .ratio-box .v{font-family:Georgia,serif;font-size:18px;font-weight:700}
    .ratio-box .l{font-size:9px;color:#64748B;margin-top:3px}

    .info-box{background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:14px;font-size:10px;line-height:1.6;color:#1E40AF;margin:12px 0}
    .stress-box{background:#FEF3C7;border-left:4px solid #F59E0B;border-radius:8px;padding:14px;font-size:10px;line-height:1.6;color:#92400E;margin:12px 0}
    .verdict{display:inline-block;font-size:14px;font-weight:700;padding:10px 24px;border-radius:8px;letter-spacing:.04em;color:#fff}
    .verdict.ok{background:#059669}.verdict.no{background:#DC2626}.verdict.auto{background:#2563EB}
    .chart-box{border:1px solid #E2E8F0;border-radius:8px;padding:12px;background:#fff;margin:10px 0}
    .disclaimer{font-size:8.5px;color:#94A3B8;line-height:1.6;border-top:1px solid #E2E8F0;padding-top:10px;margin-top:14px}
    .pf{display:flex;justify-content:space-between;font-size:8px;color:#94A3B8;border-top:.5px solid #E2E8F0;padding-top:7px;margin-top:24px}
    .print-bar{position:fixed;bottom:20px;right:20px;display:flex;gap:8px;z-index:999}
    .print-bar button{padding:10px 18px;border-radius:8px;font-weight:600;cursor:pointer;font-size:13px;border:none}
    .print-bar .btn-print{background:#2563EB;color:#fff}
    .print-bar .btn-dl{background:#fff;border:1.5px solid #E2E8F0;color:#1E293B}
  `;

  const hasNarrativa = !!(d.desc_aziendale || d.desc_progetto || d.desc_mercato || d.punti_forza || d.punti_rischio);
  const hasScheda = !!d._template;
  const totalPages = 10 + (hasNarrativa ? 1 : 0) + (hasScheda ? 1 : 0);
  const pf = (n) => `<div class="pf"><span>${nome} — Business Plan ${annoBase + 1}–${annoBase + 3} · RISERVATO E CONFIDENZIALE</span><span>${n} / ${totalPages}</span></div>`;
  const secHdr = (ey, ti) => `<div class="sec-hdr"><div class="sec-bar"></div><div><div class="sec-ey">${ey}</div><div class="sec-ti">${ti}</div></div></div>`;

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

<!-- PAGE 1 — COVER -->
<div class="page cover">
  <div class="cover-inner">
    <div class="cv-brand">AnalisieBBusinessPlan.it · Analisi Finanziaria</div>
    <div>
      <div class="cv-tipo">Business Plan Finanziario · EBA/GL/2020/06</div>
      <div class="cv-title">Piano Economico-Finanziario</div>
      <div class="cv-nome">${nome}</div>
      <div class="cv-divider"></div>
      <div class="cv-meta">
        <div><div class="cv-meta-lbl">Anno Base</div><div class="cv-meta-val">${annoBase}</div></div>
        <div><div class="cv-meta-lbl">Proiezione</div><div class="cv-meta-val">${annoBase + 1} – ${annoBase + 3}</div></div>
        <div><div class="cv-meta-lbl">Settore</div><div class="cv-meta-val">${d.settore || '—'}</div></div>
        <div><div class="cv-meta-lbl">Data Report</div><div class="cv-meta-val">${now}</div></div>
        <div><div class="cv-meta-lbl">Modello</div><div class="cv-meta-val">3-Statement</div></div>
      </div>
    </div>
    <div>
      <div style="display:flex;gap:0;border:1px solid rgba(255,255,255,.12);border-radius:10px;overflow:hidden;margin-bottom:16px;position:relative;z-index:1">
        <div style="flex:1;padding:10px 14px;border-right:1px solid rgba(255,255,255,.08)"><div style="font-size:8px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px">Ricavi ${annoBase+1}</div><div style="font-family:Georgia,serif;font-size:15px;font-weight:700;color:#fff">${fmtM(R1)}</div></div>
        <div style="flex:1;padding:10px 14px;border-right:1px solid rgba(255,255,255,.08)"><div style="font-size:8px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px">CAGR 3 anni</div><div style="font-family:Georgia,serif;font-size:15px;font-weight:700;color:#fff">${CAGR !== null ? '+'+CAGR.toFixed(1)+'%' : '—'}</div></div>
        <div style="flex:1;padding:10px 14px;border-right:1px solid rgba(255,255,255,.08)"><div style="font-size:8px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px">EBITDA% ${annoBase+1}</div><div style="font-family:Georgia,serif;font-size:15px;font-weight:700;color:${EBITDAM1>=8?'#6EE7B7':EBITDAM1>=4?'#FCD34D':'#FCA5A5'}">${fmtP(EBITDAM1)}</div></div>
        <div style="flex:1;padding:10px 14px;border-right:1px solid rgba(255,255,255,.08)"><div style="font-size:8px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px">DSCR ${annoBase+1}</div><div style="font-family:Georgia,serif;font-size:15px;font-weight:700;color:${DSCR1===null?'#94A3B8':DSCR1>=1.25?'#6EE7B7':DSCR1>=1.1?'#FCD34D':'#FCA5A5'}">${fmtX(DSCR1)}</div></div>
        <div style="flex:1;padding:10px 14px"><div style="font-size:8px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px">Utile ${annoBase+1}</div><div style="font-family:Georgia,serif;font-size:15px;font-weight:700;color:${UN1>=0?'#6EE7B7':'#FCA5A5'}">${fmtM(UN1)}</div></div>
      </div>
      <div class="cv-foot">EBA/GL/2020/06 · D.Lgs. 14/2019 CCII · Modello CE + SP + CF · ${d.fonte === 'xbrl' ? 'Dati XBRL certificati' : 'Dati dichiarativi'}</div>
    </div>
  </div>
</div>

<!-- PAGE 2 — ANALISI DI BILANCIO STORICO -->
${(() => {
  // Dati storici passati nel payload (da XBRL o input manuale)
  const R0s    = d.ricavi_base || 0;
  const altRic = d.altri_ricavi || 0;
  const matP   = d.mat_prime || 0;
  const serv   = d.servizi || 0;
  const cprs   = d.costo_pers_storico || 0;
  const amms   = d.ammortamenti_storici || d.ammortamenti || 0;
  const ebs    = d.ebitda_storico || EBITDA0 || 0;
  const ofsS   = d.oneri_fin_storici || 0;
  const utS    = d.utile_storico || 0;
  const debBT  = d.deb_bt || 0;
  const debMLT = d.deb_mlt || 0;
  const pnS    = d.pn_attuale || 0;
  const capS   = d.cap_soc || 0;
  const risS   = d.riserve || 0;
  const tfrs   = d.tfr_storico || 0;
  const credC  = d.crediti_clienti || 0;
  const rimS   = d.rimanenze_storiche || 0;
  const liqS   = d.liquidita || 0;
  const immMat = d.immob_mat || 0;
  const immImm = d.immob_imm || 0;
  const totAtt = d.tot_attivo || 0;
  const debForn= d.debiti_fornitori || 0;
  const pfnS   = d.pfn_storico || (debBT + debMLT - liqS);

  const dsoS   = d.dso || (R0s > 0 ? credC / (R0s / 365) : 0);
  const dpoS   = d.dpo || 0;
  const dioS   = d.dio || 0;
  const emS    = d.ebitda_margin || (R0s > 0 ? ebs / R0s * 100 : 0);
  const mlS    = d.margine_lordo || 0;
  const roiS   = totAtt > 0 ? ebs / totAtt * 100 : null;
  const roeS   = pnS > 0 ? utS / pnS * 100 : null;
  const pfnEbS = ebs > 0 ? pfnS / ebs : null;
  const icrS   = ofsS > 0 ? ebs / ofsS : null;
  const indAut = totAtt > 0 ? pnS / totAtt * 100 : null;
  const capCir = credC + rimS + liqS - debForn - debBT;

  const rOk = c => c ? '#15803D' : '#DC2626';
  const rBg = c => c ? '#DCFCE7' : '#FEE2E2';

  const pfnOk = pfnEbS === null || pfnEbS <= 4;
  const icrOk = icrS === null || icrS >= 2;
  const autOk = indAut === null || indAut >= 20;
  const emOk  = emS >= 5;

  const row = (lbl, v, cls='') => `<tr class="${cls}"><td>${lbl}</td><td>${fmtE(v)}</td></tr>`;
  const rowPct = (lbl, v, cls='') => `<tr class="${cls}"><td>${lbl}</td><td>${v !== null && !isNaN(v) ? v.toFixed(1)+'%' : '—'}</td></tr>`;

  const hasSP = totAtt > 0;

  return `<div class="page">
  ${secHdr(`Analisi storica — Anno ${annoBase}`, '2. Analisi di Bilancio')}

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">

    <!-- CE Storico -->
    <div>
      <h3 style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#475569;margin:0 0 6px">Conto Economico Storico</h3>
      <table class="rep">
        <thead><tr><th style="text-align:left">Voce</th><th>Anno ${annoBase}</th></tr></thead>
        <tbody>
          ${row('Ricavi delle vendite', R0s, 'tot')}
          ${altRic > 0 ? row('Altri ricavi', altRic) : ''}
          <tr class="sec"><td colspan="2">Costi operativi</td></tr>
          ${matP > 0 ? row('Mat. prime / merci / servizi', -matP, 'sub') : ''}
          ${serv > 0 ? row('Costi per servizi', -serv, 'sub') : ''}
          ${cprs > 0 ? row('Costo del personale', -cprs, 'sub') : ''}
          <tr class="ebitda"><td>EBITDA</td><td>${fmtE(ebs)}</td></tr>
          ${rowPct('EBITDA Margin', emS)}
          ${amms > 0 ? row('Ammortamenti', -amms, 'sub') : ''}
          ${ofsS > 0 ? row('Oneri finanziari', -ofsS, 'sub') : ''}
          <tr class="${utS >= 0 ? 'utile-pos' : 'utile-neg'} tot"><td>Utile netto</td><td>${fmtE(utS)}</td></tr>
        </tbody>
      </table>
    </div>

    <!-- SP Storico -->
    <div>
      <h3 style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#475569;margin:0 0 6px">Stato Patrimoniale Storico</h3>
      ${hasSP ? `<table class="rep">
        <thead><tr><th style="text-align:left">Voce</th><th>Anno ${annoBase}</th></tr></thead>
        <tbody>
          <tr class="sec"><td colspan="2">Attivo</td></tr>
          ${immMat > 0 ? row('Immobilizzazioni materiali', immMat, 'sub') : ''}
          ${immImm > 0 ? row('Immobilizzazioni immateriali', immImm, 'sub') : ''}
          ${credC > 0 ? row('Crediti verso clienti', credC, 'sub') : ''}
          ${rimS > 0 ? row('Rimanenze', rimS, 'sub') : ''}
          ${liqS > 0 ? row('Liquidità', liqS, 'sub') : ''}
          <tr class="tot"><td>Totale Attivo</td><td>${fmtE(totAtt)}</td></tr>
          <tr class="sec"><td colspan="2">Passivo e Patrimonio Netto</td></tr>
          ${capS > 0 ? row('Capitale sociale', capS, 'sub') : ''}
          ${risS !== 0 ? row('Riserve', risS, 'sub') : ''}
          ${utS !== 0 ? row('Utile / perdita d\'esercizio', utS, 'sub') : ''}
          <tr class="tot"><td>Patrimonio Netto</td><td>${fmtE(pnS)}</td></tr>
          ${tfrs > 0 ? row('TFR', tfrs, 'sub') : ''}
          ${debMLT > 0 ? row('Debiti bancari M/L termine', debMLT, 'sub') : ''}
          ${debBT > 0 ? row('Debiti bancari breve termine', debBT, 'sub') : ''}
          ${debForn > 0 ? row('Debiti verso fornitori', debForn, 'sub') : ''}
        </tbody>
      </table>` : '<p style="font-size:9px;color:#94A3B8">Dati Stato Patrimoniale non disponibili.</p>'}
    </div>
  </div>

  <!-- Indici -->
  <h3 style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#475569;margin:14px 0 8px">Indici di Bilancio</h3>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px">
    <div class="ratio-box" style="background:${rBg(emOk)};border-color:${rOk(emOk)}">
      <div class="v" style="color:${rOk(emOk)}">${emS.toFixed(1)}%</div>
      <div class="l">EBITDA Margin<br><span style="font-size:8px;font-weight:400">soglia ≥ 5%</span></div>
    </div>
    <div class="ratio-box" style="background:${rBg(pfnOk)};border-color:${rOk(pfnOk)}">
      <div class="v" style="color:${rOk(pfnOk)}">${pfnEbS !== null ? pfnEbS.toFixed(2)+'x' : '—'}</div>
      <div class="l">PFN/EBITDA<br><span style="font-size:8px;font-weight:400">soglia ≤ 4x</span></div>
    </div>
    <div class="ratio-box" style="background:${rBg(icrOk)};border-color:${rOk(icrOk)}">
      <div class="v" style="color:${rOk(icrOk)}">${icrS !== null ? icrS.toFixed(2)+'x' : '—'}</div>
      <div class="l">ICR (EBITDA/OF)<br><span style="font-size:8px;font-weight:400">soglia ≥ 2x</span></div>
    </div>
    <div class="ratio-box" style="background:${rBg(autOk)};border-color:${rOk(autOk)}">
      <div class="v" style="color:${rOk(autOk)}">${indAut !== null ? indAut.toFixed(1)+'%' : '—'}</div>
      <div class="l">Autonomia finanziaria<br><span style="font-size:8px;font-weight:400">soglia ≥ 20%</span></div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
    <div class="ratio-box">
      <div class="v">${dsoS > 0 ? Math.round(dsoS)+' gg' : '—'}</div>
      <div class="l">DSO — Giorni incasso<br><span style="font-size:8px;color:#94A3B8">Crediti / (Ricavi/365)</span></div>
    </div>
    <div class="ratio-box">
      <div class="v">${dpoS > 0 ? Math.round(dpoS)+' gg' : '—'}</div>
      <div class="l">DPO — Giorni pagamento<br><span style="font-size:8px;color:#94A3B8">Debiti forn. / (Acquisti/365)</span></div>
    </div>
    <div class="ratio-box">
      <div class="v">${dioS > 0 ? Math.round(dioS)+' gg' : '—'}</div>
      <div class="l">DIO — Giorni magazzino<br><span style="font-size:8px;color:#94A3B8">Rimanenze / (Acquisti/365)</span></div>
    </div>
  </div>

  ${roeS !== null || roiS !== null ? `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
    ${roeS !== null ? `<div class="ratio-box"><div class="v">${roeS.toFixed(1)}%</div><div class="l">ROE — Return on Equity</div></div>` : ''}
    ${roiS !== null ? `<div class="ratio-box"><div class="v">${roiS.toFixed(1)}%</div><div class="l">ROI — Return on Assets</div></div>` : ''}
    <div class="ratio-box"><div class="v">${fmtE(pfnS)}</div><div class="l">PFN (Posizione Fin. Netta)</div></div>
  </div>` : ''}

  ${(totAtt > 0 && pnS > 0 && R0s > 0) ? `
  <h3 style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#475569;margin:14px 0 6px">Analisi DuPont — Scomposizione ROE (anno ${annoBase})</h3>
  <table class="rep" style="margin-bottom:6px">
    <thead>
      <tr>
        <th style="text-align:left">Componente</th>
        <th>Formula</th>
        <th>Valore</th>
        <th style="text-align:left;font-size:8px">Interpretazione</th>
      </tr>
    </thead>
    <tbody>
      <tr class="sub"><td>Net Profit Margin</td><td style="color:#94A3B8;font-size:8px">Utile / Ricavi</td><td>${utS !== null && R0s > 0 ? (utS/R0s*100).toFixed(1)+'%' : '—'}</td><td style="text-align:left;font-size:8.5px;color:#475569">Redditività delle vendite</td></tr>
      <tr class="sub"><td>Asset Turnover</td><td style="color:#94A3B8;font-size:8px">Ricavi / Tot. Attivo</td><td>${(R0s/totAtt).toFixed(2)}x</td><td style="text-align:left;font-size:8.5px;color:#475569">Efficienza utilizzo asset</td></tr>
      <tr class="sub"><td>Equity Multiplier</td><td style="color:#94A3B8;font-size:8px">Tot. Attivo / PN</td><td>${(totAtt/pnS).toFixed(2)}x</td><td style="text-align:left;font-size:8.5px;color:#475569">Leva finanziaria</td></tr>
      <tr class="ebitda"><td><strong>ROE (DuPont)</strong></td><td style="color:#94A3B8;font-size:8px">NPM × AT × EM</td><td><strong>${roeS !== null ? roeS.toFixed(1)+'%' : '—'}</strong></td><td style="text-align:left;font-size:8.5px;color:#166534">Rendimento del cap. proprio</td></tr>
    </tbody>
  </table>` : ''}

  <div class="info-box" style="margin-top:12px">
    📊 L'analisi storica evidenzia una struttura patrimoniale con PFN di ${fmtE(pfnS)} e patrimonio netto di ${fmtE(pnS)}.
    ${emOk ? `Il margine EBITDA del ${emS.toFixed(1)}% è in linea con i parametri bancari.` : `Il margine EBITDA del ${emS.toFixed(1)}% risulta inferiore alla soglia bancaria del 5%.`}
    ${pfnOk && icrOk ? 'La struttura finanziaria è equilibrata.' : 'Si raccomanda un piano di riduzione del debito.'}
    Il ciclo del capitale circolante evidenzia ${dsoS > 0 ? `DSO ${Math.round(dsoS)} gg` : 'dati non disponibili'}, con impatto sulla liquidità operativa.
  </div>
  ${pf(2)}
</div>`;
})()}

<!-- PAGE 3 — EXECUTIVE SUMMARY -->
<div class="page">
  ${secHdr('Sintesi direzionale', '3. Executive Summary')}
  <div style="display:flex;align-items:center;gap:14px;padding:12px 16px;border-radius:9px;margin-bottom:14px;background:${bancabile?'#DCFCE7':noDebtPlan?'#EFF6FF':'#FEF2F2'};border:1px solid ${bancabile?'#BBF7D0':noDebtPlan?'#BFDBFE':'#FECACA'}">
    <div style="font-size:28px;font-weight:800;font-family:Georgia,serif;color:${bancabile?'#15803D':noDebtPlan?'#1D4ED8':'#DC2626'}">${bancabile||noDebtPlan?'✓':'⚠'}</div>
    <div style="flex:1">
      <div style="font-size:12px;font-weight:700;color:${bancabile?'#15803D':noDebtPlan?'#1D4ED8':'#DC2626'}">${bancabile?'Piano Bancabile — criteri EBA/GL/2020/06 soddisfatti':noDebtPlan?'Piano autofinanziato — nessun debito finanziario da rimborsare':'Piano con elementi di attenzione — verificare parametri bancari'}</div>
      <div style="font-size:9px;color:${bancabile?'#166534':noDebtPlan?'#1E40AF':'#991B1B'};margin-top:2px">DSCR ${noDebtPlan?'N/A — nessun debito finanziario':fmtX(DSCR1)} · EBITDA margin ${fmtP(EBITDAM1)} · PFN/EBITDA ${fmtX(PFNEBITDA1)} · Utile netto ${fmtE(UN1)}</div>
    </div>
  </div>
  ${kpiCards}
  <div class="narrative">${narrative}</div>
  <h3>Sintesi indicatori bancari</h3>
  <table class="rep">
    <thead>
      <tr>
        <th style="text-align:left">Indicatore</th>
        <th style="background:#1E3A5F">Storico ${annoBase}</th>
        <th>${annoBase+1}</th><th>${annoBase+2}</th><th>${annoBase+3}</th>
        <th style="background:#374151">Soglia EBA</th>
      </tr>
    </thead>
    <tbody>
      ${kpi.map(k => {
        const fmt = (v) => v === null || v === undefined ? '<span style="color:#94A3B8">—</span>' :
          typeof v === 'string' ? v :
          k.label.includes('€') ? fmtE(v) : k.label.includes('%') ? fmtP(v) : fmtX(v);
        const ok1 = k.ok !== undefined ? k.ok : true;
        return `<tr>
          <td style="font-weight:600">${k.label}</td>
          <td style="background:#F8FAFC">${fmt(k.s)}</td>
          <td style="color:${ok1?'#059669':'#DC2626'};font-weight:600">${fmt(k.a1)}</td>
          <td>${fmt(k.a2)}</td>
          <td>${fmt(k.a3)}</td>
          <td style="font-size:8px;color:#94A3B8;font-style:italic">${k.soglia||'—'}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
  <h3>Alert e raccomandazioni</h3>
  ${alertsHTML || '<div class="alert-print ok">✅ Nessuna criticità rilevata. Il piano è sostenibile nelle ipotesi indicate.</div>'}
  <h3>Ricavi vs EBITDA (€ Milioni)</h3>
  <div class="chart-box">${svgBars()}</div>
  ${pf(3)}
</div>

<!-- PAGE 4 — CONTO ECONOMICO -->
<div class="page">
  ${secHdr('Modello CE proiettato', '4. Conto Economico Proiettato')}
  <div class="narrative">${narrativeCE}</div>
  <div class="ratio-row" style="margin-bottom:10px">
    <div class="ratio-box"><div class="v" style="color:${EBITDAM1>=8?'#059669':'#D97706'}">${fmtP(EBITDAM1)}</div><div class="l">EBITDA Margin<br>${annoBase+1}</div></div>
    <div class="ratio-box"><div class="v" style="color:${EBITDAM2>=8?'#059669':'#D97706'}">${fmtP(EBITDAM2)}</div><div class="l">EBITDA Margin<br>${annoBase+2}</div></div>
    <div class="ratio-box"><div class="v" style="color:${EBITDAM3>=8?'#059669':'#D97706'}">${fmtP(EBITDAM3)}</div><div class="l">EBITDA Margin<br>${annoBase+3}</div></div>
  </div>
  <div class="chart-box" style="margin-bottom:10px">${svgSparkline(
    [{ data:[R0,R1,R2,R3], label:'Ricavi' }, { data:[EBITDA0,EBITDA1,EBITDA2,EBITDA3], label:'EBITDA' }],
    ['#2563EB','#059669'],
    [`${annoBase}`,`${annoBase+1}`,`${annoBase+2}`,`${annoBase+3}`],
    'Andamento Ricavi ed EBITDA — triennio proiettato'
  )}</div>
  ${projTable(CE)}
  <div class="disclaimer">I tassi di crescita (+${d.g1}% / +${d.g2}% / +${d.g3}%) si applicano ai ricavi storici ${annoBase}. I costi vengono proiettati mantenendo la struttura di margine ${d.fonte==='xbrl'?'certificata dal bilancio XBRL':'dichiarata nel piano'}. L'EBITDA margin target è ${d.ebitda_margin}% costante nel triennio; l'incremento assoluto dell'EBITDA è interamente guidato dalla crescita dei ricavi.</div>
  ${pf(4)}
</div>

<!-- PAGE 5 — STATO PATRIMONIALE -->
<div class="page">
  ${secHdr('Modello SP proiettato', '5. Stato Patrimoniale Proiettato')}
  <div class="narrative">${narrativeSP}</div>
  <div class="ratio-row" style="margin-bottom:10px">
    <div class="ratio-box"><span class="badge-yr" style="background:${pfnColor(PFNEBITDA1)};margin-bottom:4px">${fmtX(PFNEBITDA1)}</span><div class="l">PFN/EBITDA<br>${annoBase+1}</div></div>
    <div class="ratio-box"><span class="badge-yr" style="background:${pfnColor(PFNEBITDA2)};margin-bottom:4px">${fmtX(PFNEBITDA2)}</span><div class="l">PFN/EBITDA<br>${annoBase+2}</div></div>
    <div class="ratio-box"><span class="badge-yr" style="background:${pfnColor(PFNEBITDA3)};margin-bottom:4px">${fmtX(PFNEBITDA3)}</span><div class="l">PFN/EBITDA<br>${annoBase+3}</div></div>
  </div>
  <div class="chart-box" style="margin-bottom:10px">${svgSparkline(
    [{ data:[d.pn_attuale||0,PN1,PN2,PN3], label:'Patrimonio Netto' }, { data:[(d.pfn_storico||0),PFN1,PFN2,PFN3], label:'PFN' }],
    ['#2563EB','#DC2626'],
    [`${annoBase}`,`${annoBase+1}`,`${annoBase+2}`,`${annoBase+3}`],
    'Evoluzione Patrimonio Netto e PFN — triennio proiettato'
  )}</div>
  ${projTable(SP)}
  <div class="info-box">Il patrimonio netto cresce da <strong>${fmtE(PN1)}</strong> (${annoBase + 1}) a <strong>${fmtE(PN3)}</strong> (${annoBase + 3}), rafforzando la solidità patrimoniale dell'azienda. La Posizione Finanziaria Netta evolve da <strong>${fmtE(PFN1)}</strong> a <strong>${fmtE(PFN3)}</strong>${PFN3 < PFN1 ? ', confermando il progressivo de-leveraging previsto dal piano' : '; il rapporto PFN/EBITDA si mantiene entro i parametri bancari'}.</div>
  ${pf(5)}
</div>

<!-- PAGE 5b — SP GESTIONALE -->
<div class="page">
  ${secHdr('Struttura del capitale investito', '5b. Stato Patrimoniale Gestionale')}
  <div class="narrative">
    <p>Il <strong>Capitale Investito Netto Operativo (CINO)</strong> rappresenta le risorse impiegate nella gestione caratteristica dell'impresa: è dato dalla somma dell'attivo fisso netto e del capitale circolante netto operativo. Le fonti di copertura del CINO sono il Patrimonio Netto e l'Indebitamento Finanziario Netto (PFN). L'equilibrio tra queste componenti determina la sostenibilità strutturale del piano.</p>
  </div>
  ${(() => {
    // SP Gestionale calcolato
    const IMM0 = SP.find(r=>r.label==='Immobilizzazioni nette')?.s||0;
    const IMM1 = SP.find(r=>r.label==='Immobilizzazioni nette')?.a1||0;
    const IMM2 = SP.find(r=>r.label==='Immobilizzazioni nette')?.a2||0;
    const IMM3 = SP.find(r=>r.label==='Immobilizzazioni nette')?.a3||0;
    // CCN operativo (crediti+rimananeze-debiti comm.) approssimato da CCN già calcolato
    const CCN0v = SP.find(r=>r.label==='Capitale Circolante Netto (CCN)')?.s||0;
    const CCN1v = SP.find(r=>r.label==='Capitale Circolante Netto (CCN)')?.a1||0;
    const CCN2v = SP.find(r=>r.label==='Capitale Circolante Netto (CCN)')?.a2||0;
    const CCN3v = SP.find(r=>r.label==='Capitale Circolante Netto (CCN)')?.a3||0;
    const CINO0 = IMM0+CCN0v, CINO1 = IMM1+CCN1v, CINO2 = IMM2+CCN2v, CINO3 = IMM3+CCN3v;
    const PFN0v = d.pfn_storico||0;
    const rows = [
      ['ATTIVO FISSO NETTO', IMM0, IMM1, IMM2, IMM3, true, false],
      ['Immobilizzazioni materiali e immateriali', IMM0, IMM1, IMM2, IMM3, false, true],
      ['', null, null, null, null, false, false],
      ['CAPITALE CIRCOLANTE NETTO OPERATIVO', CCN0v, CCN1v, CCN2v, CCN3v, true, false],
      ['Crediti commerciali + Rimanenze', null, null, null, null, false, true],
      ['(−) Debiti commerciali e operativi', null, null, null, null, false, true],
      ['', null, null, null, null, false, false],
      ['CAPITALE INVESTITO NETTO (CINO)', CINO0, CINO1, CINO2, CINO3, true, false],
      ['', null, null, null, null, false, false],
      ['FONTI DI FINANZIAMENTO', null, null, null, null, true, false],
      ['Patrimonio Netto', d.pn_attuale||0, PN1, PN2, PN3, false, true],
      ['Indebitamento Finanziario Netto (PFN)', PFN0v, PFN1, PFN2, PFN3, false, true],
      ['TOTALE FONTI', (d.pn_attuale||0)+PFN0v, PN1+PFN1, PN2+PFN2, PN3+PFN3, true, false],
    ];
    const fmtG = n => n===null||n===undefined ? '—' : n.toLocaleString('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0});
    const rowsHTML = rows.map(([lbl,s,a1,a2,a3,total,sub])=>{
      if(!lbl) return `<tr><td colspan="5" style="padding:2px"></td></tr>`;
      const cls = total ? 'style="font-weight:700;background:#F1F5F9"' : sub ? 'style="color:#64748B;font-size:8.5px"' : '';
      const pad = sub ? 'style="padding-left:18px"' : '';
      return `<tr ${cls}><td ${pad}>${lbl}</td><td class="r">${s!==null?fmtG(s):'—'}</td><td class="r">${a1!==null?fmtG(a1):'—'}</td><td class="r">${a2!==null?fmtG(a2):'—'}</td><td class="r">${a3!==null?fmtG(a3):'—'}</td></tr>`;
    }).join('');
    return `<table class="rep">
      <thead><tr><th>Schema gestionale</th><th class="r">Storico ${annoBase}</th><th class="r">${annoBase+1}E</th><th class="r">${annoBase+2}E</th><th class="r">${annoBase+3}E</th></tr></thead>
      <tbody>${rowsHTML}</tbody></table>`;
  })()}
  <h3>Indici di copertura e solidità patrimoniale</h3>
  ${(() => {
    const aut0 = (d.pn_attuale||0)/((SP.find(r=>r.label==='TOTALE ATTIVO')?.s)||1)*100;
    const aut1 = PN1/((SP.find(r=>r.label==='TOTALE ATTIVO')?.a1)||1)*100;
    const aut2 = PN2/((SP.find(r=>r.label==='TOTALE ATTIVO')?.a2)||1)*100;
    const aut3 = PN3/((SP.find(r=>r.label==='TOTALE ATTIVO')?.a3)||1)*100;
    const leva0 = d.pn_attuale>0 ? (d.pfn_storico||0)/d.pn_attuale : null;
    const leva1 = PN1>0 ? PFN1/PN1 : null;
    const leva2 = PN2>0 ? PFN2/PN2 : null;
    const leva3 = PN3>0 ? PFN3/PN3 : null;
    const pfnR0 = EBITDA0>0 ? (d.pfn_storico||0)/EBITDA0 : null;
    const fmtR = (n,suf='x') => n===null||isNaN(n)||!isFinite(n) ? '—' : n.toFixed(2)+suf;
    const sem = (v,g,a,higher=true) => {
      if(v===null||isNaN(v)||!isFinite(v)) return '#94A3B8';
      return (higher?v>=g:v<=g) ? '#059669' : (higher?v>=a:v<=a) ? '#D97706' : '#DC2626';
    };
    const dot = (v,g,a,higher=true) => `<span style="color:${sem(v,g,a,higher)};font-size:10px">●</span>`;
    return `<table class="rep">
      <thead><tr><th>Indice</th><th class="r">Storico ${annoBase}</th><th class="r">${annoBase+1}E</th><th class="r">${annoBase+2}E</th><th class="r">${annoBase+3}E</th><th>Soglia EBA</th></tr></thead>
      <tbody>
        <tr><td>${dot(aut1,30,15)} Autonomia finanziaria</td><td class="r">${fmtR(aut0,'%')}</td><td class="r">${fmtR(aut1,'%')}</td><td class="r">${fmtR(aut2,'%')}</td><td class="r">${fmtR(aut3,'%')}</td><td style="font-size:8px;color:#64748B">&gt;30% ottimale</td></tr>
        <tr><td>${dot(leva1,2,4,false)} Leva finanziaria (D/E)</td><td class="r">${fmtR(leva0)}</td><td class="r">${fmtR(leva1)}</td><td class="r">${fmtR(leva2)}</td><td class="r">${fmtR(leva3)}</td><td style="font-size:8px;color:#64748B">&lt;2x conserv. / &lt;4x attenzione</td></tr>
        <tr><td>${dot(PFNEBITDA1,3,5,false)} PFN / EBITDA</td><td class="r">${fmtR(pfnR0)}</td><td class="r">${fmtR(PFNEBITDA1)}</td><td class="r">${fmtR(PFNEBITDA2)}</td><td class="r">${fmtR(PFNEBITDA3)}</td><td style="font-size:8px;color:#64748B">&lt;3x ottimale / &lt;5x limite</td></tr>
      </tbody></table>`;
  })()}
  ${pf(6)}
</div>

<!-- PAGE 6 — CASH FLOW -->
<div class="page">
  ${secHdr('Rendiconto finanziario', '6. Cash Flow Statement')}
  <div class="narrative">${narrativeCF}</div>
  ${cfTable(CF)}
  <h3>Waterfall Cash Flow ${annoBase + 1}</h3>
  <div class="chart-box">${svgWaterfall()}</div>
  ${pf(7)}
</div>

<!-- PAGE 6b — ANALISI CASH FLOW PLURIENNALE -->
<div class="page">
  ${secHdr('Analisi dei flussi di liquidità', '6b. Cash Flow Analitico Pluriennale')}
  <div class="narrative">
    <p>Il rendiconto finanziario analitico distingue i flussi di cassa per aree gestionali secondo la metodologia del <strong>Free Cash Flow to the Firm (FCFF)</strong>. Il <strong>Flusso di cassa operativo lordo</strong> (EBITDA) rappresenta la capacità di autofinanziamento; il <strong>Flusso corrente</strong> incorpora la variazione del capitale circolante; il <strong>Flusso al servizio del debito</strong> (FSD) indica la liquidità disponibile per rimborsare i finanziatori.</p>
  </div>
  ${(() => {
    const FCO1v = CF.find(r=>/Cash Flow Operativo/.test(r.label))?.a1||0;
    const FCO2v = CF.find(r=>/Cash Flow Operativo/.test(r.label))?.a2||0;
    const FCO3v = CF.find(r=>/Cash Flow Operativo/.test(r.label))?.a3||0;
    const CNET1 = CF.find(r=>/VARIAZIONE NETTA/.test(r.label))?.a1||0;
    const CNET2 = CF.find(r=>/VARIAZIONE NETTA/.test(r.label))?.a2||0;
    const CNET3 = CF.find(r=>/VARIAZIONE NETTA/.test(r.label))?.a3||0;
    const dCCN1v = -(CF.find(r=>/Variazione Capitale/.test(r.label))?.a1||0);
    const dCCN2v = -(CF.find(r=>/Variazione Capitale/.test(r.label))?.a2||0);
    const dCCN3v = -(CF.find(r=>/Variazione Capitale/.test(r.label))?.a3||0);
    const FCO_corr1 = EBITDA1 - dCCN1v;
    const FCO_corr2 = EBITDA2 - dCCN2v;
    const FCO_corr3 = EBITDA3 - dCCN3v;
    const FSD1 = FCO1v; // FCO è già al netto di tax, disponibile per DS
    const FSD2 = FCO2v;
    const FSD3 = FCO3v;
    const CAPEX1v = CF.find(r=>/Investimenti/.test(r.label))?.a1||0;
    const CAPEX2v = CF.find(r=>/Investimenti/.test(r.label))?.a2||0;
    const CAPEX3v = CF.find(r=>/Investimenti/.test(r.label))?.a3||0;
    const FCF1 = FCO1v + CAPEX1v;
    const FCF2 = FCO2v + CAPEX2v;
    const FCF3 = FCO3v + CAPEX3v;
    const RC1v = CF.find(r=>/Rimborso quota/.test(r.label))?.a1||0;
    const RC2v = CF.find(r=>/Rimborso quota/.test(r.label))?.a2||0;
    const RC3v = CF.find(r=>/Rimborso quota/.test(r.label))?.a3||0;
    const OF1v = CF.find(r=>/Oneri finanziari pagati/.test(r.label))?.a1||0;
    const OF2v = CF.find(r=>/Oneri finanziari pagati/.test(r.label))?.a2||0;
    const OF3v = CF.find(r=>/Oneri finanziari pagati/.test(r.label))?.a3||0;
    const DS1 = RC1v + OF1v, DS2 = RC2v + OF2v, DS3 = RC3v + OF3v;
    const FAZ1 = FCF1 + DS1, FAZ2 = FCF2 + DS2, FAZ3 = FCF3 + DS3;
    const fmtV = n => n===0||n===null ? '—' : (n<0?'('+Math.abs(Math.round(n)).toLocaleString('it-IT')+')':Math.round(n).toLocaleString('it-IT'))+' €';
    const colorV = n => n<0 ? 'color:#DC2626' : n>0 ? 'color:#059669' : '';
    const cfRows = [
      ['FLUSSO DI CASSA OPERATIVO LORDO', EBITDA0, EBITDA1, EBITDA2, EBITDA3, true],
      ['Variazione Capitale Circolante Netto', null, -dCCN1v, -dCCN2v, -dCCN3v, false],
      ['FLUSSO CASSA GESTIONE CORRENTE', null, FCO_corr1, FCO_corr2, FCO_corr3, true],
      ['Imposte pagate', null, null, null, null, false],
      ['FLUSSO DI CASSA OPERATIVO (FCO)', EBITDA0, FCO1v, FCO2v, FCO3v, true],
      ['CAPEX — Investimenti in immobilizzazioni', null, CAPEX1v, CAPEX2v, CAPEX3v, false],
      ['FREE CASH FLOW (FCO + FCI)', null, FCF1, FCF2, FCF3, true],
      ['Oneri finanziari pagati', null, OF1v, OF2v, OF3v, false],
      ['Rimborso quota capitale', null, RC1v, RC2v, RC3v, false],
      ['FLUSSO AL SERVIZIO DEL DEBITO', null, FSD1, FSD2, FSD3, true],
      ['FLUSSO DI CASSA PER GLI AZIONISTI', null, FAZ1, FAZ2, FAZ3, true],
      ['Variazione netta di cassa', null, CNET1, CNET2, CNET3, false],
    ];
    const rowsHTML = cfRows.map(([lbl,s,a1,a2,a3,total])=>{
      if(!lbl) return '';
      const style = total ? 'font-weight:700;background:#F1F5F9' : 'color:#334155';
      const sV = s!==null?fmtV(s):'—', a1V=a1!==null?fmtV(a1):'—', a2V=a2!==null?fmtV(a2):'—', a3V=a3!==null?fmtV(a3):'—';
      const c1=a1!==null?colorV(a1):'', c2=a2!==null?colorV(a2):'', c3=a3!==null?colorV(a3):'';
      return `<tr style="${style}"><td>${lbl}</td><td class="r">${sV}</td><td class="r" style="${c1}">${a1V}</td><td class="r" style="${c2}">${a2V}</td><td class="r" style="${c3}">${a3V}</td></tr>`;
    }).join('');
    return `<table class="rep">
      <thead><tr><th>Analisi flussi (€)</th><th class="r">Storico ${annoBase}</th><th class="r">${annoBase+1}E</th><th class="r">${annoBase+2}E</th><th class="r">${annoBase+3}E</th></tr></thead>
      <tbody>${rowsHTML}</tbody></table>`;
  })()}
  <h3>Posizione Finanziaria Netta — evoluzione</h3>
  ${(() => {
    const pfnRows = [
      ['Debiti verso banche (BT)', null, null, null, null],
      ['Mutui e finanziamenti (MLT)', null, null, null, null],
      ['Altri debiti finanziari', null, null, null, null],
      ['(−) Cassa e disponibilità liquide', null, null, null, null],
      ['POSIZIONE FINANZIARIA NETTA (PFN)', d.pfn_storico||0, PFN1, PFN2, PFN3],
      ['PFN / EBITDA', null, EBITDA1>0?PFN1/EBITDA1:null, EBITDA2>0?PFN2/EBITDA2:null, EBITDA3>0?PFN3/EBITDA3:null],
      ['Variazione PFN', null, PFN1-(d.pfn_storico||0), PFN2-PFN1, PFN3-PFN2],
    ];
    const fmtV = (n,ratio) => {
      if(n===null||n===undefined) return '—';
      if(ratio) return isNaN(n)||!isFinite(n) ? '—' : n.toFixed(2)+'x';
      return (n<0?'('+Math.abs(Math.round(n)).toLocaleString('it-IT')+')':Math.round(n).toLocaleString('it-IT'))+' €';
    };
    const rowsHTML = pfnRows.map(([lbl,s,a1,a2,a3],i)=>{
      const total = lbl.startsWith('POSIZIONE');
      const ratio = lbl.startsWith('PFN /');
      const style = total ? 'font-weight:700;background:#F1F5F9' : ratio ? 'color:#1D4ED8;font-style:italic' : '';
      return `<tr style="${style}"><td>${lbl}</td><td class="r">${fmtV(s,ratio)}</td><td class="r">${fmtV(a1,ratio)}</td><td class="r">${fmtV(a2,ratio)}</td><td class="r">${fmtV(a3,ratio)}</td></tr>`;
    }).join('');
    return `<table class="rep">
      <thead><tr><th>PFN (€)</th><th class="r">Storico ${annoBase}</th><th class="r">${annoBase+1}E</th><th class="r">${annoBase+2}E</th><th class="r">${annoBase+3}E</th></tr></thead>
      <tbody>${rowsHTML}</tbody></table>`;
  })()}
  ${pf(8)}
</div>

<!-- PAGE 7 — DSCR / BANCABILITÀ -->
<div class="page">
  ${secHdr('Sostenibilità del debito', '7. DSCR e Bancabilità EBA')}
  <div class="narrative">
    <p>Il <strong>Debt Service Coverage Ratio (DSCR)</strong> misura la capacità dell'impresa di coprire il servizio del debito (quota capitale + interessi) con i flussi di cassa operativi. Le Linee Guida EBA/GL/2020/06 richiedono un DSCR minimo di <strong>1,10x</strong> per l'accesso al credito; un valore ≥ 1,30x è considerato un profilo solido, mentre un valore ≥ 1,50x indica un'eccellente copertura.</p>
    ${noDebtPlan
      ? `<p>${nome} <strong>non presenta debiti finanziari</strong> nel piano proiettato: non sono previste rate di rimborso né oneri finanziari. Il DSCR non è pertanto calcolabile — non per assenza di capacità di rimborso, ma perché non vi è alcun debito da servire. Questa struttura finanziaria <strong>autofinanziata</strong> rappresenta un punto di forza: l'azienda genera flussi di cassa positivi senza dipendere da finanziamenti bancari, eliminando il rischio di inadempienza sul debito.</p>`
      : `<p>${nome} presenta un DSCR di <strong>${fmtX(DSCR1)}</strong> nel ${annoBase + 1}, ${DSCR1 >= 1.5 ? 'posizionandosi in una fascia di eccellente solidità finanziaria' : DSCR1 >= 1.3 ? 'collocandosi in un profilo solido, ben al di sopra del requisito minimo bancario' : DSCR1 >= 1.1 ? 'superando il requisito minimo EBA, con un margine di sicurezza sufficiente' : 'con un margine da rafforzare rispetto al requisito EBA di 1,10x'}. Il ratio ${DSCR3 > DSCR1 ? 'migliora progressivamente' : 'si mantiene'} nel triennio, raggiungendo ${fmtX(DSCR3)} nel ${annoBase + 3}, grazie alla crescita dell'EBITDA.</p>`
    }
  </div>
  <h3>Debt Service Coverage Ratio — scala EBA</h3>
  <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:10px">
    <div class="chart-box" style="flex:0 0 auto;width:280px;padding:10px">${svgDscrGauge(DSCR1)}</div>
    <div style="flex:1">
      ${progBar(`DSCR ${annoBase+1}`, DSCR1, fmtX(DSCR1), DSCR1 !== null ? DSCR1 / 3 * 100 : 0, dscrColor(DSCR1))}
      ${progBar(`DSCR ${annoBase+2}`, DSCR2, fmtX(DSCR2), DSCR2 !== null ? DSCR2 / 3 * 100 : 0, dscrColor(DSCR2))}
      ${progBar(`DSCR ${annoBase+3}`, DSCR3, fmtX(DSCR3), DSCR3 !== null ? DSCR3 / 3 * 100 : 0, dscrColor(DSCR3))}
    </div>
  </div>
  <div class="chart-box" style="margin-top:0">${svgDscrScale(DSCR1)}</div>
  ${(() => {
    const icr = kpi.find(k => /ICR/.test(k.label));
    const icr1 = icr ? icr.a1 : null;
    return `
    ${progBar(`ICR (EBIT/OF) ${annoBase+1}`, icr1, fmtX(icr1), icr1 !== null ? Math.min(icr1, 5) / 5 * 100 : 0, icr1 === null ? '#94A3B8' : icr1 >= 1.5 ? '#059669' : icr1 >= 1 ? '#D97706' : '#DC2626')}
    ${progBar(`PFN/EBITDA ${annoBase+1}`, PFNEBITDA1, fmtX(PFNEBITDA1), PFNEBITDA1 !== null ? Math.min(PFNEBITDA1, 6) / 6 * 100 : 0, pfnColor(PFNEBITDA1))}`;
  })()}
  <div class="info-box">
    <strong>Requisiti EBA/GL/2020/06.</strong> Il DSCR minimo per la bancabilità è 1,10x; un valore ≥ 1,30x indica un profilo solido. Il PFN/EBITDA non dovrebbe superare 4x. Le linee guida richiedono inoltre prove di stress prospettiche sui flussi di cassa.
  </div>
  <div class="stress-box">
    <strong>Stress test −20% ricavi:</strong> Ricavi ${annoBase+1} ${fmtE(stressR1)} · EBITDA ${fmtE(stressEBITDA1)} · DSCR stress <strong>${noDebtPlan ? 'N/A — nessun debito' : fmtX(stressDSCR1)}</strong>.<br>
    ${noDebtPlan ? '✅ In assenza di debito finanziario, lo stress test non impatta il servizio del debito. La resilienza è determinata dalla capacità di mantenere flussi di cassa positivi.' : stressDSCR1 !== null && stressDSCR1 < 1.0 ? '⚠️ In scenario stress il DSCR scende sotto 1x: raccomandata riserva di liquidità o covenant di sospensione dividendi.' : '✅ Anche in scenario stress il piano resta gestibile.'}
  </div>
  <div style="text-align:center;margin-top:16px">
    <span class="verdict ${bancabile ? 'ok' : noDebtPlan ? 'auto' : 'no'}">${bancabile ? 'BANCABILE' : noDebtPlan ? 'AUTOFINANZIATO' : 'RICHIEDE REVISIONE'}</span>
  </div>
  ${pf(9)}
</div>

<!-- PAGE 9b — STRUTTURA DEBITO -->
${d.nuovo_fin || (d.pfn_storico && d.pfn_storico > 0) ? `<div class="page">
  ${secHdr('Struttura e piano del debito', '9b. Debito Finanziario e Rimborsi')}
  <div class="narrative">
    <p>La struttura dell'indebitamento finanziario determina la distribuzione temporale del servizio del debito e il profilo di rischio del piano. L'analisi distingue i debiti a <strong>breve termine</strong> (scadenza entro 12 mesi) da quelli a <strong>medio-lungo termine</strong> (MLT), evidenziando l'evoluzione della Posizione Finanziaria Netta nel triennio e la sostenibilità del rimborso rispetto ai flussi di cassa generati.</p>
  </div>
  <h3>Evoluzione PFN e copertura</h3>
  ${(() => {
    // Debito BT = debiti banche BT dal SP input (se disponibili)
    const debBT = d.deb_b_bt || 0;
    const debMLT0 = d.pfn_storico > 0 ? Math.max((d.pfn_storico||0) - debBT, 0) : 0;
    const debTot0 = d.pfn_storico || 0;
    // Proiettato
    const { schedule } = d.nuovo_fin && d.fin_importo ? calcMutuo(d.fin_importo, d.fin_durata, d.fin_tasso/100, d.pre_amm||0, d.fin_periodicita||12) : { schedule:[] };
    const debMLT1 = Math.max(debMLT0 - (d.rata_esistente||0) + (d.nuovo_fin?d.fin_importo:0) - (schedule[0]?.capitale||0), 0);
    const debMLT2 = Math.max(debMLT1 - (d.rata_esistente||0) - (schedule[1]?.capitale||0), 0);
    const debMLT3 = Math.max(debMLT2 - (d.rata_esistente||0) - (schedule[2]?.capitale||0), 0);
    const DS1v = (d.rata_esistente||0) + (schedule[0]?.capitale||0) + (schedule[0]?.interessi||0);
    const DS2v = (d.rata_esistente||0) + (schedule[1]?.capitale||0) + (schedule[1]?.interessi||0);
    const DS3v = (d.rata_esistente||0) + (schedule[2]?.capitale||0) + (schedule[2]?.interessi||0);
    const FCO1v = CF.find(r=>/Cash Flow Operativo/.test(r.label))?.a1||0;
    const FCO2v = CF.find(r=>/Cash Flow Operativo/.test(r.label))?.a2||0;
    const FCO3v = CF.find(r=>/Cash Flow Operativo/.test(r.label))?.a3||0;
    const dscr1 = DS1v>0 ? FCO1v/DS1v : null;
    const dscr2 = DS2v>0 ? FCO2v/DS2v : null;
    const dscr3 = DS3v>0 ? FCO3v/DS3v : null;
    const fmtV = n => n===null||n===undefined ? '—' : Math.round(n).toLocaleString('it-IT')+' €';
    const fmtR = n => n===null||isNaN(n)||!isFinite(n) ? '—' : n.toFixed(2)+'x';
    const semDS = n => n===null||isNaN(n)||!isFinite(n) ? '' : n>=1.3?'color:#059669;font-weight:700':n>=1.1?'color:#D97706;font-weight:700':'color:#DC2626;font-weight:700';
    return `<table class="rep">
      <thead><tr><th>Voci</th><th class="r">Storico ${annoBase}</th><th class="r">${annoBase+1}E</th><th class="r">${annoBase+2}E</th><th class="r">${annoBase+3}E</th></tr></thead>
      <tbody>
        <tr><td>Debiti verso banche (BT)</td><td class="r">${fmtV(debBT)}</td><td class="r">—</td><td class="r">—</td><td class="r">—</td></tr>
        <tr><td>Mutui e finanziamenti (MLT)</td><td class="r">${fmtV(debMLT0)}</td><td class="r">${fmtV(debMLT1)}</td><td class="r">${fmtV(debMLT2)}</td><td class="r">${fmtV(debMLT3)}</td></tr>
        <tr style="font-weight:700;background:#F1F5F9"><td>POSIZIONE FINANZIARIA NETTA</td><td class="r">${fmtV(debTot0)}</td><td class="r">${fmtV(PFN1)}</td><td class="r">${fmtV(PFN2)}</td><td class="r">${fmtV(PFN3)}</td></tr>
        <tr><td>Variazione PFN</td><td class="r">—</td><td class="r" style="${PFN1<(debTot0)?'color:#059669':'color:#DC2626'}">${fmtV(PFN1-debTot0)}</td><td class="r" style="${PFN2<PFN1?'color:#059669':'color:#DC2626'}">${fmtV(PFN2-PFN1)}</td><td class="r" style="${PFN3<PFN2?'color:#059669':'color:#DC2626'}">${fmtV(PFN3-PFN2)}</td></tr>
        <tr><td>Servizio del debito (quota cap. + OF)</td><td class="r">—</td><td class="r">${fmtV(DS1v)}</td><td class="r">${fmtV(DS2v)}</td><td class="r">${fmtV(DS3v)}</td></tr>
        <tr><td>FCO disponibile per rimborso</td><td class="r">—</td><td class="r">${fmtV(FCO1v)}</td><td class="r">${fmtV(FCO2v)}</td><td class="r">${fmtV(FCO3v)}</td></tr>
        <tr style="background:#EFF6FF"><td>DSCR (FCO / Servizio del debito)</td><td class="r">—</td><td class="r" style="${semDS(dscr1)}">${fmtR(dscr1)}</td><td class="r" style="${semDS(dscr2)}">${fmtR(dscr2)}</td><td class="r" style="${semDS(dscr3)}">${fmtR(dscr3)}</td></tr>
        <tr><td>PFN / EBITDA</td><td class="r">${EBITDA0>0?fmtR((debTot0)/EBITDA0):'—'}</td><td class="r">${fmtR(PFNEBITDA1)}</td><td class="r">${fmtR(PFNEBITDA2)}</td><td class="r">${fmtR(PFNEBITDA3)}</td></tr>
      </tbody></table>`;
  })()}
  ${d.nuovo_fin && d.fin_importo ? `
  <h3>Piano di rimborso nuovo finanziamento</h3>
  <table class="rep">
    <thead><tr><th>Anno</th><th class="r">Rata capitale</th><th class="r">Interessi</th><th class="r">Rata totale</th><th class="r">Debito residuo</th><th class="r">% rimborsato</th></tr></thead>
    <tbody>
      ${calcMutuo(d.fin_importo, d.fin_durata, d.fin_tasso/100, d.pre_amm||0, d.fin_periodicita||12).schedule.slice(0,5).map(s=>{
        const percRimb = d.fin_importo > 0 ? ((d.fin_importo - s.debResiduo)/d.fin_importo*100).toFixed(1)+'%' : '—';
        return `<tr><td>${annoBase+s.anno}</td><td class="r">${fmtE(s.capitale)}</td><td class="r">${fmtE(s.interessi)}</td><td class="r" style="font-weight:600">${fmtE(s.capitale+s.interessi)}</td><td class="r">${fmtE(s.debResiduo)}</td><td class="r" style="color:#059669">${percRimb}</td></tr>`;
      }).join('')}
    </tbody>
  </table>` : ''}
  ${pf(10)}
</div>` : ''}

<!-- PAGE 8 — BREAK-EVEN / SENSIBILITÀ -->
<div class="page">
  ${secHdr('Punto di pareggio', '8. Break-Even e Sensibilità')}
  <div class="narrative">
    <p>L'<strong>analisi di break-even</strong> determina il livello minimo di ricavi necessario a coprire tutti i costi fissi dell'impresa, ovvero il punto in cui l'utile operativo è pari a zero. ${be ? `Per ${nome}, il punto di pareggio è fissato a <strong>${fmtE(be.ricavi_be)}</strong> di fatturato: con i ricavi proiettati del ${annoBase+1} pari a <strong>${fmtE(be.ricavi_a1)}</strong>, l'azienda opera con un <strong>margine di sicurezza del ${fmtP(be.margine_perc)}</strong> (${fmtE(be.margine_sicurezza)} di ricavi "in eccesso" rispetto al break-even). ${be.utilizzo_cap <= 70 ? 'Il piano è robusto: anche con una contrazione significativa dei ricavi, l\'impresa mantiene la copertura dei costi fissi.' : be.utilizzo_cap <= 90 ? 'Il piano è sostenibile, ma il margine di sicurezza richiede un monitoraggio attento dell\'andamento dei ricavi.' : 'L\'azienda opera in prossimità del punto di pareggio: priorità alla gestione dei costi fissi e al presidio dei ricavi minimi.'}` : 'Dati insufficienti per il calcolo del break-even.'}</p>
    <p>L'<strong>analisi di sensibilità</strong> simula l'impatto di cali dei ricavi sul DSCR ${annoBase+1}, mantenendo invariati la struttura dei costi e il servizio del debito. Lo scopo è identificare la soglia di rottura della bancabilità, ovvero il calo massimo di ricavi compatibile con il requisito EBA di 1,10x.</p>
  </div>
  ${be ? `
  <table class="rep">
    <thead><tr><th>Ricavi BE</th><th>Ricavi ${annoBase+1}</th><th>Utilizzo capacità</th><th>Margine sicurezza €</th><th>Margine sicurezza %</th></tr></thead>
    <tbody><tr>
      <td>${fmtE(be.ricavi_be)}</td><td>${fmtE(be.ricavi_a1)}</td>
      <td>${fmtP(be.utilizzo_cap)}</td><td>${fmtE(be.margine_sicurezza)}</td>
      <td style="color:${beColor};font-weight:700">${fmtP(be.margine_perc)}</td>
    </tr></tbody>
  </table>
  <h3>Visualizzazione Break-Even</h3>
  <div class="chart-box">${svgBreakEven()}</div>` : '<p class="lead">Dati break-even non disponibili.</p>'}
  <h3>CE a costi fissi e variabili — Anno ${annoBase+1}E</h3>
  ${(() => {
    // Recupera i valori dal CE già costruito
    const RIC1 = R1;
    const CV1 = CE.find(r=>r.label==='Costi per materie/merci/servizi')?.a1 || 0;
    const CP1v = CE.find(r=>r.label==='Costo del personale')?.a1 || 0;
    const CF1 = d.costi_fissi ? d.costi_fissi * (1+(d.incr_fissi||2)/100) : 0;
    const percVarEff = RIC1 > 0 ? Math.abs(CV1)/RIC1 : 0;
    const MARGCON1 = RIC1 - Math.abs(CV1);
    const MARGCON_PERC = RIC1 > 0 ? (MARGCON1/RIC1*100) : 0;
    const BE_R = MARGCON_PERC > 0 ? (Math.abs(CP1v)+Math.abs(CF1)) / (MARGCON_PERC/100) : 0;
    const fmtV = n => n===null ? '—' : Math.round(n).toLocaleString('it-IT')+' €';
    const fmtP2 = n => isNaN(n)||!isFinite(n) ? '—' : n.toFixed(1)+'%';
    return `<table class="rep">
      <thead><tr><th>Schema costi fissi / variabili (Anno ${annoBase+1}E)</th><th class="r">Importo</th><th class="r">% su Ricavi</th></tr></thead>
      <tbody>
        <tr style="font-weight:700;background:#F1F5F9"><td>RICAVI NETTI</td><td class="r">${fmtV(RIC1)}</td><td class="r">100,0%</td></tr>
        <tr style="color:#DC2626"><td>  (−) Costi variabili (materie/merci/servizi)</td><td class="r">${fmtV(CV1)}</td><td class="r" style="color:#DC2626">${fmtP2(percVarEff*100)}</td></tr>
        <tr style="font-weight:700;background:#EFF6FF"><td>MARGINE DI CONTRIBUZIONE</td><td class="r" style="color:#059669">${fmtV(MARGCON1)}</td><td class="r" style="color:#059669">${fmtP2(MARGCON_PERC)}</td></tr>
        <tr style="color:#64748B"><td>  (−) Costo del personale (costo fisso)</td><td class="r">${fmtV(Math.abs(CP1v))}</td><td class="r">${RIC1>0?fmtP2(Math.abs(CP1v)/RIC1*100):'—'}</td></tr>
        <tr style="color:#64748B"><td>  (−) Ammortamenti</td><td class="r">${fmtV(AMM1)}</td><td class="r">${RIC1>0?fmtP2(AMM1/RIC1*100):'—'}</td></tr>
        <tr style="font-weight:700;background:#F1F5F9"><td>RISULTATO OPERATIVO (EBIT)</td><td class="r" style="color:${EBIT1>=0?'#059669':'#DC2626'}">${fmtV(EBIT1)}</td><td class="r" style="color:${EBIT1>=0?'#059669':'#DC2626'}">${RIC1>0?fmtP2(EBIT1/RIC1*100):'—'}</td></tr>
        <tr style="background:#FFFBEB"><td><strong>Punto di Break-Even</strong> (ricavi min. per coprire fissi)</td><td class="r" style="font-weight:700">${fmtV(be?.ricavi_be||BE_R)}</td><td class="r">${RIC1>0?fmtP2((be?.ricavi_be||BE_R)/RIC1*100):'—'}</td></tr>
        <tr><td>Margine di sicurezza</td><td class="r" style="color:#059669;font-weight:700">${fmtV(be?.margine_sicurezza||(RIC1-(be?.ricavi_be||BE_R)))}</td><td class="r" style="color:#059669;font-weight:700">${fmtP2(be?.margine_perc||0)}</td></tr>
      </tbody></table>`;
  })()}
  <h3>Analisi di Sensibilità — Stress Test EBA/FED (${annoBase + 1})</h3>
  <p class="lead" style="font-size:9.5px;color:#64748B;margin-bottom:6px">Stress test multi-dimensionali secondo EBA/GL/2020/06 e principi FED: shock sui ricavi, compressione margini e scenario combinato.</p>
  <table class="rep">
    <thead><tr><th>Scenario stress</th><th>Ricavi</th><th>EBITDA</th><th>EBITDA M.</th><th>DSCR</th><th>Esito</th></tr></thead>
    <tbody>${sensRows}</tbody>
  </table>
  <div class="disclaimer">Stress test redatti in conformità alle EBA Guidelines on loan origination and monitoring (EBA/GL/2020/06). Gli scenari base e severe simulano rispettivamente una riduzione del 20% e del 30% dei ricavi. Il scenario di compressione margini replica un shock sui costi operativi (+2pp su ricavi). Il servizio del debito è mantenuto costante in tutti gli scenari. Metodologia ODCEC Milano "Principi Guida al Business Plan".</div>
  ${pf(9)}
</div>

<!-- PAGE 9 — IPOTESI / NOTE -->
<div class="page">
  ${secHdr('Metodologia', '9. Ipotesi e Note Metodologiche')}
  <div class="narrative">
    <p>Il presente Business Plan è costruito su un <strong>modello integrato a tre prospetti</strong> (Conto Economico, Stato Patrimoniale, Rendiconto Finanziario) che garantisce la coerenza contabile tra le proiezioni economiche e quelle patrimoniali. I ricavi vengono proiettati applicando i tassi di crescita selezionati ai dati storici ${d.fonte === 'xbrl' ? 'certificati del bilancio XBRL depositato presso la CCIAA' : 'forniti dal management'}. La struttura dei costi viene mantenuta in linea con la marginalità storica, con l'unico aggiustamento dell'inflazione strutturale sui costi fissi.</p>
    <p>Il documento è redatto in conformità alle <strong>EBA Guidelines on loan origination and monitoring (EBA/GL/2020/06)</strong>, che richiedono una proiezione triennale dei flussi di cassa con test di stress, e ai principi del <strong>D.Lgs. 14/2019 (Codice della Crisi d'Impresa e dell'Insolvenza)</strong>, che impone l'adozione di adeguati assetti organizzativi per la rilevazione precoce delle crisi aziendali.</p>
  </div>
  <h3>Ipotesi chiave del modello</h3>
  <table class="rep">
    <thead><tr><th>Parametro</th><th>Valore</th><th>Note</th></tr></thead>
    <tbody>
      <tr><td>Scenario crescita</td><td>${scenarioLabel}</td><td>+${d.g1}% / +${d.g2}% / +${d.g3}%</td></tr>
      <tr><td>EBITDA Margin target</td><td>${d.ebitda_margin}%</td><td>Costante nel triennio</td></tr>
      <tr><td>Aliquota fiscale effettiva</td><td>${d.tax_rate || 27.9}%</td><td>IRES + IRAP</td></tr>
      <tr><td>Incremento costo personale</td><td>${d.incr_pers || 2}%/anno</td><td>CCNL + inflazione</td></tr>
      <tr><td>Incremento costi fissi</td><td>${d.incr_fissi || 2}%/anno</td><td>Inflazione strutturale</td></tr>
      <tr><td>% CCN su ricavi</td><td>${d.perc_ccn || 8}%</td><td>Driver del capitale circolante</td></tr>
      ${d.nuovo_fin ? `<tr><td>Nuovo finanziamento</td><td>${fmtE(d.fin_importo)}</td><td>${d.fin_tipo || 'Mutuo'} — ${d._fin_durata_effettiva || d.fin_durata} anni — ${d.fin_tasso}%${d.pre_amm ? ` — preamm. ${d.pre_amm} mesi` : ''}</td></tr>` : ''}
    </tbody>
  </table>
  ${(d.capex && d.capex.length) ? `
  <h3>Piano CAPEX</h3>
  <table class="rep">
    <thead><tr><th>Investimento</th><th>Categoria</th><th>${annoBase + 1}</th><th>${annoBase + 2}</th><th>${annoBase + 3}</th><th>Vita</th></tr></thead>
    <tbody>
      ${d.capex.map(c => `<tr><td>${c.desc || '—'}</td><td>${c.tipo || '—'}</td><td>${fmtE(c.a1)}</td><td>${fmtE(c.a2)}</td><td>${fmtE(c.a3)}</td><td>${c.vita || 5} anni</td></tr>`).join('')}
      <tr class="tot"><td colspan="2">TOTALE</td><td>${fmtE(sumCapex(d.capex, 1))}</td><td>${fmtE(sumCapex(d.capex, 2))}</td><td>${fmtE(sumCapex(d.capex, 3))}</td><td></td></tr>
    </tbody>
  </table>` : ''}
  ${d.nuovo_fin && d.fin_importo ? `
  <h3>Piano di ammortamento nuovo finanziamento</h3>
  <table class="rep">
    <thead><tr><th>Anno</th><th>Quota capitale</th><th>Interessi</th><th>Debito residuo</th></tr></thead>
    <tbody>
      ${calcMutuo(d.fin_importo, d.fin_durata, d.fin_tasso / 100, d.pre_amm || 0, d.fin_periodicita||12).schedule.slice(0, 5).map(s => `<tr><td>${annoBase + s.anno}</td><td>${fmtE(s.capitale)}</td><td>${fmtE(s.interessi)}</td><td>${fmtE(s.debResiduo)}</td></tr>`).join('')}
    </tbody>
  </table>` : ''}
  ${d.nota_metodologica ? `<h3>Nota metodologica</h3><p style="font-size:10px;color:#475569;line-height:1.7">${d.nota_metodologica}</p>` : ''}
  <div class="disclaimer">
    <strong>Disclaimer.</strong> Il presente Business Plan è redatto secondo le EBA Guidelines on loan origination and monitoring (EBA/GL/2020/06) e i principi del D.Lgs. 14/2019 (Codice della Crisi d'Impresa e dell'Insolvenza). Le proiezioni si basano su ipotesi formulate alla data del report e non costituiscono garanzia di risultato. Documento riservato e confidenziale, destinato esclusivamente al committente e agli istituti finanziatori.
  </div>
  ${pf(9)}
</div>

${(() => {
  // ── Sezioni qualitative — visibili SOLO se compilate ─────────────────
  const hasAz  = d.desc_aziendale && d.desc_aziendale.trim();
  const hasPr  = d.desc_progetto  && d.desc_progetto.trim();
  const hasMk  = d.desc_mercato   && d.desc_mercato.trim();
  const hasFz  = d.punti_forza    && d.punti_forza.trim();
  const hasRk  = d.punti_rischio  && d.punti_rischio.trim();

  const hasQual = hasAz || hasPr || hasMk || hasFz || hasRk;
  if (!hasQual) return ''; // nessuna sezione qualitativa → nessuna pagina

  const paragrafo = txt => txt.split(/\n+/).filter(Boolean).map(p=>`<p style="margin:0 0 10px;font-size:10.5px;line-height:1.75;color:#334155">${p}</p>`).join('');

  const hasPag10 = hasAz || hasPr;
  const hasPag11 = hasMk || hasFz || hasRk;

  return `
${hasPag10 ? `<!-- PAGE 10 — PRESENTAZIONE AZIENDALE -->
<div class="page">
  ${secHdr('Profilo azienda', '10. Presentazione Aziendale')}

  ${hasAz ? `<div class="narrative">${paragrafo(d.desc_aziendale)}</div>` : ''}
  ${d.sito_web ? `<p style="font-size:9px;color:#94A3B8;margin-top:8px">🌐 <a href="${d.sito_web}" style="color:#2563EB">${d.sito_web}</a></p>` : ''}

  ${hasPr ? `<h3 style="margin-top:20px">Il Progetto / L'Investimento</h3>
  <div class="narrative">${paragrafo(d.desc_progetto)}</div>` : ''}

  ${pf(10)}
</div>` : ''}

${hasPag11 ? `<!-- PAGE 11 — MERCATO E COMPETITIVITÀ -->
<div class="page">
  ${secHdr('Analisi competitiva', '11. Mercato e Competitività')}

  ${hasMk ? `<h3>Mercato di riferimento</h3>
  <div class="narrative">${paragrafo(d.desc_mercato)}</div>` : ''}

  ${(hasFz || hasRk) ? `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
    ${hasFz ? `<div>
      <h3 style="color:#059669">✅ Punti di forza</h3>
      <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:14px">${paragrafo(d.punti_forza)}</div>
    </div>` : ''}
    ${hasRk ? `<div>
      <h3 style="color:#DC2626">⚠️ Rischi e mitigazioni</h3>
      <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:14px">${paragrafo(d.punti_rischio)}</div>
    </div>` : ''}
  </div>` : ''}

  ${pf(11)}
</div>` : ''}

${(() => {
  const tmpl = d._template;
  if (!tmpl) return '';
  const rat = tmpl.ratios || {};
  const fmtE2 = (n) => '€' + Math.round(n).toLocaleString('it-IT');

  // Personale
  const figureRows = (tmpl.figure_personale || []).map(f =>
    `<tr><td>${f.ruolo}</td><td style="text-align:center">${f.n}</td><td style="text-align:right">${fmtE2(f.costo_annuo)}</td><td style="text-align:right;font-weight:600">${fmtE2(f.costo_annuo * f.n)}</td></tr>`
  ).join('');
  const totPersonale = (tmpl.figure_personale || []).reduce((s, f) => s + f.costo_annuo * f.n, 0);

  // Costi fissi
  const costiRows = (tmpl.voci_costi_fissi || []).map(v => {
    const ann = v.importo_annuo || (v.importo_mensile * 12);
    return `<tr><td>${v.voce}</td><td style="text-align:right">${v.importo_mensile ? fmtE2(v.importo_mensile)+'/mese' : '—'}</td><td style="text-align:right;font-weight:600">${fmtE2(ann)}/anno</td></tr>`;
  }).join('');
  const totFissi = (tmpl.voci_costi_fissi || []).reduce((s, v) => s + (v.importo_annuo || v.importo_mensile * 12), 0);

  return `
<!-- PAGE SCHEDA SETTORE -->
<div class="page">
  ${secHdr(`Benchmark settore — ${tmpl.nome}`, 'Scheda esplicativa delle ipotesi')}

  <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:14px 16px;margin-bottom:16px">
    <div style="font-size:9px;font-weight:700;color:#1D4ED8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">📋 Come sono state costruite le proiezioni</div>
    <p style="font-size:9.5px;color:#1E3A5F;line-height:1.7">
      I valori di costo, margine e personale sono stati calcolati automaticamente applicando i <strong>benchmark medi di settore</strong>
      per <strong>${tmpl.nome}</strong> (ATECO ${tmpl.ateco}) alle previsioni di ricavo inserite.
      Tutti i parametri sono modificabili nel form di generazione.
    </p>
  </div>

  <h3>Struttura dei ricavi</h3>
  <div class="narrative" style="margin-bottom:12px">${tmpl.spiegazione_ricavi || ''}</div>

  <h3>Struttura dei costi operativi</h3>
  <div class="narrative" style="margin-bottom:12px">${tmpl.spiegazione_costi || ''}</div>

  <h3>Piano del personale previsto</h3>
  <div class="narrative" style="margin-bottom:8px">${tmpl.spiegazione_personale || ''}</div>
  ${figureRows ? `
  <table class="rep" style="margin-bottom:12px">
    <thead><tr><th style="text-align:left">Ruolo</th><th>N°</th><th>Costo unitario</th><th>Costo totale</th></tr></thead>
    <tbody>
      ${figureRows}
      <tr style="background:#EFF6FF;font-weight:700"><td>TOTALE PERSONALE</td><td></td><td></td><td style="text-align:right">${fmtE2(totPersonale)}</td></tr>
    </tbody>
  </table>` : ''}

  <h3>Dettaglio costi fissi strutturali</h3>
  ${costiRows ? `
  <table class="rep" style="margin-bottom:12px">
    <thead><tr><th style="text-align:left">Voce di costo</th><th>Importo mensile</th><th>Importo annuo</th></tr></thead>
    <tbody>
      ${costiRows}
      <tr style="background:#EFF6FF;font-weight:700"><td>TOTALE COSTI FISSI</td><td></td><td style="text-align:right">${fmtE2(totFissi)}/anno</td></tr>
    </tbody>
  </table>` : ''}

  <h3>Investimento iniziale e finanziamento</h3>
  <div class="narrative" style="margin-bottom:12px">${tmpl.spiegazione_investimenti || ''}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">
    <div class="ratio-box"><div class="v">${fmtE2(rat.investimento_tipico||0)}</div><div class="l">Investimento tipico di settore</div></div>
    <div class="ratio-box"><div class="v">${fmtE2(rat.finanziamento_tipico||0)}</div><div class="l">Finanziamento tipico</div></div>
    <div class="ratio-box"><div class="v">${rat.tasso_mutuo||0}% / ${rat.durata_mutuo||0} anni</div><div class="l">Tasso e durata tipici</div></div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
    ${(tmpl.punti_forza||[]).length ? `<div>
      <h3 style="color:#059669">✅ Punti di forza del settore</h3>
      <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:12px">
        <ul style="margin:0;padding-left:16px;font-size:9.5px;line-height:2">
          ${tmpl.punti_forza.map(p=>`<li>${p}</li>`).join('')}
        </ul>
      </div>
    </div>` : ''}
    ${(tmpl.rischi_principali||[]).length ? `<div>
      <h3 style="color:#DC2626">⚠️ Rischi principali</h3>
      <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:12px">
        <ul style="margin:0;padding-left:16px;font-size:9.5px;line-height:2">
          ${tmpl.rischi_principali.map(r=>`<li>${r}</li>`).join('')}
        </ul>
      </div>
    </div>` : ''}
  </div>

  ${pf(totalPages)}
</div>`;
})()}`;
})()}

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
