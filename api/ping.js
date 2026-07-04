// api/ping.js — mantiene il progetto Supabase attivo
// Chiamato da Vercel Cron ogni 3 giorni (vercel.json)
module.exports = async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(200).json({ ok: true, note: 'no supabase config' });
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    return res.status(200).json({ ok: true, status: response.status, ts: new Date().toISOString() });
  } catch (err) {
    return res.status(200).json({ ok: false, error: err.message });
  }
};
