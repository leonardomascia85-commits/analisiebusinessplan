const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    headless: true, args: ['--no-sandbox']
  });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', msg => { if(msg.type()==='error') logs.push(msg.text()); });

  // ── STEP 1: importa-xbrl.html ─────────────────────────────────
  await page.goto('http://localhost:8765/importa-xbrl.html', {waitUntil:'load'});
  await page.waitForTimeout(500);

  const xbrl = fs.readFileSync('/tmp/timevision.xbrl', 'utf8');
  await page.locator('#input-xbrl').setInputFiles('/tmp/timevision.xbrl');

  // Aspetta che il parsing completi (rb-title aggiornato)
  await page.waitForFunction(
    () => (document.getElementById('rb-title')?.textContent||'').includes('TIME VISION'),
    { timeout: 12000 }
  );
  await page.waitForTimeout(300);

  // Verifica valori nella schermata risultati
  const g = id => page.$eval(`#${id}`, el=>el.textContent.trim()).catch(()=>'N/A');
  console.log('\n=== STEP 1: importa-xbrl.html ===');
  console.log('Status  :', await g('rb-title'));
  console.log('Società :', await g('rb-nome'));
  console.log('Anno    :', await g('rb-anno'));
  console.log('Attivo  :', await g('rb-att'));
  console.log('PN      :', await g('rb-pn'));
  console.log('Debiti  :', await g('rb-deb'));
  console.log('V.Prod  :', await g('rb-vp'));
  console.log('EBITDA  :', await g('rb-ebitda'));
  await page.screenshot({ path: '/tmp/ms_01_import.png', fullPage: true });

  // ── STEP 2: salva sessionStorage e naviga manualmente ─────────
  // Salva i dati direttamente dal parser nella pagina corrente
  await page.evaluate(() => { salvaSessionStorage(parsedData); });

  await page.goto('http://localhost:8765/bilancio-multianno.html', {waitUntil:'commit'});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/ms_02_multianno_load.png', fullPage: true });

  console.log('\n=== STEP 2: bilancio-multianno.html ===');
  console.log('URL:', page.url());

  // ── STEP 3: verifica anno e card ──────────────────────────────
  const ylabel0 = await page.$eval('#ylabel-0', el=>el.textContent).catch(()=>'N/A');
  const ylabel1 = await page.$eval('#ylabel-1', el=>el.textContent).catch(()=>'N/A');
  const ylabel2 = await page.$eval('#ylabel-2', el=>el.textContent).catch(()=>'N/A');
  console.log('Anno card 0:', ylabel0);
  console.log('Anno card 1:', ylabel1);
  console.log('Anno card 2:', ylabel2);

  // Leggi i campi SP dell'anno corrente (anno 0)
  const gField = async (fieldId) => {
    return page.evaluate((id) => {
      const inputs = document.querySelectorAll('input[id]');
      for(const inp of inputs) {
        if(inp.id === id) return inp.value;
      }
      return null;
    }, fieldId).catch(()=>null);
  };

  // Debug: leggi DATA[0] raw
  const rawData0 = await page.evaluate(() => {
    if(typeof DATA === 'undefined') return null;
    const d = DATA[0];
    return { cap_soc:d.cap_soc, riserve:d.riserve, utili_pn:d.utili_pn, utile_es:d.utile_es };
  });
  console.log('\n─── RAW DATA[0] PN fields ───');
  console.log(rawData0);

  // Leggi via buildAnnoData() per avere i totali calcolati
  const dataResult = await page.evaluate(() => {
    if(typeof buildAnnoData !== 'function') return null;
    const d = buildAnnoData(0);
    if(!d) return null;
    return {
      tot_att:  d.tot_att,
      tot_pn:   d.tot_pn,
      tot_deb:  d.tot_deb,
      ric_vend: d.ric_vend,
      tot_imm:  d.tot_imm,
      tot_circ: d.tot_circ,
      ratei_att:d.ratei_att,
      tfr:      d.tfr,
      ratei_pass:d.ratei_pass,
      anno:     (typeof DATA!=='undefined'&&DATA[0])?DATA[0].anno:null,
    };
  });

  if(dataResult) {
    console.log('\n─── DATA[0] in bilancio-multianno ───');
    console.log('Anno     :', dataResult.anno);
    console.log('Tot.Att  :', (dataResult.tot_att||0).toLocaleString('it-IT'));
    console.log('Tot.PN   :', (dataResult.tot_pn||0).toLocaleString('it-IT'));
    console.log('Tot.Deb  :', (dataResult.tot_deb||0).toLocaleString('it-IT'));
    console.log('Ricavi   :', (dataResult.ric_vend||0).toLocaleString('it-IT'));
    console.log('Tot.Imm  :', (dataResult.tot_imm||0).toLocaleString('it-IT'));
    console.log('Tot.Circ :', (dataResult.tot_circ||0).toLocaleString('it-IT'));
    console.log('RateiAtt :', (dataResult.ratei_att||0).toLocaleString('it-IT'));
    console.log('TFR      :', (dataResult.tfr||0).toLocaleString('it-IT'));
    console.log('RateiPass:', (dataResult.ratei_pass||0).toLocaleString('it-IT'));
    const calcAtt = (dataResult.tot_imm||0)+(dataResult.tot_circ||0)+(dataResult.ratei_att||0);
    console.log('SP check :', calcAtt.toLocaleString('it-IT'), calcAtt===(dataResult.tot_att||0)?'✅':'⚠️ diff '+(dataResult.tot_att-calcAtt));
  } else {
    console.log('⚠️ DATA non trovato in bilancio-multianno');
  }

  // ── STEP 4: clicca su anno 0 e verifica che il form si popoli ─
  await page.locator('#ycard-0').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/ms_03_form.png', fullPage: true });

  // Leggi valori del form SP (inputs usano data-key)
  const spFields = await page.evaluate(() => {
    const keys = ['imm_imm','imm_mat','imm_fin','cred_cl','liquidita','ratei_att',
                  'cap_soc','riserve','utile_es','tfr','ratei_pass'];
    const res = {};
    for(const k of keys) {
      const el = document.querySelector(`input[data-key="${k}"]`);
      res[k] = el ? el.value : 'N/A';
    }
    return res;
  });

  console.log('\n─── CAMPI FORM SP (data-key) ───');
  for(const [k,v] of Object.entries(spFields)) {
    console.log(' ', k.padEnd(18), ':', v);
  }

  // ── STEP 5: clicca "Calcola" e leggi indici ──────────────────
  const btnCalc = page.locator('button[onclick*="calcola"], button[onclick*="Calcola"], #btn-calcola').first();
  if(await btnCalc.count()) {
    await btnCalc.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: '/tmp/ms_04_calcola.png', fullPage: true });
    console.log('\n─── INDICI (dopo Calcola) ───');
    const roe = await page.$eval('[id*="roe"]', el=>el.textContent).catch(()=>'N/A');
    const roi = await page.$eval('[id*="roi"]', el=>el.textContent).catch(()=>'N/A');
    console.log('ROE:', roe);
    console.log('ROI:', roi);
  }

  console.log('\nErrori console:', logs.length ? logs : 'nessuno');
  await browser.close();
})();
