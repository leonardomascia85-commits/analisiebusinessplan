// api/contact.js — Invia richiesta di aiuto a leonardo@studiomascia.com
const { Resend } = require('resend');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nome, email, messaggio, pagina } = req.body || {};

  if (!email || !messaggio) {
    return res.status(400).json({ error: 'Email e messaggio sono obbligatori.' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#1D4ED8;padding:20px 24px;border-radius:8px 8px 0 0;">
        <h2 style="color:#fff;margin:0;font-size:1.2rem;">📩 Nuova richiesta di assistenza</h2>
        <p style="color:#BFDBFE;margin:4px 0 0;font-size:.85rem;">analisiebusinessplan.com</p>
      </div>
      <div style="background:#F8FAFC;padding:24px;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 8px 8px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#64748B;font-size:.85rem;width:110px;">Nome</td>
            <td style="padding:8px 0;font-weight:600;color:#1E293B;">${nome || '—'}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748B;font-size:.85rem;">Email</td>
            <td style="padding:8px 0;font-weight:600;color:#1E293B;"><a href="mailto:${email}" style="color:#2563EB;">${email}</a></td>
          </tr>
          ${pagina ? `<tr>
            <td style="padding:8px 0;color:#64748B;font-size:.85rem;">Pagina</td>
            <td style="padding:8px 0;color:#1E293B;">${pagina}</td>
          </tr>` : ''}
        </table>
        <hr style="border:none;border-top:1px solid #E2E8F0;margin:16px 0;">
        <p style="color:#64748B;font-size:.85rem;margin:0 0 8px;">Messaggio:</p>
        <div style="background:#fff;border:1px solid #E2E8F0;border-radius:6px;padding:14px;color:#1E293B;font-size:.95rem;line-height:1.6;white-space:pre-wrap;">${messaggio.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
        <p style="margin:16px 0 0;font-size:.8rem;color:#94A3B8;">Ricevuto il ${new Date().toLocaleString('it-IT',{timeZone:'Europe/Rome'})}</p>
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from: 'Analisi Business Plan <noreply@analisiebusinessplan.com>',
      to:   'leonardo@studiomascia.com',
      replyTo: email,
      subject: `Richiesta assistenza da ${nome || email}`,
      html: htmlBody,
    });

    // Email di conferma all'utente
    await resend.emails.send({
      from: 'Analisi Business Plan <noreply@analisiebusinessplan.com>',
      to:   email,
      subject: 'Abbiamo ricevuto la tua richiesta',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
          <div style="background:#1D4ED8;padding:20px 24px;border-radius:8px 8px 0 0;">
            <h2 style="color:#fff;margin:0;font-size:1.1rem;">✅ Richiesta ricevuta</h2>
          </div>
          <div style="background:#F8FAFC;padding:24px;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 8px 8px;">
            <p style="color:#1E293B;margin:0 0 12px;">Ciao ${nome || ''},</p>
            <p style="color:#1E293B;margin:0 0 12px;">abbiamo ricevuto la tua richiesta e ti risponderemo entro 24 ore lavorative.</p>
            <p style="color:#64748B;font-size:.85rem;margin:0;">— Team Analisi Business Plan</p>
          </div>
        </div>
      `,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Resend error:', err);
    return res.status(500).json({ error: 'Invio fallito. Riprova o scrivi a info@analisiebusinessplan.com.' });
  }
};
