# Scuola Numeri — scaffold

Prima versione tecnica del nuovo sito "Scuola Numeri" (guide + corsi + attestati), deciso in `../ANALISI-PROGETTO-GUIDE-FORMAZIONE.md` (§17-19).

**Stato**: bozza statica (HTML/CSS puro, nessuna dipendenza), pensata per essere migrata sul dominio proprio `scuolanumeri.it` non appena registrato — vive qui solo perché è l'unico repository disponibile in questa sessione.

## File

- `index.html` — homepage: pilastri, corsi pilota, cross-link a Studio Mascia e AnalisiEBusinessPlan.com.
- `corso-regime-forfettario.html` — programma corso pilota A (Fisco, livello base).
- `corso-business-plan.html` — programma corso pilota B (Controllo di gestione + Finanza, livello avanzato, con cross-sell diretto al SaaS).
- `guide/` — guide scritte, complete di spiegazione + esempio numerico per ogni lezione. Ogni lezione è anche lo script di base per la video lezione corrispondente. In lavorazione, una guida alla volta:
  - `contabilita-base-avanzato.md` — pilastro Contabilità, 20 lezioni su 3 livelli (Base/Intermedio/Avanzato), azienda di esempio ricorrente ("Verdi Srl") per continuità tra gli esempi.

## Prossimi passi (fuori dalla portata di questa sessione)

1. Registrare `scuolanumeri.it` e `.com` (§17.5 del documento di analisi).
2. Creare un repository dedicato per il sito (o spostare questa cartella lì) e collegarlo a Vercel/hosting come dominio a sé stante.
3. Girare le video lezioni dei due moduli pilota (script ricavabile direttamente dai titoli dei moduli in ciascuna pagina corso).
4. Collegare l'accesso ai corsi al sistema di autenticazione/pagamento già esistente su AnalisiEBusinessPlan.com (Supabase), come raccomandato al §8 — non ancora implementato qui: le pagine corso attuali non hanno ancora login, pagamento né generazione dell'attestato, sono landing page di presentazione/validazione dell'offerta.
5. Aprire il canale YouTube "Scuola Numeri" e iniziare la pubblicazione settimanale (§18.3).
