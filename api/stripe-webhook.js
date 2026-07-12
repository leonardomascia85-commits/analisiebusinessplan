// Stripe webhook → Aruba Fatturazione Elettronica
// Env vars needed:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET
//   ARUBA_FE_USERNAME
//   ARUBA_FE_PASSWORD

import Stripe from 'stripe';

const ARUBA_AUTH_URL = 'https://auth.fatturazioneelettronica.aruba.it';
const ARUBA_WS_URL   = 'https://ws.fatturazioneelettronica.aruba.it';

const CEDENTE = {
  piva:        '09806851219',
  cf:          'MSCLRD85A01I073H',
  nome:        'Mascia Leonardo',
  indirizzo:   'Via Isernia 17',
  cap:         '80036',
  comune:      'Palma Campania',
  provincia:   'NA',
  nazione:     'IT',
  regime:      'RF01', // ordinario
};

// ─── Auth Aruba FE ───────────────────────────────────────────────────────────

async function arubaToken() {
  const res = await fetch(`${ARUBA_AUTH_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: `grant_type=password&username=${encodeURIComponent(process.env.ARUBA_FE_USERNAME)}&password=${encodeURIComponent(process.env.ARUBA_FE_PASSWORD)}`,
  });
  if (!res.ok) throw new Error(`Aruba auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

// ─── Genera XML FatturaPA ────────────────────────────────────────────────────

function buildFatturaPAXml({ numero, data, cliente, importoIvato, imponibile, iva, aliquota, descrizione }) {
  const dataFmt = data.toISOString().split('T')[0];
  const codDest = cliente.codice_destinatario || '0000000';
  const pecDest  = cliente.pec || '';
  const pecTag   = pecDest && !cliente.codice_destinatario
    ? `<PECDestinatario>${pecDest}</PECDestinatario>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12"
  xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2 http://www.fatturapa.gov.it/export/fatturazione/sdi/fatturapa/v1.2/Schema_del_file_xml_FatturaPA_versione_1.2.xsd">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>IT</IdPaese>
        <IdCodice>01879020517</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>${String(numero).padStart(5, '0')}</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>${codDest}</CodiceDestinatario>
      ${pecTag}
      <ContattiTrasmittente>
        <Email>info@arubapec.it</Email>
      </ContattiTrasmittente>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>${CEDENTE.piva}</IdCodice>
        </IdFiscaleIVA>
        <CodiceFiscale>${CEDENTE.cf}</CodiceFiscale>
        <Anagrafica>
          <Nome>${CEDENTE.nome}</Nome>
        </Anagrafica>
        <RegimeFiscale>${CEDENTE.regime}</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${CEDENTE.indirizzo}</Indirizzo>
        <CAP>${CEDENTE.cap}</CAP>
        <Comune>${CEDENTE.comune}</Comune>
        <Provincia>${CEDENTE.provincia}</Provincia>
        <Nazione>${CEDENTE.nazione}</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        ${cliente.piva ? `<IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${cliente.piva}</IdCodice></IdFiscaleIVA>` : ''}
        ${cliente.cf ? `<CodiceFiscale>${cliente.cf}</CodiceFiscale>` : ''}
        <Anagrafica>
          <Denominazione>${escXml(cliente.nome)}</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${escXml(cliente.indirizzo || 'ND')}</Indirizzo>
        <CAP>${cliente.cap || '00000'}</CAP>
        <Comune>${escXml(cliente.comune || 'ND')}</Comune>
        <Nazione>${cliente.nazione || 'IT'}</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>${dataFmt}</Data>
        <Numero>${numero}</Numero>
        <ImportoTotaleDocumento>${importoIvato.toFixed(2)}</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea>
        <Descrizione>${escXml(descrizione)}</Descrizione>
        <Quantita>1.00</Quantita>
        <PrezzoUnitario>${imponibile.toFixed(2)}</PrezzoUnitario>
        <PrezzoTotale>${imponibile.toFixed(2)}</PrezzoTotale>
        <AliquotaIVA>${aliquota.toFixed(2)}</AliquotaIVA>
      </DettaglioLinee>
      <DatiRiepilogo>
        <AliquotaIVA>${aliquota.toFixed(2)}</AliquotaIVA>
        <ImponibileImporto>${imponibile.toFixed(2)}</ImponibileImporto>
        <Imposta>${iva.toFixed(2)}</Imposta>
        <EsigibilitaIVA>I</EsigibilitaIVA>
      </DatiRiepilogo>
    </DatiBeniServizi>
    <DatiPagamento>
      <CondizioniPagamento>TP02</CondizioniPagamento>
      <DettaglioPagamento>
        <ModalitaPagamento>MP08</ModalitaPagamento>
        <DataScadenzaPagamento>${dataFmt}</DataScadenzaPagamento>
        <ImportoPagamento>${importoIvato.toFixed(2)}</ImportoPagamento>
      </DettaglioPagamento>
    </DatiPagamento>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;
}

function escXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Invia fattura ad Aruba FE ───────────────────────────────────────────────

async function inviaFattura(token, xmlString) {
  const b64 = Buffer.from(xmlString, 'utf8').toString('base64');
  const res = await fetch(`${ARUBA_WS_URL}/services/invoice/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json;charset=UTF-8',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ dataFile: b64, skipExtraSchema: false }),
  });
  const data = await res.json();
  if (data.errorCode !== '0000') throw new Error(`Aruba upload error: ${data.errorCode} — ${data.errorDescription}`);
  return data.uploadFileName;
}

// ─── Handler principale ──────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig    = req.headers['stripe-signature'];
  let event;

  try {
    const raw = await buffer(req);
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  if (event.type !== 'checkout.session.completed' && event.type !== 'payment_intent.succeeded') {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;

  try {
    // Leggi metadati del cliente da Stripe (salvati al checkout)
    const meta = session.metadata || {};
    const amountTotal = session.amount_total || 0; // in centesimi
    const aliquota = 22; // IVA 22% — regime ordinario
    const importoIvato = amountTotal / 100;
    const imponibile   = aliquota > 0 ? importoIvato / (1 + aliquota / 100) : importoIvato;
    const iva          = importoIvato - imponibile;

    const cliente = {
      nome:      meta.cliente_nome || session.customer_details?.name || 'Cliente',
      piva:      meta.cliente_piva || '',
      cf:        meta.cliente_cf   || '',
      indirizzo: meta.cliente_indirizzo || '',
      cap:       meta.cliente_cap  || '00000',
      comune:    meta.cliente_comune || '',
      nazione:   meta.cliente_nazione || 'IT',
      codice_destinatario: meta.codice_sdi || '',
      pec:       meta.pec_destinatario || '',
    };

    const numero = meta.fattura_numero || Date.now().toString().slice(-6);
    const descrizione = meta.descrizione || 'Abbonamento AnalisiEBusinessPlan.com';

    const xml   = buildFatturaPAXml({ numero, data: new Date(), cliente, importoIvato, imponibile, iva, aliquota, descrizione });
    const token = await arubaToken();
    const filename = await inviaFattura(token, xml);

    console.log(`Fattura inviata: ${filename} — sessione Stripe: ${session.id}`);
    return res.status(200).json({ ok: true, filename });
  } catch (err) {
    console.error('Errore fatturazione:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function buffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(typeof c === 'string' ? Buffer.from(c) : c));
    req.on('end',  () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export const config = { api: { bodyParser: false } };
