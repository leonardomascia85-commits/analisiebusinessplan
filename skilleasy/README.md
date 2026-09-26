# SkillEasy — scaffold

Prima versione tecnica del nuovo sito "SkillEasy" (guide + corsi + attestati), deciso in `../ANALISI-PROGETTO-GUIDE-FORMAZIONE.md` (§17-19).

**Stato**: bozza statica (HTML/CSS puro, nessuna dipendenza), pensata per essere migrata sul dominio proprio `skilleasy.it` non appena registrato — vive qui solo perché è l'unico repository disponibile in questa sessione.

## File

- `index.html` — homepage: pilastri, corsi pilota, cross-link a Studio Mascia e AnalisiEBusinessPlan.com.
- `corso-regime-forfettario.html` — programma corso pilota A (Fisco, livello base).
- `corso-business-plan.html` — programma corso pilota B (Controllo di gestione + Finanza, livello avanzato, con cross-sell diretto al SaaS).
- `guide/` — guide scritte, complete di spiegazione + esempio numerico per ogni lezione. Ogni lezione è anche lo script di base per la video lezione corrispondente. In lavorazione, una guida alla volta:
  - `contabilita-base-avanzato.md` — pilastro Contabilità, 22 lezioni su 3 livelli (Base/Intermedio/Avanzato), con i riferimenti ai principi contabili OIC (11, 12, 13, 15, 16, 19, 25, 31) integrati lezione per lezione, azienda di esempio ricorrente ("Verdi Srl") per continuità tra gli esempi.
  - `fisco-base-avanzato.md` — pilastro Fisco, 20 lezioni su 3 livelli. Due persone di esempio: Marco Bruni (freelance, Partita IVA/regime forfettario) per Base/Intermedio, Verdi Srl (stessa azienda della guida Contabilità) per IRES/IRAP in Intermedio/Avanzato. Copre regime forfettario, coefficienti di redditività, IRPEF/IRES/IRAP con le aliquote 2026 verificate via ricerca web, deduzioni vs detrazioni, ravvedimento operoso, scelta della forma giuridica, controlli fiscali e pianificazione fiscale lecita. Contiene un avviso esplicito che aliquote/soglie vanno riverificate ogni anno (la Legge di Bilancio le cambia) prima di qualunque uso reale.
  - `gestione-aziendale-base-avanzato.md` — pilastro Gestione aziendale, 20 lezioni su 3 livelli. Continua a seguire Verdi Srl (stessa azienda delle guide precedenti) mentre cresce da impresa gestita da una sola persona a impresa organizzata. Copre organigramma, matrice RACI, delega, obiettivi SMART, riunioni efficaci, forme contrattuali di lavoro, CCNL, costo del lavoro reale (con aliquote INPS e agevolazioni apprendistato 2026 verificate), selezione del personale, KPI operativi, contrattualistica commerciale essenziale (clausola risolutiva espressa, riserva di proprietà, contratto di agenzia), secondo livello di responsabilità ed errori comuni delle PMI italiane.
  - `controllo-di-gestione-base-avanzato.md` — pilastro Controllo di gestione, 20 lezioni su 3 livelli. Riprende Verdi Srl con i suoi due reparti (guida Contabilità, Lezione 20) e la sua organizzazione (guida Gestione aziendale) per contabilità analitica, costi fissi/variabili, break-even, margine di contribuzione, indici di redditività/liquidità/indebitamento (ROE, ROI, ROS, Current Ratio, Autonomia finanziaria), budget e analisi degli scostamenti, cash flow e rendiconto finanziario, KPI finanziari (DSO/DPO/rotazione magazzino), make or buy, pricing, valutazione investimenti (payback, cenni VAN) e reporting direzionale. Fa da ponte esplicito verso il pilastro Programmazione e finanza.
  - `programmazione-finanza-base-avanzato.md` — pilastro Programmazione e finanza, 20 lezioni su 3 livelli, guida conclusiva dei 5 pilastri base. Usa gli stessi numeri di bilancio di Verdi Srl già stabiliti nella guida Controllo di gestione per calcolare DSCR, PFN/EBITDA, Altman Z'-Score e un rating di bancabilità A-E stimato (Linee Guida EBA/GL/2020/06, più le nuove Linee Guida EBA sui rischi ESG in vigore dall'11 gennaio 2026). Copre anche la costruzione di un business plan bancabile con proiezioni CE/SP/Cash Flow a 3 anni, le forme di finanziamento, il Fondo di Garanzia PMI 2026 (percentuali di copertura verificate), la leva finanziaria e come si presenta una richiesta di finanziamento in banca. Chiude esplicitamente il cerchio con AnalisiEBusinessPlan.com, che calcola in automatico gli stessi indici spiegati a mano in questa guida.

