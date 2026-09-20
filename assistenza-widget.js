/* assistenza-widget.js — Widget di assistenza condiviso su tutte le pagine */
(function(){
  const html = `
<div id="btn-assistenza" onclick="apriFormContatto()"
  style="position:fixed;bottom:24px;right:24px;z-index:9000;
         background:#1D4ED8;color:#fff;border-radius:50px;
         padding:12px 20px;cursor:pointer;font-size:.9rem;font-weight:700;
         box-shadow:0 4px 16px rgba(29,78,216,.35);
         display:flex;align-items:center;gap:8px;transition:.2s;"
  onmouseenter="this.style.background='#1E40AF'"
  onmouseleave="this.style.background='#1D4ED8'">
  <span style="font-size:1.1rem;">💬</span> Hai bisogno di aiuto?
</div>

<div id="modal-contatto" style="display:none;position:fixed;inset:0;z-index:9100;
     background:rgba(0,0,0,.5);align-items:center;justify-content:center;">
  <div style="background:#fff;border-radius:14px;padding:32px 28px;
              max-width:480px;width:calc(100% - 32px);box-shadow:0 20px 60px rgba(0,0,0,.2);
              position:relative;">
    <button onclick="chiudiFormContatto()" style="position:absolute;top:14px;right:16px;
      border:none;background:none;font-size:1.4rem;color:#94A3B8;cursor:pointer;">✕</button>
    <div style="font-size:1.1rem;font-weight:800;color:#1D4ED8;margin-bottom:4px;">💬 Richiedi assistenza</div>
    <div style="font-size:.82rem;color:#64748B;margin-bottom:20px;">Ti rispondo entro 24 ore lavorative.</div>
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div>
        <label style="font-size:.8rem;font-weight:600;color:#475569;display:block;margin-bottom:4px;">Nome</label>
        <input id="ct-nome" type="text" placeholder="Il tuo nome"
          style="width:100%;box-sizing:border-box;border:1.5px solid #CBD5E1;border-radius:8px;padding:10px 12px;font-size:.9rem;outline:none;"
          onfocus="this.style.borderColor='#2563EB'" onblur="this.style.borderColor='#CBD5E1'">
      </div>
      <div>
        <label style="font-size:.8rem;font-weight:600;color:#475569;display:block;margin-bottom:4px;">Email <span style="color:#EF4444">*</span></label>
        <input id="ct-email" type="email" placeholder="tua@email.com"
          style="width:100%;box-sizing:border-box;border:1.5px solid #CBD5E1;border-radius:8px;padding:10px 12px;font-size:.9rem;outline:none;"
          onfocus="this.style.borderColor='#2563EB'" onblur="this.style.borderColor='#CBD5E1'">
      </div>
      <div>
        <label style="font-size:.8rem;font-weight:600;color:#475569;display:block;margin-bottom:4px;">Messaggio <span style="color:#EF4444">*</span></label>
        <textarea id="ct-messaggio" rows="4" placeholder="Come posso aiutarti?"
          style="width:100%;box-sizing:border-box;border:1.5px solid #CBD5E1;border-radius:8px;padding:10px 12px;font-size:.9rem;outline:none;resize:vertical;font-family:inherit;"
          onfocus="this.style.borderColor='#2563EB'" onblur="this.style.borderColor='#CBD5E1'"></textarea>
      </div>
      <div id="ct-esito" style="display:none;padding:10px 12px;border-radius:8px;font-size:.85rem;font-weight:600;"></div>
      <button id="ct-btn-invia" onclick="inviaRichiestaAiuto()"
        style="background:#1D4ED8;color:#fff;border:none;border-radius:8px;padding:12px;
               font-size:.95rem;font-weight:700;cursor:pointer;transition:.15s;"
        onmouseenter="this.style.background='#1E40AF'" onmouseleave="this.style.background='#1D4ED8'">
        Invia richiesta
      </button>
    </div>
  </div>
</div>`;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  document.getElementById('modal-contatto').addEventListener('click', function(e){
    if(e.target === this) chiudiFormContatto();
  });
})();

function apriFormContatto(){
  const m = document.getElementById('modal-contatto');
  if(!m) return;
  m.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
function chiudiFormContatto(){
  const m = document.getElementById('modal-contatto');
  if(m) m.style.display = 'none';
  document.body.style.overflow = '';
  const btn = document.getElementById('ct-btn-invia');
  if(btn){ btn.disabled = false; btn.textContent = 'Invia richiesta'; btn.style.display = ''; }
  const esito = document.getElementById('ct-esito');
  if(esito) esito.style.display = 'none';
}
async function inviaRichiestaAiuto(){
  const nome     = (document.getElementById('ct-nome')?.value     || '').trim();
  const email    = (document.getElementById('ct-email')?.value    || '').trim();
  const messaggio= (document.getElementById('ct-messaggio')?.value|| '').trim();
  const esito    = document.getElementById('ct-esito');
  const btn      = document.getElementById('ct-btn-invia');
  if(!email || !messaggio){
    esito.style.display='block';
    esito.style.background='#FEF2F2'; esito.style.color='#DC2626';
    esito.textContent='Email e messaggio sono obbligatori.';
    return;
  }
  btn.disabled = true; btn.textContent = 'Invio in corso…';
  try {
    const r = await fetch('/api/contact', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ nome, email, messaggio, pagina: location.pathname })
    });
    const data = await r.json();
    if(r.ok){
      esito.style.display='block';
      esito.style.background='#F0FDF4'; esito.style.color='#16A34A';
      esito.textContent='✅ Richiesta inviata! Ti rispondo entro 24 ore.';
      btn.style.display='none';
      ['ct-nome','ct-email','ct-messaggio'].forEach(id=>{
        const el=document.getElementById(id); if(el) el.value='';
      });
      setTimeout(chiudiFormContatto, 3000);
    } else {
      throw new Error(data.error || 'Errore di rete');
    }
  } catch(err){
    esito.style.display='block';
    esito.style.background='#FEF2F2'; esito.style.color='#DC2626';
    esito.textContent = err.message || 'Invio fallito. Scrivi a info@analisiebusinessplan.com';
    btn.disabled = false; btn.textContent = 'Invia richiesta';
  }
}
