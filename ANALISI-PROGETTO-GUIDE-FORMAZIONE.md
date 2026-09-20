# Analisi Strategica Completa
## Piattaforma di guide e corsi video per la gestione d'impresa
**A cura di / brand: Dr. Leonardo Mascia**

Data analisi: 20 settembre 2026

---

## 0. Executive Summary

Il progetto consiste nel lanciare un secondo prodotto — complementare al SaaS già esistente **AnalisiEBusinessPlan.com** (analisi bilanci XBRL, rating bancabilità, business plan finanziario) — costituito da **guide pratiche + videocorsi** su 5 pilastri: gestione aziendale, contabilità, fisco, controllo di gestione, programmazione e finanza. Target duplice: **imprenditori** (decidono, pagano, vogliono risultati) e **dipendenti** (impiegati amministrativi/contabili, junior controller, che vogliono competenze spendibili). Distribuzione su **sito proprio** (canale a margine alto) e **Udemy** (canale di acquisizione a basso attrito, margine basso).

Punto di forza decisivo che questo progetto ha e la maggior parte dei concorrenti no: **esiste già un asset tecnico e di traffico** (analisiebusinessplan.com, con SEO impostata, autenticazione Supabase, sistema di pagamento, dashboard utente). Questo significa che la piattaforma corsi non parte da zero: può essere **una nuova sezione dello stesso ecosistema**, con lo stesso login, lo stesso brand, e un funnel naturale bidirezionale (chi fa un'analisi di bilancio scopre i corsi; chi segue un corso scopre il tool).

Le raccomandazioni chiave, sviluppate nel dettaglio sotto, sono:

1. **Non costruire una piattaforma LMS di terze parti come base principale.** Estendere l'infrastruttura esistente (Supabase auth + pagamenti già presenti in `auth.html`, `account.html`, `pagamento.html`, `dashboard.html`) per gestire l'accesso ai corsi. Risparmio: 50-180 $/mese di abbonamento LMS, controllo totale sui dati, un solo account per SaaS + formazione.
2. **Su Udemy vendere solo 1-2 corsi "civetta"** (lead generation a basso prezzo, alta visibilità) e mantenere l'offerta completa (percorsi, abbonamento) sul sito proprio, dove il margine è enormemente superiore (Udemy trattiene fino al 63-85% dei ricavi a seconda del canale di vendita, vedi §2.2 e §7).
3. Chiarire il concetto di **"video lezioni con 'brag'"**: non risulta esistere uno strumento con questo nome (verificato via ricerca web). È probabile un refuso vocale/di battitura. Propongo l'opzione più coerente con l'obiettivo (scalare la produzione video restando autorevoli) in §6, ma è una decisione che spetta a te confermare.
4. Il mercato è già presidiato (Udemy ha già corsi italiani di contabilità/fisco, Commercialista Telematico fa alta formazione B2B per professionisti a 990-1.250 €+IVA), ma **nessun player integra formazione + tool operativo sotto lo stesso brand personale**. Questo è il varco competitivo.

---

## 1. Il contesto: da tool SaaS a piattaforma con contenuti

Il repository attuale (`analisiebusinessplan.com`) è un prodotto maturo: analisi bilancio XBRL (€20), business plan finanziario (€149,99), sistema di autenticazione Supabase, dashboard utente, pagamenti, area guide/FAQ (`guide.html`), SEO strutturata (JSON-LD SoftwareApplication + FAQPage, sitemap, meta ottimizzati). Il pubblico attuale dichiarato nello schema.org è: **PMI, Commercialisti, Consulenti finanziari**.

Il nuovo progetto "guide + corsi" non è un prodotto scollegato: è **la naturale estensione content/education** dello stesso brand, con un pubblico più ampio (anche dipendenti, non solo decisori) e un obiettivo di **posizionamento personale** attorno a Dr. Leonardo Mascia, che oggi è "nascosto" dietro un brand di solo prodotto.

Implicazione strategica: la piattaforma formativa serve tre scopi contemporaneamente:
- **Monetizzazione diretta** (vendita corsi/abbonamenti, anche su Udemy).
- **Top of funnel per il SaaS** (chi impara a leggere un bilancio nel corso, poi usa il tool per farlo davvero).
- **Costruzione di un brand personale** che rende il prodotto meno sostituibile (le persone comprano da "Dr. Leonardo Mascia", non da un sito anonimo — leva difensiva contro la concorrenza low-cost).

---

## 2. Analisi di mercato

### 2.1 Il mercato e-learning in Italia

- Il mercato italiano dell'EdTech (hardware+software+servizi per la formazione digitale) vale circa **2,7 miliardi di €**, con una crescita stimata dell'**8,3%-11% nel periodo 2023-2027**.
- Nel 2024 il valore complessivo dell'e-learning in Italia ha **superato i 3 miliardi di €**, **+18% anno su anno**.
- **Il 68% delle aziende del settore punta al mercato B2B** (formazione aziendale), non più alla scuola: segnale che la domanda di formazione professionale continua (fisco, contabilità, gestione) è quella che cresce di più, e coincide esattamente con i 5 pilastri del progetto.
- Nel 2024 le startup EdTech italiane hanno raccolto **74 milioni di € di investimenti (+174% sul 2023)**: il settore è "caldo" e attrae capitali, ma questo significa anche più concorrenza in arrivo nei prossimi 12-24 mesi.

**Lettura per il progetto**: il momento è favorevole, la domanda B2B/professionale è quella trainante, ma la finestra di vantaggio "primo arrivato con un ecosistema integrato" si restringerà. Conviene muoversi in mesi, non in anni.

### 2.2 Il mercato Udemy: come funziona davvero l'economia

Punto critico che va capito **prima** di decidere quanto investire su Udemy:

- **Vendita marketplace organica** (lo studente trova il corso tramite ricerca/promozione di Udemy, senza tuo coupon): l'istruttore trattiene **37%**, Udemy il **63%**.
- **Vendita tramite link/coupon personale dell'istruttore**: l'istruttore trattiene **97%** — quasi tutto.
- **Inclusione in abbonamento Udemy Business/Personal Plan**: la quota istruttore è stata **tagliata tre volte** — dal 25% (2023) al 20% (gen. 2024), 17,5% (gen. 2025), fino al **15% da gennaio 2026**. Sempre più studenti Udemy consumano corsi via abbonamento, non acquisto singolo: questo significa che la parte "marketplace organica" del fatturato Udemy rende sempre meno nel tempo.

**Conseguenza pratica**: Udemy è un canale eccellente per *distribuzione, prova sociale (recensioni), traffico a costo zero e credibilità iniziale*, pessimo come motore di profitto se ci si affida a lui per la vendita organica o l'abbonamento. La strategia corretta (dettagliata al §7) è: portare traffico su Udemy con corsi-civetta, e **spingere l'acquirente interessato verso il sito proprio** per il percorso completo/abbonamento, dove si trattiene il 100% (o quasi, al netto del processore di pagamento).

### 2.3 Competitor diretti e indiretti (Italia)

| Competitor | Modello | Prezzo indicativo | Target | Gap che lascia scoperto |
|---|---|---|---|---|
| Corsi Udemy IT esistenti (es. "Apri la tua Partita IVA", "Master in Contabilità e Amministrazione", "Corso Contabilità da zero ad Avanzato") | Corso singolo, autoprodotto, spesso senza brand personale forte | Prezzo di listino alto, sconto quasi permanente (tipicamente 12-25 €) | Generalista, spesso principianti assoluti | Nessun collegamento con un tool operativo reale; nessun percorso strutturato multi-pilastro; autorevolezza percepita bassa (nessun credenziale visibile) |
| **Commercialista Telematico** (corsi/master/webinar) | Alta formazione B2B per **professionisti** (crediti ODCEC) | 990-1.250 €+IVA a percorso | Commercialisti, consulenti già del mestiere | Prezzo e taglio troppo "tecnico-normativo" per imprenditori/dipendenti non addetti ai lavori; nessuna offerta a basso costo d'ingresso |
| Fiscomania e siti simili (blog + guide gratuite + eventuali corsi) | Content marketing / lead gen verso consulenza | Guide gratuite, corsi a pagamento accessori | Chiunque cerchi informazioni fiscali via Google | Contenuto spesso solo scritto, poco strutturato in percorso, poca proposta video/didattica |
| Canali YouTube di commercialisti/influencer finance | Gratuito, monetizzato con ads/affiliazioni/corsi propri | — | Ampio, spesso giovane | Contenuto frammentato, non strutturato, difficile da seguire come percorso |

**Conclusione competitiva**: lo spazio libero è **"formazione pratica strutturata, con un volto e un nome riconoscibile, collegata a uno strumento che permette di applicare subito quanto imparato"**. Nessuno dei player sopra ha questa combinazione.

---

## 3. Posizionamento e brand: Dr. Leonardo Mascia

Mettere il tuo nome come creatore non è solo un credit: è la leva di differenziazione più forte disponibile, perché:

- I concorrenti Udemy generalisti non hanno un volto riconoscibile associato a competenza verificabile.
- I portali B2B (Commercialista Telematico) parlano a professionisti, non a imprenditori/dipendenti: c'è spazio per un posizionamento "il commercialista che ti spiega le cose come stanno, in modo pratico, senza tecnicismi".
- Il brand personale rende il prodotto **difendibile**: un corso anonimo si copia, una relazione di fiducia con una persona no.

**Elementi di posizionamento da definire subito (servono per ogni pagina del sito, ogni descrizione corso, ogni video):**
- Una frase di posizionamento unica, es.: *"Le competenze di gestione, fisco e finanza che nessuno ti ha mai spiegato in modo semplice — da chi i bilanci li analizza ogni giorno."*
- Prova di autorità: titolo professionale, esperienza, eventualmente numero di bilanci/business plan analizzati tramite la piattaforma esistente (dato di traffico convertito in credibilità: "Ho aiutato X aziende ad analizzare il proprio bilancio").
- Coerenza visiva tra analisiebusinessplan.com e la nuova sezione corsi (stessa palette, stesso font Fraunces/Inter già in uso).

---

## 4. Pubblico target: due segmenti, due promesse diverse

Non trattarli come lo stesso pubblico con prezzo diverso: cambiano **motivazione d'acquisto**, **obiezioni**, **canale di scoperta** e spesso **chi paga**.

| | Imprenditori | Dipendenti |
|---|---|---|
| Motivazione | Decidere meglio, non farsi "raccontare le cose" dal commercialista, controllare i numeri della propria azienda | Avanzamento di carriera, competenze spendibili, sicurezza nel ruolo (es. impiegato amministrativo che deve capire un bilancio) |
| Obiezione principale | "Non ho tempo", "il mio commercialista se ne occupa già" | "Costa troppo per uno stipendio da dipendente", "lo trovo gratis su YouTube" |
| Prezzo psicologico | Accetta prezzo più alto se vede ROI diretto (decisioni migliori = risparmio/guadagno) | Sensibile al prezzo, preferisce Udemy o corsi singoli economici; l'abbonamento premium ha meno presa salvo se paga l'azienda (formazione finanziata, fondi interprofessionali) |
| Canale di scoperta | LinkedIn, referral da altri imprenditori, ricerca Google mirata (es. "come leggere il bilancio della mia azienda") | Udemy, YouTube, ricerca generica ("corso contabilità base") |
| Prodotto ideale | Percorso "Controllo di gestione per imprenditori", abbonamento premium con aggiornamenti normativi | Corso singolo "Contabilità da zero", eventualmente con badge/certificato spendibile nel CV |

**Implicazione sul catalogo**: servono percorsi con framing diverso anche se il contenuto tecnico si sovrappone (es. "Leggere il bilancio" per l'imprenditore che deve decidere, vs "Contabilità generale" per il dipendente che deve saperla fare).

---

## 5. Architettura dei contenuti: i 5 pilastri

Proposta di struttura a catalogo (da validare con keyword research prima della produzione):

1. **Gestione aziendale** — organizzazione, delega, KPI operativi, gestione del personale base, contrattualistica commerciale essenziale.
2. **Contabilità** — partita doppia, bilancio CE/SP, IVA, fatturazione elettronica, adempimenti base.
3. **Fisco** — regimi fiscali (forfettario vs ordinario), scadenze, deduzioni/detrazioni, IRES/IRPEF base, aggiornamento annuale Legge di Bilancio.
4. **Controllo di gestione** — budget, break-even, indici di bilancio, cash flow, KPI, il collegamento naturale col tool di business plan esistente.
5. **Programmazione e finanza** — business plan, finanza aziendale, richiesta di finanziamenti/DSCR/rating bancabilità (qui l'integrazione con AnalisiEBusinessPlan.com è diretta e immediata).

Ogni pilastro va declinato in: **1 corso "fondamenta" (per dipendenti, prezzo basso, anche su Udemy)** + **1 percorso avanzato/applicato (per imprenditori, solo sito proprio, prezzo alto o incluso in abbonamento)**.

---

## 6. Format didattico: guide scritte + video — e il nodo "Brag"

Hai scritto che le video lezioni "dovrai farle con 'brag'". Ho verificato: **non esiste uno strumento noto con questo nome** nel mercato della produzione video AI/e-learning (ho controllato le fonti di settore 2026). Ipotesi più probabili:
- Refuso di dettatura vocale per il nome di un tool diverso (es. HeyGen, Bard/Gemini, o un tool meno noto).
- Un tool interno/di terze parti che non è emerso nelle ricerche pubbliche.

**Prima di procedere alla produzione video ho bisogno che tu mi confermi a cosa ti riferisci**, perché cambia sostanzialmente budget e workflow. Nel frattempo, ecco l'opzione che consiglio in assenza di chiarimento, basata sui dati di mercato raccolti:

**Approccio ibrido consigliato:**
- **Video "di fiducia" girati con volto reale** (intro dei corsi, spiegazioni di concetti-chiave, sezione "chi sono"): fondamentali per un brand personale come il tuo — un avatar AI abbassa la percezione di autenticità proprio nel settore (fisco/finanza) dove la fiducia è il prodotto.
- **Video "operativi" scalabili** (schermate, tutorial, esempi numerici, aggiornamenti normativi frequenti) prodotti con **screen recording + voce reale** (più economico, più veloce, non richiede repriese di persona ogni volta che cambia una norma) oppure, se il volume di contenuto è molto alto, con **avatar AI** (HeyGen, Synthesia, Colossyan — tutti tra 19 e 89 $/mese nel 2026, con limiti di minuti mensili) solo per contenuti secondari (es. FAQ, micro-lezioni).
- Editing e repurposing (video lungo → clip social) con strumenti tipo Descript, utile anche per la promozione su LinkedIn/YouTube/Instagram.

Se "brag" indica uno strumento specifico che avevi in mente, fammelo sapere e aggiorno questa sezione con un piano di produzione preciso (costi, tempi per video, workflow).

---

## 7. Canali di vendita: sito proprio + Udemy — strategia "hub & spoke"

Dato quanto emerso al §2.2, la strategia corretta non è "vendere ovunque allo stesso modo", ma:

- **Udemy = spoke (raggio), non hub.** Caricare **1-2 corsi introduttivi** per pilastro più richiesto (es. "Fisco e Partita IVA per chi inizia", "Leggere un bilancio in 2 ore"), a prezzo di listino alto ma consapevoli che Udemy scontifica quasi sempre (lo studente medio paga 12-25 €). Obiettivo di questi corsi: **recensioni, iscritti, visibilità, non profitto**. Ogni corso Udemy deve avere, nelle prime lezioni e nella descrizione, un rimando esplicito (link, non violando le policy Udemy che vietano di reindirizzare fuori piattaforma nei contenuti — verificare policy aggiornata) al sito proprio per il percorso completo.
- **Sito proprio (analisiebusinessplan.com o sotto-dominio/sezione dedicata) = hub.** Qui vivono: percorsi completi, abbonamento premium, community/aggiornamenti, e soprattutto **il 100% del margine** (meno commissioni di pagamento, tipicamente 1,5-3%).
- **Cross-sell strutturale**: chi compra un corso di "Controllo di gestione" riceve uno sconto/voucher per il business plan a pagamento del SaaS esistente, e viceversa chi genera un business plan riceve un invito al corso correlato. Questo è il vero vantaggio competitivo che nessun concorrente ha.

---

## 8. Tecnologia: non serve un nuovo LMS da zero

Confronto piattaforme LMS 2026 (per completezza, nel caso si scelga comunque questa via):

| Piattaforma | Prezzo indicativo 2026 | Nota |
|---|---|---|
| Kajabi | da 179 $/mese | Marketing/funnel avanzati, ma costoso e con limiti su prodotti/contatti nel piano base |
| Teachable | Piano entry con **7,5% di commissione per vendita** (piano free rimosso) | Fee per vendita che si somma al costo fisso |
| Thinkific | 49-99 $/mese | Solido, richiede integrazioni esterne per funzionalità avanzate |
| Podia | da 23 $/mese | Più economico, meno funzionalità enterprise |

**Raccomandazione**: non conviene aggiungere un ulteriore abbonamento SaaS esterno (50-180 $/mese + eventuali fee per vendita) quando **l'infrastruttura esiste già nel repository**: autenticazione Supabase (`auth.html`), area utente (`account.html`, `dashboard.html`), pagamento (`pagamento.html`). Estendere questo sistema per:
- gestire l'accesso ai corsi (flag "corsi acquistati" nel record utente Supabase, già presente lo schema in `supabase-schema.sql`);
- ospitare i video su un provider a basso costo pensato per streaming protetto (es. Bunny.net Stream, Mux, o Cloudflare Stream — tutti nell'ordine di pochi centesimi/€ per GB, molto più economici di un LMS completo per chi ha già il resto);
- riusare template/stile HTML già esistenti per le pagine corso.

Vantaggi: **zero canone LMS mensile**, **un solo account cliente** per SaaS e formazione (aumenta il lifetime value visibile), **controllo totale sui dati** (nessuna dipendenza da policy di terze parti).

Costo stimato di questa via: sviluppo iniziale (poche settimane, riusando l'80% dell'infrastruttura) + hosting video (~10-40 €/mese a basso volume) invece di 50-180 $/mese di LMS a vita.

---

## 9. Pricing e modello di monetizzazione

Proposta a 3 livelli sul sito proprio:

1. **Corso singolo**: 39-79 € (dipendenti/entry level) — accesso permanente a un pilastro.
2. **Percorso completo per pilastro**: 129-249 € (imprenditori) — più esercitazioni, template Excel, checklist scaricabili.
3. **Abbonamento "Accademia" mensile/annuale**: accesso a tutta la libreria + aggiornamenti normativi continui + eventuale sconto sul SaaS di business plan. Prezzo indicativo 19-29 €/mese o 149-249 €/anno (ancoraggio simile ai prezzi Commercialista Telematico ma per un pubblico più ampio e a prezzo molto più accessibile — differenziazione chiara).

Su Udemy: prezzo di listino massimo consentito dalla piattaforma per il segmento (spesso 84,99-94,99 $), sapendo che il prezzo reale pagato sarà quasi sempre scontato dalla piattaforma stessa.

---

## 10. SEO e content marketing

Il sito esistente ha già una base SEO tecnica solida (JSON-LD, sitemap, meta, canonical). Da estendere:

- **Pagine pilastro** (una per ciascuno dei 5 temi) come hub di contenuto SEO, con FAQPage/HowTo schema come già fatto in `guide.html`.
- **Blog/guide scritte** targettizzate su query informazionali ("come si calcola il DSCR", "differenza regime forfettario e ordinario", "come leggere un bilancio") — le stesse query già intercettate dal FAQ del SaaS possono diventare landing per i corsi.
- **Backlink e autorevolezza**: guest post o interviste su testate di settore (PMI.it, FiscoOggi, Ninja Marketing per la parte business), leva naturale del posizionamento personale di Dr. Mascia.
- **YouTube come secondo motore di ricerca**: pubblicare estratti dei corsi in versione gratuita breve, con call-to-action al sito.

---

## 11. Funnel di marketing

```
Consapevolezza          Interesse              Conversione            Fidelizzazione
────────────────        ────────────────       ────────────────       ────────────────
YouTube/LinkedIn         Lead magnet            Corso Udemy            Abbonamento
SEO organico       →     (guida PDF/            economico       →     Accademia
Udemy corso civetta      mini-corso gratuito)   o corso sito                +
                                                                        Cross-sell
                                                                        verso il SaaS
```

Canali prioritari per un professionista come target imprenditori: **LinkedIn** (contenuti pratici, case study numerici) e **email marketing** (newsletter con aggiornamenti fiscali — alto valore percepito, ricorrente). Per il segmento dipendenti: **YouTube Shorts/TikTok/Instagram Reels** con micro-lezioni.

---

## 12. Piano finanziario indicativo (Anno 1)

Stime illustrative, da validare con i tuoi costi reali; l'obiettivo è dare un ordine di grandezza per decidere quanto investire.

**Costi stimati Anno 1:**
| Voce | Stima annua |
|---|---|
| Hosting video (Bunny/Mux, basso volume iniziale) | 200-500 € |
| Strumenti AI video (se usati per contenuti secondari) | 300-700 € |
| Attrezzatura ripresa base (microfono, luce, eventuale telecamera) | 300-800 € (una tantum) |
| Sviluppo estensione area corsi sull'infrastruttura esistente | Tempo interno o 1.500-4.000 € se esternalizzato |
| Marketing (ads LinkedIn/Meta, se attivati) | Variabile, 0-500 €/mese |
| **Totale indicativo primo anno (senza ads aggressive)** | **~3.000-7.000 €** |

**Scenari di ricavo Anno 1** (assumendo produzione di 3-5 percorsi completi + 2 corsi Udemy nei primi 6-9 mesi):

| Scenario | Vendite sito proprio | Vendite/royalty Udemy | Ricavo annuo indicativo |
|---|---|---|---|
| Conservativo | 50 percorsi × 150 € = 7.500 € | 300 vendite × 15 € netti = 4.500 € | ~12.000 € |
| Base | 150 percorsi × 150 € + 30 abbonamenti annui × 200 € = 28.500 € | 800 vendite × 15 € = 12.000 € | ~40.000 € |
| Ottimistico (con cross-sell SaaS attivo e SEO a regime) | 400 percorsi/abbonamenti × media 180 € = 72.000 € | 2.000 vendite × 15 € = 30.000 € | ~100.000 € |

Questi numeri **non sono una previsione garantita**, ma un modello per capire dove si trova il punto di pareggio (nello scenario conservativo il progetto è già in pareggio nel primo anno) e per fissare obiettivi trimestrali misurabili.

---

## 13. Roadmap operativa

**Fase 0-3 mesi — Fondamenta**
- Confermare il tool/metodo video ("brag" — vedi §6) e produrre i primi 2 corsi pilota (1 per imprenditori, 1 per dipendenti).
- Costruire la pagina/sezione corsi sul sito esistente riusando auth + pagamenti Supabase.
- Definire il posizionamento personale di Dr. Leonardo Mascia (bio, foto/video di presentazione, claim).
- Pubblicare 1 corso su Udemy come test del mercato e raccolta recensioni.

**Fase 3-6 mesi — Catalogo e canali**
- Completare almeno un percorso per ciascuno dei 5 pilastri.
- Attivare newsletter/lead magnet e presenza LinkedIn regolare.
- Lanciare l'abbonamento "Accademia".
- Impostare cross-sell automatico con il SaaS (banner/voucher).

**Fase 6-12 mesi — Scala**
- Valutare 1-2 corsi Udemy aggiuntivi in base ai dati di conversione ottenuti.
- Introdurre contenuti aggiornati annualmente (Legge di Bilancio, scadenze fiscali) come motore di rinnovo abbonamento.
- Valutare partnership (associazioni di categoria, commercialisti, fondi interprofessionali per la formazione finanziata alle aziende — canale B2B ad alto valore).

---

## 14. Rischi e mitigazioni

| Rischio | Mitigazione |
|---|---|
| Contenuto fiscale/normativo che cambia ogni anno (Legge di Bilancio) e rende i corsi obsoleti | Prevedere aggiornamento annuale strutturale, comunicarlo come valore dell'abbonamento ("sempre aggiornato") |
| Percezione di dare "consulenza" fiscale personalizzata con rischio di responsabilità professionale | Disclaimer chiaro ovunque: contenuto formativo/informativo, non consulenza personalizzata; eventualmente far rivedere i disclaimer da un legale |
| Concorrenza gratuita (YouTube, blog) che eroda la domanda per contenuti base | Differenziare sul "percorso strutturato + strumento operativo", non sulla singola informazione (che è effettivamente reperibile gratis) |
| Dipendenza da Udemy per traffico, con quote di ricavo in calo strutturale (§2.2) | Trattare Udemy come canale di acquisizione, non di monetizzazione principale, fin dall'inizio (non aspettare di scoprirlo dopo) |
| Aspetti fiscali della vendita di prodotti digitali (regime forfettario ha soglie, vendite a privati UE su Udemy comportano gestione IVA OSS/VIES per Udemy stesso come piattaforma, ma le vendite dirette sul sito proprio a consumatori privati richiedono attenzione alle regole IVA sui servizi digitali) | Verificare con il proprio commercialista (o te stesso, in quanto tale) il corretto inquadramento fiscale prima del lancio delle vendite dirette |

---

## 15. KPI da monitorare da subito

- Tasso di conversione visitatore → lead (email) sulla pagina corsi.
- Tasso di conversione lead → cliente pagante.
- Costo di acquisizione cliente (CAC) per canale (Udemy vs organico vs ads).
- Tasso di completamento corso (proxy di qualità percepita e di probabilità di recensione/passaparola).
- % di clienti SaaS che comprano un corso e viceversa (misura diretta della sinergia che è il vero vantaggio competitivo del progetto).
- Revenue per canale (sito proprio vs Udemy) — per verificare nel tempo che il mix resti a favore del sito proprio come da strategia.

---

## 16. Decisioni che servono da te per procedere

1. **Conferma il significato di "brag"** (§6) — o dimmi se intendevi un altro strumento/metodo per le video lezioni, così definisco il piano di produzione preciso.
2. **Dominio/branding**: sezione dentro analisiebusinessplan.com (es. `/accademia` o sottodominio `corsi.analisiebusinessplan.com`) o sito/brand separato per Dr. Leonardo Mascia? Ha impatto SEO e su come costruire l'identità personale.
3. **Priorità di produzione**: quale dei 5 pilastri vuoi lanciare per primo come pilota?

Appena mi confermi questi tre punti posso passare dalla fase di analisi alla realizzazione tecnica (struttura del sito, pagine, sistema di accesso ai corsi).

---

## 17. Naming del sito e verifica parole chiave (aggiornamento)

**Nota metodologica onesta**: in questo ambiente non ho accesso diretto a Google Keyword Planner, SEMrush o Ahrefs (dati di volume di ricerca esatti). Ho quindi verificato la domanda in due modi indiretti ma concreti:
1. **Densità competitiva reale**: quante aziende/contenuti dedicati esistono già per una query (query molto presidiate = domanda alta e validata dal mercato).
2. **Verifica live di occupazione dominio** (risoluzione DNS + HTTP reale, non solo menzioni sui motori di ricerca) per ogni nome candidato — questo ha permesso di scartare nomi che sembravano liberi da una semplice ricerca ma che in realtà sono già siti attivi (es. *numerichiari.it*, live e funzionante, non emerso nella ricerca web).

Per numeri di ricerca esatti (utile prima di investire in contenuti SEO pesanti), il passo successivo resta Google Keyword Planner (gratuito, basta un account Google Ads senza attivare campagne) o Google Trends per confrontare l'andamento tra varianti.

### 17.1 Domanda per cluster di parole chiave (evidenza qualitativa raccolta)

| Cluster | Segnali di domanda osservati |
|---|---|
| **Fisco / Partita IVA / regime forfettario** | Domanda molto alta e continua: nel solo Q1 2026 sono state aperte **184.895 nuove partite IVA**, il **56,3%** in regime forfettario. Decine di siti (partitaiva.it, fiscoetasse.com, flextax.it, agnesefebbraro.it) competono ogni anno per l'aggiornamento normativo — segnale di ricerca ricorrente e stagionale (picchi a inizio anno e vicino alle scadenze). |
| **Contabilità (corso/come si fa)** | Alta: decine di scuole (Corsidia, UniD Formazione, Accademia Domani, Accademia Telematica) vendono corsi simili da anni — mercato validato, ma affollato lato "corso base per principianti". |
| **Come leggere/interpretare un bilancio** | Domanda medio-alta, molto ricorrente tra imprenditori non tecnici; competizione già presente (FareNumeri, Corsi.it, Meliusform) ma nessuno lo lega a uno strumento operativo — conferma il varco individuato al §2.3. |
| **Controllo di gestione (corso)** | Domanda medio-alta, ma quasi tutta l'offerta è B2B/master costosi (Alma Laboris, Meliusform, ManagerLab) — poco per il singolo imprenditore/dipendente a prezzo accessibile. |
| **Business plan (corso/guida)** | Domanda alta e diretta sinergia con il SaaS esistente: è l'unico cluster dove hai già traffico e autorità comprovata (analisiebusinessplan.com). |
| **Gestione aziendale (corso online)** | Domanda alta ma molto generica/dispersiva: utile come contenuto "ombrello" più che come query di conversione diretta. |

**Implicazione per il catalogo**: le query più "calde e ricorrenti" restano fisco/partita IVA (stagionali, alto volume) e business plan (dove hai già autorità). Consiglio di lanciare il corso pilota su uno di questi due cluster, non su "gestione aziendale" (troppo generico per convertire bene in fase iniziale).

### 17.2 Nomi verificati per il sito/brand

Ho controllato la disponibilità reale (risoluzione DNS/HTTP, non solo assenza dai risultati di ricerca) per una rosa di candidati coerenti col posizionamento (pratico, per imprenditori e dipendenti, legato ai 5 pilastri):

**Nomi già occupati (da scartare) — utile saperlo anche solo per non confonderti con la concorrenza:**
- `numerichiari.it/.com` — sito attivo (hosting Aruba)
- `fiscopratico.eu` — piattaforma esistente di Euroconference per professionisti (anche se `fiscopratico.it` risulta libero, il nome è già un marchio riconosciuto nel settore fiscale: **da evitare** per rischio di confusione)
- `accademiadimpresa.it/.com` — scuola di formazione già esistente e attiva
- `farenumeri.it` — content site già attivo sul tema "leggere il bilancio"
- `bilanciofacile.it` e `bilanciofacile.cloud` — gestionale PMI già attivo
- `contabilitafacile.it/.com`, `fiscosemplice.it/.com`, `gestionesemplice.it`, `gestionepratica.it/.com`, `fiscoinchiaro.it/.com`, `contabilitapratica.it`, `imprenditoreinformato.it` — tutti già occupati
- **`leonardomascia.com`** — ⚠️ **occupato da un omonimo**: un autore (Leonardo Mascia, scrittore di "The Golden Cage", tematiche di lavoro/burocrazia/integrazione europea) ha già questo dominio esatto, con sito multilingua IT/EN/FR. Usare il tuo nome e cognome nudi come dominio `.com` creerebbe confusione con quest'altra persona. La versione `.it` (`leonardomascia.it`) risulta invece libera.

**Nomi verificati liberi (candidati validi):**

| Candidato | Perché funziona | Perché no/attenzione |
|---|---|---|
| **`impresainpratica.it` e `.com`** (entrambi liberi) | Rispecchia esattamente la promessa del brief ("devono essere pratiche"), copre tutti e 5 i pilastri senza restringersi a uno, funziona sia per imprenditori sia per dipendenti, facile da scrivere/ricordare, ottimo anche come nome corso su Udemy | Nome descrittivo, non include il tuo nome — l'autorevolezza personale va costruita nel sottotitolo/branding ("con Dr. Leonardo Mascia") |
| `numeridimpresa.it/.com` (liberi) | Buon richiamo a contabilità/fisco/finanza, semplice | Meno adatto per "gestione aziendale" in senso ampio |
| `controlloimpresa.it/.com` (liberi) | Pulito, professionale | Suona più legato al solo pilastro "controllo di gestione" |
| `accademiaimpresa.it/.com` (liberi) | Pattern riconoscibile ("accademia + tema") | Troppo simile a `accademiadimpresa.it` già esistente e attivo: rischio concreto di confusione, sconsigliato |
| `dottormascia.it` / `masciaformazione.it` (liberi) | Massima coerenza col brand personale, nessun rischio di omonimia | "Accademia/formazione + cognome" è un pattern più debole lato SEO generalista (poche persone cercano "dottor mascia" prima di conoscerti) |
| `leonardomascia.it` (libero) | Dominio personale pulito in versione italiana | Rischio di confusione futura con l'omonimo autore se lui espande la presenza IT; meglio se accompagnato sempre dal titolo "Dr." nei contenuti |

### 17.3 Raccomandazione

**Nome del sito: "Impresa in Pratica"**, dominio `impresainpratica.it` (principale) con `impresainpratica.com` acquistato in parallelo per protezione del marchio e reindirizzato allo stesso sito. Payoff/sottotitolo per portare avanti la strategia di personal branding del §3: **"Impresa in Pratica — le guide di Dr. Leonardo Mascia"**.

Perché questa combinazione e non il nome proprio da solo: hai il meglio di entrambi i mondi — un nome di dominio descrittivo e facile da posizionare su query commerciali generiche ("gestione pratica", "guide pratiche impresa"), mantenendo comunque la faccia e il nome di Dr. Leonardo Mascia come garanzia di autorevolezza in ogni pagina, corso e video (coerente con quanto raccomandato al §3 sul valore del brand personale).

**Prossimo passo pratico**: registrare `impresainpratica.it` e `.com` quanto prima — i controlli sopra sono un'istantanea di oggi, un nome libero può essere acquistato da chiunque da un momento all'altro. Consiglio anche una verifica veloce sul registro marchi UIBM (uibm.mise.gov.it) prima di investire in loghi/materiali, cosa che va oltre la disponibilità del dominio e che non ho potuto controllare da qui.

---

## Fonti

- [L'e-learning in Italia nel 2025 e 2026: analisi di un settore in piena espansione — Business Intelligence Group](https://www.businessintelligencegroup.it/e-learning-italia-2025-2026-analisi-mercato/)
- [EdTech in Italia: lo stato del mercato a metà 2026 — EduNews24](https://edunews24.it/tecnologia/edtech-in-italia-lo-stato-del-mercato-a-met-2026)
- [Is Udemy Good for Instructors in 2026? Real Numbers — FreshLearn](https://freshlearn.com/blog/udemy-good-for-instructors/)
- [Udemy Earns More, Pays Instructors Less — Class Central](https://www.classcentral.com/report/udemy-broken-promise-instructor-payouts/)
- [Udemy Pricing 2026: What Instructors Keep on Every Sale — Ruzuku](https://www.ruzuku.com/compare/udemy-pricing)
- [Instructor revenue share – Udemy (supporto ufficiale)](https://support.udemy.com/hc/en-us/articles/229605008-Instructor-revenue-share)
- [Corsi online in Contabilità e Registrazione contabile — Udemy IT](https://www.udemy.com/it/courses/finance-and-accounting/accounting-bookkeeping/)
- [Corsi Online in Diretta | Commercialista Telematico](https://www.commercialistatelematico.com/categoria/videocorsi/corsi-online-in-diretta)
- [Online Course Platform Pricing 2026: Thinkific vs Kajabi vs Teachable vs Podia vs Udemy](https://ddiy.co/pricing-plan-guide-course-platforms/)
- [Kajabi vs. Teachable (2026): Honest comparison — Podia](https://www.podia.com/articles/kajabi-vs-teachable)
- [HeyGen vs Synthesia (2026): Pricing & Features — Colossyan](https://www.colossyan.com/posts/heygen-vs-synthesia/)
- [Best AI Video Generators 2026: 12 Tools Tested & Ranked — HeyGen](https://www.heygen.com/blog/best-ai-video-generators-tested-and-reviewed)
- [Regime forfettario 2026, dalle tasse ai contributi — Partitaiva.it](https://www.partitaiva.it/regime-forfettario-2026-guida/)
- [Aperture P. IVA Q1 2026: perché il forfettario resta popolare](https://www.comunicati-stampa.biz/2026/09/nuove-partite-iva-in-crescita-quasi-185mila-aperture-nel-primo-trimestre-2026/)
- Verifica disponibilità nomi dominio: risoluzione DNS/HTTP diretta eseguita il 20/09/2026 (non un servizio esterno, dato soggetto a cambiare nel tempo)
