# Scuola Numeri — scaffold

Prima versione tecnica del nuovo sito "Scuola Numeri" (guide + corsi + attestati), deciso in `../ANALISI-PROGETTO-GUIDE-FORMAZIONE.md` (§17-19).

**Stato**: bozza statica (HTML/CSS puro, nessuna dipendenza), pensata per essere migrata sul dominio proprio `scuolanumeri.it` non appena registrato — vive qui solo perché è l'unico repository disponibile in questa sessione.

## File

- `index.html` — homepage: pilastri, corsi pilota, cross-link a Studio Mascia e AnalisiEBusinessPlan.com.
- `corso-regime-forfettario.html` — programma corso pilota A (Fisco, livello base).
- `corso-business-plan.html` — programma corso pilota B (Controllo di gestione + Finanza, livello avanzato, con cross-sell diretto al SaaS).
- `guide/` — guide scritte, complete di spiegazione + esempio numerico per ogni lezione. Ogni lezione è anche lo script di base per la video lezione corrispondente. In lavorazione, una guida alla volta:
  - `contabilita-base-avanzato.md` — pilastro Contabilità, 22 lezioni su 3 livelli (Base/Intermedio/Avanzato), con i riferimenti ai principi contabili OIC (11, 12, 13, 15, 16, 19, 25, 31) integrati lezione per lezione, azienda di esempio ricorrente ("Verdi Srl") per continuità tra gli esempi.
  - `fisco-base-avanzato.md` — pilastro Fisco, 20 lezioni su 3 livelli. Due persone di esempio: Marco Bruni (freelance, Partita IVA/regime forfettario) per Base/Intermedio, Verdi Srl (stessa azienda della guida Contabilità) per IRES/IRAP in Intermedio/Avanzato. Copre regime forfettario, coefficienti di redditività, IRPEF/IRES/IRAP con le aliquote 2026 verificate via ricerca web, deduzioni vs detrazioni, ravvedimento operoso, scelta della forma giuridica, controlli fiscali e pianificazione fiscale lecita. Contiene un avviso esplicito che aliquote/soglie vanno riverificate ogni anno (la Legge di Bilancio le cambia) prima di qualunque uso reale.
  - `gestione-aziendale-base-avanzato.md` — pilastro Gestione aziendale, 20 lezioni su 3 livelli. Continua a seguire Verdi Srl (stessa azienda delle guide precedenti) mentre cresce da impresa gestita da una sola persona a impresa organizzata. Copre organigramma, matrice RACI, delega, obiettivi SMART, riunioni efficaci, forme contrattuali di lavoro, CCNL, costo del lavoro reale (con aliquote INPS e agevolazioni apprendistato 2026 verificate), selezione del personale, KPI operativi, contrattualistica commerciale essenziale (clausola risolutiva espressa, riserva di proprietà, contratto di agenzia), secondo livello di responsabilità ed errori comuni delle PMI italiane.

## Prossimi passi (fuori dalla portata di questa sessione)

1. Registrare `scuolanumeri.it` e `.com` (§17.5 del documento di analisi).
2. Creare un repository dedicato per il sito (o spostare questa cartella lì) e collegarlo a Vercel/hosting come dominio a sé stante.
3. Girare le video lezioni dei due moduli pilota (script ricavabile direttamente dai titoli dei moduli in ciascuna pagina corso).
4. Collegare l'accesso ai corsi al sistema di autenticazione/pagamento già esistente su AnalisiEBusinessPlan.com (Supabase), come raccomandato al §8 — non ancora implementato qui: le pagine corso attuali non hanno ancora login, pagamento né generazione dell'attestato, sono landing page di presentazione/validazione dell'offerta.
5. Aprire il canale YouTube "Scuola Numeri" e iniziare la pubblicazione settimanale (§18.3).
