const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  try {
    const { createClient } = require('@supabase/supabase-js')
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  } catch (e) {
    return null
  }
}

function extractBearerToken(req) {
  const auth = req.headers['authorization'] || req.headers['Authorization'] || ''
  if (!auth.startsWith('Bearer ')) return null
  return auth.slice(7).trim() || null
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' })
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(503).json({
      error: "Servizio non configurato. Contatta l'amministratore.",
      code: 'NOT_CONFIGURED'
    })
  }

  const token = extractBearerToken(req)
  if (!token) {
    return res.status(401).json({ error: 'Autenticazione richiesta. Fornire un token Bearer valido.' })
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    return res.status(503).json({
      error: "Impossibile inizializzare il servizio. Verifica che @supabase/supabase-js sia installato.",
      code: 'INIT_ERROR'
    })
  }

  // Verifica il token e recupera l'utente corrente
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return res.status(401).json({ error: 'Token non valido o scaduto' })
  }

  const userId = user.id

  if (req.method === 'GET') {
    const action = req.query?.action

    if (action === 'profile') {
      const { data, error } = await supabase
        .from('profili')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true, profile: data })
    }

    if (action === 'orders') {
      const { data, error } = await supabase
        .from('ordini')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true, orders: data })
    }

    if (action === 'invoices') {
      const { data, error } = await supabase
        .from('fatture')
        .select('*')
        .eq('user_id', userId)

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true, invoices: data })
    }

    return res.status(400).json({ error: 'Parametro action non riconosciuto. Valori accettati: profile, orders, invoices' })
  }

  if (req.method === 'POST') {
    const { action, nome, cognome, studio, piva, sdi, indirizzo, citta, cap, provincia } = req.body || {}

    if (action === 'update') {
      // Costruisce l'oggetto di aggiornamento includendo solo i campi effettivamente presenti nel body
      const updates = {}
      if (nome !== undefined) updates.nome = nome
      if (cognome !== undefined) updates.cognome = cognome
      if (studio !== undefined) updates.studio = studio
      if (piva !== undefined) updates.piva = piva
      if (sdi !== undefined) updates.sdi = sdi
      if (indirizzo !== undefined) updates.indirizzo = indirizzo
      if (citta !== undefined) updates.citta = citta
      if (cap !== undefined) updates.cap = cap
      if (provincia !== undefined) updates.provincia = provincia

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'Nessun campo da aggiornare fornito' })
      }

      const { data, error } = await supabase
        .from('profili')
        .update(updates)
        .eq('id', userId)
        .select()
        .single()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true, profile: data })
    }

    return res.status(400).json({ error: 'Azione non riconosciuta. Valori accettati: update' })
  }
}
