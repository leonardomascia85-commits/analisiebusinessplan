// api/genera-bp-excel.js — Business Plan in formato Excel SpreadsheetML

const escXml = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmtN = (n) => (n === undefined || n === null || isNaN(n) || !isFinite(n) || n === '') ? '' : (typeof n === 'string' ? n : Math.round(n));
const isNum = (n) => n !== null && n !== undefined && n !== '' && typeof n !== 'string' && !isNaN(n) && isFinite(n);

function cell(val, styleId) {
  const s = styleId ? ` ss:StyleID="${styleId}"` : '';
  if (val === null || val === undefined || val === '') return `<Cell${s}><Data ss:Type="String"></Data></Cell>`;
  if (typeof val === 'string') {
    const v = escXml(val);
    return `<Cell${s}><Data ss:Type="String">${v}</Data></Cell>`;
  }
  return `<Cell${s}><Data ss:Type="Number">${Math.round(val)}</Data></Cell>`;
}

function pctCell(val, styleId) {
  const s = styleId ? ` ss:StyleID="${styleId}"` : ' ss:StyleID="pct"';
  if (val === null || val === undefined || val === '') return `<Cell${s}><Data ss:Type="String"></Data></Cell>`;
  if (typeof val === 'string') return `<Cell ss:StyleID="pct"><Data ss:Type="String">${escXml(val)}</Data></Cell>`;
  const num = parseFloat(val);
  if (isNaN(num)) return `<Cell ss:StyleID="pct"><Data ss:Type="String">${escXml(String(val))}</Data></Cell>`;
  return `<Cell ss:StyleID="pct"><Data ss:Type="Number">${num.toFixed(2)}</Data></Cell>`;
}

function buildRow(row, annoBase) {
  if (row.section && !row.label) return `<Row ss:Height="6"><Cell/></Row>\n`;
  const isSect = row.section && row.label;
  const isTot  = row.total;
  const sLabel = isSect ? 'sect' : isTot ? 'tot' : 'Default';
  const sVal   = isTot ? 'totnum' : 'num';

  const isPct = row.label && (row.label.includes('%') || row.label.includes('Margin') || row.label.includes('annua') || row.label.includes('CAGR'));

  const valCell = (v) => {
    if (isPct) return pctCell(v);
    if (isNum(v)) return cell(v, sVal);
    return cell(v ?? '', 'Default');
  };

  return `<Row>
    <Cell ss:StyleID="${sLabel}"><Data ss:Type="String">${escXml(row.label || '')}</Data></Cell>
    ${valCell(row.s)}${valCell(row.a1)}${valCell(row.a2)}${valCell(row.a3)}
  </Row>\n`;
}

function buildSheet(name, rows, annoBase, colWidth) {
  const hdrYear = (y) => y ? `Anno ${y}` : 'Storico';
  const a0 = annoBase, a1 = annoBase+1, a2 = annoBase+2, a3 = annoBase+3;
  let r = '';
  r += `<Row ss:Height="26"><Cell ss:MergeAcross="4" ss:StyleID="hdr1"><Data ss:Type="String">${escXml(name)}</Data></Cell></Row>\n`;
  r += `<Row>
    <Cell ss:StyleID="hdr2"><Data ss:Type="String">Voce</Data></Cell>
    <Cell ss:StyleID="hdr2"><Data ss:Type="String">${hdrYear(a0)} (€)</Data></Cell>
    <Cell ss:StyleID="hdr2"><Data ss:Type="String">${hdrYear(a1)} (€)</Data></Cell>
    <Cell ss:StyleID="hdr2"><Data ss:Type="String">${hdrYear(a2)} (€)</Data></Cell>
    <Cell ss:StyleID="hdr2"><Data ss:Type="String">${hdrYear(a3)} (€)</Data></Cell>
  </Row>\n`;
  for (const row of (rows || [])) r += buildRow(row, annoBase);
  const w = colWidth || 160;
  return `<Worksheet ss:Name="${escXml(name)}">
  <Table ss:DefaultColumnWidth="${w}" ss:DefaultRowHeight="16">
  <Column ss:Width="220"/>
  ${r}
  </Table></Worksheet>`;
}

