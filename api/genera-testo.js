import Anthropic from '@anthropic-ai/sdk';

// Mappa macro-settori ATECO 2007
const ATECO_MACRO = {
  'A': 'Agricoltura, silvicoltura e pesca',
  'B': 'Estrazione di minerali',
  'C': 'Manifatturiero / Industria',
  'D': 'Energia elettrica, gas e vapore',
  'E': 'Gestione acqua, rifiuti e bonifiche',
  'F': 'Costruzioni e lavori pubblici',
  'G': 'Commercio all\'ingrosso e al dettaglio',
  'H': 'Trasporto e magazzinaggio',
  'I': 'Alloggio e ristorazione',
  'J': 'Informazione e comunicazione (ICT)',
  'K': 'Attività finanziarie e assicurative',
  'L': 'Attività immobiliari',
  'M': 'Attività professionali, scientifiche e tecniche',
  'N': 'Noleggio, agenzie di viaggio, servizi alle imprese',
  'P': 'Istruzione e formazione',
  'Q': 'Sanità e assistenza sociale',
  'R': 'Attività artistiche e di intrattenimento',
  'S': 'Altre attività di servizi',
};

function getMacroSettore(codice) {
  if (!codice) return null;
  const letter = codice.trim().toUpperCase().charAt(0);
  return ATECO_MACRO[letter] || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { tipo, nome, settore, sito_web, codice_ateco, dati_finanziari, prompt: customPrompt } = req.body || {};

  const macroSettore = getMacroSettore(codice_ateco);
  const settoreDescrizione = settore || macroSettore || 'non specificato';

  // Dati finanziari opzionali per arricchire il contesto
  const contestoFinanziario = dati_finanziari ? `
Dati finanziari storici dell'azienda:
- Ricavi: ${dati_finanziari.ricavi ? '€ ' + Number(dati_finanziari.ricavi).toLocaleString('it-IT') : 'n.d.'}
- EBITDA: ${dati_finanziari.ebitda ? '€ ' + Number(dati_finanziari.ebitda).toLocaleString('it-IT') : 'n.d.'}
- Dipendenti: ${dati_finanziari.n_dip || 'n.d.'}
- PFN: ${dati_finanziari.pfn ? '€ ' + Number(dati_finanziari.pfn).toLocaleString('it-IT') : 'n.d.'}
` : '';

  const prompts = {
    company: `Sei un consulente aziendale senior specializzato in presentazioni per istituti di credito italiani (banche, Mediocredito, SACE, MCC).

Scrivi una presentazione professionale e scorrevole dell'azienda "${nome}" operante nel settore "${settoreDescrizione}"${sito_web ? ` (sito: ${sito_web})` : ''}.
${contestoFinanziario}

Struttura il testo in 4 paragrafi distinti, senza elenchi puntati:
1. **Profilo e storia**: presentazione dell'azienda, anno di fondazione presumibile, attività core, posizionamento nel settore
2. **Offerta e mercato**: prodotti/servizi principali, segmenti di clientela serviti, aree geografiche di operatività
3. **Punti di forza e competitività**: elementi differenzianti rispetto alla concorrenza, vantaggi competitivi, know-how
4. **Governance e prospettive**: struttura organizzativa, management, visione strategica per il triennio

Tono: formale, autorevole, orientato alla lettura bancaria. Circa 250-300 parole totali. Usa lo stile di un information memorandum per una banca italiana.`,

    progetto: `Sei un consulente aziendale specializzato in business plan per istituti di credito italiani (EBA/GL/2020/06).

Scrivi la sezione "Il Progetto / L'Investimento" per il business plan dell'azienda "${nome}" (settore: ${settoreDescrizione}).
${contestoFinanziario}

Struttura in 3-4 paragrafi, senza elenchi puntati:
1. **Obiettivo strategico**: cosa si vuole raggiungere nel triennio, la logica imprenditoriale
2. **Piano operativo**: azioni concrete previste (investimenti, nuovi mercati, ampliamento gamma, efficienza operativa)
3. **Piano di investimento**: natura degli investimenti previsti, modalità di finanziamento, timeline
4. **Benefici attesi**: impatto quantitativo su ricavi, margini e occupazione; sostenibilità del piano

Tono: concreto, professionale, credibile per una banca. Circa 250 parole. Non usare formule generiche — sii specifico sul settore "${settoreDescrizione}".`,

    mercato: codice_ateco ? `Sei un analista di mercato senior specializzato nell'economia italiana, con profonda conoscenza della tassonomia ATECO 2007 e dei mercati settoriali italiani ed europei.

Stai redigendo la sezione "Mercato di Riferimento e Analisi Competitiva" per un business plan bancario dell'azienda "${nome}".

**Codice ATECO: ${codice_ateco}** — Settore: ${settoreDescrizione}${macroSettore ? ` (macro-categoria: ${macroSettore})` : ''}

Scrivi un'analisi di mercato approfondita e aggiornata in 4 paragrafi, senza elenchi puntati:

1. **Dimensione e struttura del mercato**: dimensione del mercato italiano (e europeo se rilevante) per questo specifico codice ATECO, numero di imprese attive, fatturato aggregato del settore, concentrazione (frammentato vs. oligopolio). Usa dati ISTAT, CERVED, o fonti settoriali italiane note.

2. **Trend e dinamiche recenti**: crescita del settore negli ultimi 3 anni, impatto di fattori macro (PNRR, transizione green, digitale, inflazione, reshoring), opportunità emergenti specifiche per questo codice ATECO.

3. **Contesto competitivo**: struttura della concorrenza in Italia per questo settore, barriere all'entrata, dinamiche di pricing, principali gruppi/player nazionali e internazionali presenti nel mercato italiano.

4. **Posizionamento e outlook**: come si posiziona tipicamente un'azienda come "${nome}" in questo mercato, opportunità di crescita per il triennio 2025-2027, rischi settoriali principali (normativa, commodities, domanda, competizione) e come mitigarli.

Sii specifico sul codice ATECO ${codice_ateco} — non scrivere analisi generiche. Utilizza la tua conoscenza dei mercati italiani per fornire dati e tendenze concrete. Tono professionale da analisi di settore bancaria. Circa 350-400 parole.`
    : `Sei un analista di mercato specializzato nei mercati italiani.

Scrivi la sezione "Mercato di Riferimento" per un business plan dell'azienda "${nome}" nel settore "${settoreDescrizione}".

Struttura in 3 paragrafi senza elenchi puntati:
1. Dimensione e trend del mercato italiano/europeo
2. Dinamiche competitive e posizionamento
3. Opportunità e rischi di settore per il triennio

Tono formale e orientato alla lettura bancaria. Circa 250 parole.`,
  };

  const systemPrompt = prompts[tipo] || customPrompt;
  if (!systemPrompt) return res.status(400).json({ error: 'Parametri mancanti' });

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Usa opus per analisi mercato ATECO (più accurata), haiku per testi brevi
    const useOpus = tipo === 'mercato' && codice_ateco;
    const model = useOpus ? 'claude-opus-4-8' : 'claude-haiku-4-5-20251001';

    const messageParams = {
      model,
      max_tokens: useOpus ? 2048 : 1024,
      messages: [{ role: 'user', content: systemPrompt }],
    };

    // Thinking adattivo solo per analisi mercato con ATECO (più complessa)
    if (useOpus) {
      messageParams.thinking = { type: 'adaptive' };
      messageParams.betas = ['interleaved-thinking-2025-05-14'];
    }

    const message = await client.messages.create(messageParams);

    // Estrai solo i blocchi di testo (salta thinking blocks)
    const testo = message.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    res.json({ testo });
  } catch (err) {
    console.error('genera-testo error:', err);
    res.status(500).json({ error: err.message });
  }
}