**Catalogo esteso** (9 guide di approfondimento oltre i 5 pilastri base, roadmap §22 del documento di analisi — tutte seguono Verdi Srl):
  - `sicurezza-sul-lavoro.md` — D.Lgs 81/08, 18 lezioni: DVR, RSPP/RLS/preposto, formazione, DPI, DUVRI, responsabilità penale/civile, cenni cantieri.
  - `crisi-impresa-allerta-precoce.md` — Codice della Crisi, 16 lezioni: assetti adeguati (art. 2086 c.c.), indicatori di allerta, DSCR trimestrale, composizione negoziata, responsabilità amministratori.
  - `welfare-aziendale-fringe-benefit.md` — 12 lezioni: soglie 2026 (1.000/2.000 €), buoni pasto, welfare allargato, confronto numerico welfare vs aumento in busta paga.
  - `agevolazioni-bandi-pmi.md` — 14 lezioni: iperammortamento 2026, Nuova Sabatini, Fondo di Garanzia PMI, bandi regionali, click day, errori di rendicontazione.
  - `privacy-gdpr-pmi.md` — 12 lezioni: registro trattamenti, basi giuridiche, diritti degli interessati, dati dipendenti/clienti, DPO, data breach nelle 72 ore.
  - `iva-avanzata.md` — 14 lezioni: esportazioni, cessioni intracomunitarie, reverse charge (generale ed edilizia), split payment, regime OSS e soglia 10.000 €.
  - `marketing-digitale-pmi.md` — 14 lezioni: funnel, cliente ideale, SEO, content marketing, canali social per B2B/B2C, email marketing, ADS, misurazione ROI.
  - `passaggio-generazionale-successione.md` — 12 lezioni: aliquote/franchigie successione 2026, novità separazione franchigie (D.Lgs 123/2025), patto di famiglia, preparazione del successore.
  - `guida-settoriale-edilizia.md` — 12 lezioni, caso di studio verticale: DURC, bonus edilizi 2026, reverse charge applicato, PSC/POS, stagionalità, rischio di credito nel settore.

**Totale catalogo**: 14 guide, ~226 lezioni, ~36 ore di video stimate.

## Prossimi passi (fuori dalla portata di questa sessione)

1. ~~Registrare `skilleasy.it`~~ — fatto, dominio già registrato dal cliente (§17.6 del documento di analisi). Verificare `.com` (risultava già occupato al 26/09/2026) e puntare il DNS all'hosting scelto.
2. Creare un repository dedicato per il sito (o spostare questa cartella lì) e collegarlo a Vercel/hosting come dominio a sé stante.
3. Girare le video lezioni dei due moduli pilota (script ricavabile direttamente dai titoli dei moduli in ciascuna pagina corso).
4. Collegare l'accesso ai corsi al sistema di autenticazione/pagamento già esistente su AnalisiEBusinessPlan.com (Supabase), come raccomandato al §8 — non ancora implementato qui: le pagine corso attuali non hanno ancora login, pagamento né generazione dell'attestato, sono landing page di presentazione/validazione dell'offerta.
5. Aprire il canale YouTube "SkillEasy" e iniziare la pubblicazione settimanale (§18.3).