function buildKPISheet(kpi, be, annoBase) {
  let r = '';
  r += `<Row ss:Height="26"><Cell ss:MergeAcross="4" ss:StyleID="hdr1"><Data ss:Type="String">KPI e Indicatori chiave</Data></Cell></Row>\n`;
  r += `<Row>
    <Cell ss:StyleID="hdr2"><Data ss:Type="String">Indicatore</Data></Cell>
    <Cell ss:StyleID="hdr2"><Data ss:Type="String">Storico ${annoBase}</Data></Cell>
    <Cell ss:StyleID="hdr2"><Data ss:Type="String">Anno ${annoBase+1}</Data></Cell>
    <Cell ss:StyleID="hdr2"><Data ss:Type="String">Anno ${annoBase+2}</Data></Cell>
    <Cell ss:StyleID="hdr2"><Data ss:Type="String">Anno ${annoBase+3}</Data></Cell>
  </Row>\n`;
  for (const k of (kpi || [])) {
    const isPct = k.label && (k.label.includes('%') || k.label.includes('Margin') || k.label.includes('DSCR') || k.label.includes('ICR'));
    const cv = (v) => isPct ? pctCell(v) : (isNum(v) ? cell(v, 'num') : cell(v ?? '', 'Default'));
    r += `<Row>
      <Cell ss:StyleID="Default"><Data ss:Type="String">${escXml(k.label||'')}</Data></Cell>
      ${cv(k.s)}${cv(k.a1)}${cv(k.a2)}${cv(k.a3)}
    </Row>\n`;
  }

  if (be) {
    r += `<Row/>\n`;
    r += `<Row><Cell ss:MergeAcross="4" ss:StyleID="sect"><Data ss:Type="String">ANALISI BREAK-EVEN</Data></Cell></Row>\n`;
    r += `<Row><Cell><Data ss:Type="String">Ricavi break-even</Data></Cell><Cell ss:StyleID="num"><Data ss:Type="Number">${Math.round(be.ricavi_be||0)}</Data></Cell></Row>\n`;
    r += `<Row><Cell><Data ss:Type="String">Costi fissi totali</Data></Cell><Cell ss:StyleID="num"><Data ss:Type="Number">${Math.round(be.costi_fissi||0)}</Data></Cell></Row>\n`;
    r += `<Row><Cell><Data ss:Type="String">Margine di contribuzione %</Data></Cell><Cell ss:StyleID="pct"><Data ss:Type="Number">${((be.margine_contribuzione||0)*100).toFixed(2)}</Data></Cell></Row>\n`;
    r += `<Row><Cell><Data ss:Type="String">Utilizzo capacità al BE</Data></Cell><Cell ss:StyleID="pct"><Data ss:Type="Number">${((be.utilizzo_cap||0)).toFixed(2)}</Data></Cell></Row>\n`;
    r += `<Row><Cell><Data ss:Type="String">Margine di sicurezza %</Data></Cell><Cell ss:StyleID="pct"><Data ss:Type="Number">${((be.margine_perc||0)).toFixed(2)}</Data></Cell></Row>\n`;
  }

  return `<Worksheet ss:Name="KPI"><Table ss:DefaultColumnWidth="150" ss:DefaultRowHeight="16"><Column ss:Width="220"/>${r}</Table></Worksheet>`;
}

