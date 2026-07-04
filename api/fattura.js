// api/fattura.js — Download PDF fattura
// Placeholder: integra con Stripe o sistema fatturazione scelto

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'ID fattura mancante' });

  // TODO: recuperare il PDF fattura dal sistema di fatturazione (es. Stripe, Fattureincloud)
  // Per ora restituisce 404 con messaggio chiaro
  return res.status(404).json({
    error: 'Fattura non disponibile',
    message: 'Il download delle fatture sarà disponibile a breve. Contatta info@analisiebusinessplan.com per ricevere la tua fattura.'
  });
};
