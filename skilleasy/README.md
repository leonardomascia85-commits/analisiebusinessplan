# SkillEasy — scaffold

Sito di "SkillEasy" (guide + corsi + attestati), dominio `skilleasy.it`. Il piano strategico completo (mercato, prezzi, roadmap) è nel repository `analisiebusinessplan`, file `ANALISI-PROGETTO-GUIDE-FORMAZIONE.md`.

**Stato**: sito statico (HTML/CSS puro, nessuna dipendenza, nessun build step) pronto per il deploy su Vercel, puntato sul dominio `skilleasy.it`.

## File

- `index.html` — homepage: pilastri, corsi pilota, catalogo completo (14 card cliccabili), cross-link a Studio Mascia e AnalisiEBusinessPlan.com.
- `prezzi.html` — pagina prezzi (rivista rispetto alla proposta iniziale del §9.1, su richiesta del cliente — prezzi più bassi, tutte le guide acquistabili singolarmente): Guida singola (29 € lancio / 49 € a regime, qualsiasi delle 14 guide), Bundle 5 Pilastri Base (129 €/179 €), Bundle Catalogo Completo (249 €/349 €, tutte le 14 guide una tantum), Abbonamento Accademia (149 €/anno lancio, 199 €/anno a regime, tutto il catalogo + guide future), FAQ.
- `grazie.html` — pagina di ringraziamento post-pagamento (redirect configurato nei Payment Link Stripe), evasione manuale finché i video non sono pronti.
- `privacy-policy.html`, `cookie-policy.html`, `termini-condizioni.html` — pagine legali minime ma reali (GDPR, cookie tecnici only, diritto di recesso contenuti digitali, natura non professionale/non abilitante dell'attestato). Contengono placeholder `[da inserire]` per PEC/email di contatto, da completare prima del lancio.
- `corso-regime-forfettario.html` — programma corso pilota A (Fisco, livello base — sottoinsieme introduttivo del pilastro Fisco).
- `corso-business-plan.html` — programma corso pilota B (Controllo di gestione + Finanza, livello avanzato, con cross-sell diretto al SaaS).
- `guida-fisco.html` — landing page completa del pilastro Fisco (20 lezioni, 3 livelli); `corso-regime-forfettario.html` resta come mini-corso introduttivo a parte.
- `guida-contabilita.html`, `guida-gestione-aziendale.html` — landing page complete dei pilastri Contabilità e Gestione aziendale.
- `guida-sicurezza-lavoro.html`, `guida-crisi-impresa.html`, `guida-welfare-aziendale.html`, `guida-agevolazioni-bandi.html`, `guida-privacy-gdpr.html`, `guida-iva-avanzata.html`, `guida-marketing-digitale.html`, `guida-passaggio-generazionale.html`, `guida-edilizia.html` — landing page delle 9 guide di approfondimento del catalogo esteso.
  (Il pilastro Controllo di gestione e il pilastro Programmazione e finanza non hanno una pagina propria separata: nel catalogo puntano entrambi a `corso-business-plan.html`, che li copre già combinati.)
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

## Stato del sito (27/09/2026)

Il sito ha ora una landing page dedicata per tutte le 14 guide del catalogo (più i 2 corsi pilota "starter"), una pagina prezzi con 4 livelli — Guida singola 29 €, Bundle 5 Pilastri 129 €, Bundle Catalogo Completo 249 €, Abbonamento Accademia 149 €/anno, tutti prezzi di lancio — e le 3 pagine legali minime richieste per vendere online (Privacy Policy, Cookie Policy, Termini e Condizioni). Il checkout viene gestito con Stripe Payment Links (nessun backend/carrello custom): un link per livello, collegati manualmente dal pulsante corrispondente in `prezzi.html` una volta creati sull'account Stripe già in uso per AnalisiEBusinessPlan.com. Evasione dei contenuti manuale via email finché le video lezioni non sono pronte (redirect post-pagamento su `grazie.html`).

## Prossimi passi (fuori dalla portata di questa sessione)

1. ~~Registrare `skilleasy.it`~~ — fatto, dominio già registrato dal cliente (§17.6 del documento di analisi). Verificare `.com` (risultava già occupato al 26/09/2026) e puntare il DNS all'hosting scelto.
2. Creare un repository dedicato per il sito (o spostare questa cartella lì) e collegarlo a Vercel/hosting come dominio a sé stante.
3. Completare i placeholder `[da inserire]` nelle pagine legali (PEC/email di contatto) prima di andare online.
4. Girare le video lezioni, partendo dai 5 pilastri base + Sicurezza sul lavoro (pubblico più ampio) — lo script di ogni modulo è già nel programma di ciascuna pagina `guida-*.html`/`corso-*.html`.
5. Collegare l'accesso ai corsi al sistema di autenticazione/pagamento già esistente su AnalisiEBusinessPlan.com (Supabase), come raccomandato al §8 — non ancora implementato qui: tutte le pagine corso/guida attuali sono landing page di presentazione/validazione dell'offerta, senza login, pagamento né generazione automatica dell'attestato.
6. Aprire il canale YouTube "SkillEasy" e iniziare la pubblicazione settimanale (§18.3).