function buildExcel(data, config) {
  const annoBase = config.anno_base || 2024;
  const nome = config.nome || 'Azienda';
  const { ce, sp, cf, be, kpi } = data;

  const styles = `<Styles>
    <Style ss:ID="Default"><Alignment ss:Vertical="Bottom"/><Font ss:FontName="Calibri" ss:Size="10"/></Style>
    <Style ss:ID="hdr1"><Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1" ss:Color="#0A1628"/><Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#2563EB"/></Borders></Style>
    <Style ss:ID="hdr2"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0A1628" ss:Pattern="Solid"/></Style>
    <Style ss:ID="sect"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#334155"/><Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/></Style>
    <Style ss:ID="tot"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1"/><Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/></Style>
    <Style ss:ID="num"><Alignment ss:Horizontal="Right"/><NumberFormat ss:Format="#,##0"/></Style>
    <Style ss:ID="totnum"><Alignment ss:Horizontal="Right"/><NumberFormat ss:Format="#,##0"/><Font ss:Bold="1"/><Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/></Style>
    <Style ss:ID="pct"><Alignment ss:Horizontal="Right"/><NumberFormat ss:Format="0.0&quot;%&quot;"/></Style>
    <Style ss:ID="pos"><Font ss:Color="#059669" ss:Bold="1"/></Style>
    <Style ss:ID="neg"><Font ss:Color="#DC2626" ss:Bold="1"/></Style>
  </Styles>`;

  // Foglio riepilogo scenari
  const sRiep = (() => {
    let r = '';
    r += `<Row ss:Height="26"><Cell ss:MergeAcross="4" ss:StyleID="hdr1"><Data ss:Type="String">BUSINESS PLAN — ${escXml(nome)} — Triennio ${annoBase+1}–${annoBase+3}</Data></Cell></Row>\n`;
    r += `<Row><Cell ss:StyleID="sect"><Data ss:Type="String">Parametro</Data></Cell><Cell ss:StyleID="sect"><Data ss:Type="String">Valore</Data></Cell></Row>\n`;
    r += `<Row><Cell><Data ss:Type="String">Ragione sociale</Data></Cell><Cell><Data ss:Type="String">${escXml(nome)}</Data></Cell></Row>\n`;
    r += `<Row><Cell><Data ss:Type="String">Anno base</Data></Cell><Cell><Data ss:Type="Number">${annoBase}</Data></Cell></Row>\n`;
    r += `<Row><Cell><Data ss:Type="String">Crescita Base Anno 1</Data></Cell><Cell ss:StyleID="pct"><Data ss:Type="Number">${config.g1||0}</Data></Cell></Row>\n`;
    r += `<Row><Cell><Data ss:Type="String">Crescita Base Anno 2</Data></Cell><Cell ss:StyleID="pct"><Data ss:Type="Number">${config.g2||0}</Data></Cell></Row>\n`;
    r += `<Row><Cell><Data ss:Type="String">Crescita Base Anno 3</Data></Cell><Cell ss:StyleID="pct"><Data ss:Type="Number">${config.g3||0}</Data></Cell></Row>\n`;
    // KPI sintetici da kpi array
    const ricavi = (kpi||[]).find(k=>k.label&&k.label.includes('RICAVI'));
    const ebitda = (kpi||[]).find(k=>k.label&&k.label==='EBITDA');
    const dscr   = (kpi||[]).find(k=>k.label&&k.label.includes('DSCR'));
    if (ricavi) {
      r += `<Row/>\n<Row><Cell ss:MergeAcross="4" ss:StyleID="sect"><Data ss:Type="String">KPI PRINCIPALI SCENARIO BASE</Data></Cell></Row>\n`;
      r += `<Row><Cell ss:StyleID="hdr2"><Data ss:Type="String">Indicatore</Data></Cell><Cell ss:StyleID="hdr2"><Data ss:Type="String">Anno ${annoBase+1}</Data></Cell><Cell ss:StyleID="hdr2"><Data ss:Type="String">Anno ${annoBase+2}</Data></Cell><Cell ss:StyleID="hdr2"><Data ss:Type="String">Anno ${annoBase+3}</Data></Cell></Row>\n`;
      for (const k of [ricavi, ebitda, dscr].filter(Boolean)) {
        const cv=(v)=>isNum(v)?`<Cell ss:StyleID="num"><Data ss:Type="Number">${Math.round(v)}</Data></Cell>`:`<Cell><Data ss:Type="String">${escXml(String(v??''))}</Data></Cell>`;
        r+=`<Row><Cell><Data ss:Type="String">${escXml(k.label)}</Data></Cell>${cv(k.a1)}${cv(k.a2)}${cv(k.a3)}</Row>\n`;
      }
    }
    return `<Worksheet ss:Name="Riepilogo"><Table ss:DefaultColumnWidth="160" ss:DefaultRowHeight="16"><Column ss:Width="220"/>${r}</Table></Worksheet>`;
  })();

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>Business Plan ${escXml(nome)} ${annoBase+1}–${annoBase+3}</Title>
  <Author>AnalisiEBusinessPlan.it</Author>
  <Created>${new Date().toISOString()}</Created>
</DocumentProperties>
${styles}
${sRiep}
${buildSheet(`Conto Economico`, ce, annoBase)}
${buildSheet(`Stato Patrimoniale`, sp, annoBase)}
${buildSheet(`Rendiconto Finanziario`, cf, annoBase)}
${buildKPISheet(kpi, be, annoBase)}
</Workbook>`;
}

module.exports = function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { data, config } = req.body;
  if (!data) return res.status(400).json({ error: 'Dati mancanti' });
  try {
    const xml = buildExcel(data, config || {});
    const nome = (config?.nome || 'BP').replace(/[^a-zA-Z0-9]/g, '-');
    const anno = config?.anno_base || new Date().getFullYear();
    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader('Content-Disposition', `attachment; filename="BusinessPlan-${nome}-${anno}.xls"`);
    res.status(200).send(xml);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};
