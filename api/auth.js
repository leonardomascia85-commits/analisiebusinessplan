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

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' })

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(503).json({
      error: "Servizio non configurato. Contatta l'amministratore.",
      code: 'NOT_CONFIGURED'
    })
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    return res.status(503).json({
      error: "Impossibile inizializzare il servizio. Verifica che @supabase/supabase-js sia installato.",
      code: 'INIT_ERROR'
    })
  }

  const { action, nome, cognome, email, password, studio } = req.body || {}

  if (action === 'register') {
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Email non valida' })
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'La password deve essere di almeno 8 caratteri' })
    }
    if (!nome || !cognome) {
      return res.status(400).json({ error: 'Nome e cognome sono obbligatori' })
    }

    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      // Supabase restituisce questo messaggio quando l'utente esiste già
      if (error.message?.toLowerCase().includes('already registered') || error.status === 422) {
        return res.status(409).json({ error: 'Email già registrata' })
      }
      return res.status(400).json({ error: error.message })
    }

    const userId = data.user?.id
    if (!userId) {
      return res.status(500).json({ error: 'Errore durante la registrazione' })
    }

    // Inserisce il profilo esteso dell'utente nella tabella dedicata
    const { error: profileError } = await supabase
      .from('profili')
      .insert([{ id: userId, nome, cognome, email, studio, created_at: new Date().toISOString() }])

    if (profileError) {
      return res.status(500).json({ error: 'Utente creato ma errore nel salvataggio del profilo: ' + profileError.message })
    }

    return res.status(201).json({
      ok: true,
      user: { id: userId, email, nome, cognome }
    })
  }

  if (action === 'login') {
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e password sono obbligatorie' })
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      // Mappa gli errori di autenticazione generici in un messaggio sicuro
      if (error.message?.toLowerCase().includes('invalid') || error.status === 400) {
        return res.status(401).json({ error: 'Email o password non corretti' })
      }
      return res.status(401).json({ error: 'Email o password non corretti' })
    }

    return res.status(200).json({
      ok: true,
      user: { id: data.user.id, email: data.user.email },
      token: data.session.access_token
    })
  }

  if (action === 'logout') {
    await supabase.auth.signOut()
    return res.status(200).json({ ok: true })
  }

  if (action === 'reset-password') {
    if (!email) return res.status(400).json({ error: 'Email richiesta' })
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.SITE_URL || 'https://analisiebusinessplan.it'}/auth.html?mode=reset`
    })
    if (error) return res.status(400).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(400).json({ error: 'Azione non riconosciuta. Valori accettati: register, login, logout, reset-password' })
}
