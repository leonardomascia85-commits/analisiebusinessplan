import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { tipo, nome, settore, sito_web, prompt: customPrompt } = req.body || {};

  const prompts = {
    company: `Sei un consulente aziendale esperto in presentazioni per istituti di credito. Scrivi una presentazione professionale dell'azienda "${nome}" operante nel settore "${settore}"${sito_web ? ` (sito web: ${sito_web})` : ''}. Struttura il testo in 3-4 paragrafi: storia e posizionamento, attività core e punti di forza, governance e prospettive. Tono formale, circa 200 parole. Non usare elenchi puntati.`,

    progetto: `Sei un consulente aziendale specializzato in business plan bancari. Scrivi la sezione "Il Progetto" per il business plan dell'azienda "${nome}" (settore: ${settore}). Includi: obiettivo strategico del triennio, principali azioni operative previste, investimenti pianificati, benefici attesi in termini di fatturato e marginalità. 3-4 paragrafi, tono professionale e concreto. Non usare elenchi puntati.`,

    mercato: `Sei un analista di mercato. Scrivi la sezione "Mercato e Competitività" per un business plan di un'azienda nel settore "${settore}". Includi: dimensione e trend del mercato italiano/europeo di riferimento, dinamiche competitive, posizionamento atteso dell'azienda, opportunità e rischi di settore. 3-4 paragrafi, tono formale e orientato alla banca. Non usare elenchi puntati.`
  };

  const systemPrompt = prompts[tipo] || customPrompt;
  if (!systemPrompt) return res.status(400).json({ error: 'Parametri mancanti' });

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: systemPrompt }]
    });

    const testo = message.content[0]?.text || '';
    res.json({ testo });
  } catch (err) {
    console.error('genera-testo error:', err);
    res.status(500).json({ error: err.message });
  }
}
