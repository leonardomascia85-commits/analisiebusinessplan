# Pronostici Calcio — area privata

Sezione separata dal resto del sito (business plan / bilanci). Vive in `/pronostici`
ed è protetta dallo stesso login già usato in `dashboard.html` (chiave
`abp_user` in `localStorage`): senza sessione valida si viene rimandati a
`../auth.html`.

## Struttura

- `index.html` — viewer: mostra le schedine della settimana selezionata,
  raggruppate per numero di eventi (livello di rischio), con probabilità
  stimata per evento e combinata per schedina, stato (in attesa/vinto/perso)
  ed esito reale una volta disponibile. Include anche una sezione "Storico"
  con il tasso di successo complessivo e per livello di rischio.
- `data/settimane.json` — indice delle settimane pubblicate (id, titolo, file).
  Le settimane vanno aggiunte in testa (più recente per prima).
- `data/<id>.json` — dati di una settimana. Schema:

```json
{
  "id": "2026-09-15",
  "titolo": "Turno 15–21 settembre 2026",
  "generato_il": "2026-09-13",
  "stato": "generazione_in_corso | pubblicata | completata",
  "campionati_coperti": ["Serie A", "Premier League", "La Liga", "Bundesliga"],
  "nota_dati": "eventuali esclusioni/limiti dei dati di questo turno",
  "schedine": [
    {
      "id": "L4-1",
      "livello_rischio": 4,
      "quota_combinata": 4.00,
      "probabilita_combinata": 0.25,
      "eventi": [
        {
          "partita": "Inter - Sassuolo",
          "campionato": "Serie A",
          "data": "2026-09-20T18:00:00+02:00",
          "mercato": "1X2 | Doppia chance | Under/Over 2.5",
          "pronostico": "1 | X2 | Over 2.5 | ...",
          "probabilita_stimata": 0.68,
          "quota_stimata": 1.47,
          "motivazione": "breve nota sui dati usati (forma, h2h, statistiche gol, quote di mercato)",
          "esito": "null | vinto | perso",
          "risultato_reale": "null | \"2-0\""
        }
      ]
    }
  ]
}
```

Stato di una schedina: **persa** se almeno un evento è perso, **vinta** se
tutti gli eventi sono vinti, **in attesa** altrimenti. Calcolato lato client,
non serve salvarlo.

## Regola di generazione settimanale

Per ogni settimana si preparano **16 schedine** (4 per ciascuno dei 4 livelli
di rischio: 4, 5, 6 e 7 eventi calcistici).

**Ogni pronostico deve partire da un'analisi statistica reale della squadra**
(non solo dalla quota di mercato): gol fatti e subiti (in totale, in casa,
in trasferta), forma recente, precedenti scontri diretti, assenze/infortuni,
classifica. La quota di mercato (se disponibile) è un riscontro aggiuntivo,
non l'unica base del pronostico.

Mercati utilizzabili (a scelta in base a cosa i dati supportano meglio per
quella partita, variandoli tra le schedine invece di ripetere sempre lo
stesso tipo):
- **1X2** — esito finale
- **Doppia chance** (1X, X2, 12)
- **Under/Over 2.5** gol (o altre soglie: 1.5, 3.5, se i dati sui gol lo
  giustificano)
- **Gol/No Gol (GG/NG, BTTS)** — entrambe le squadre segnano o no
- **Combo multi-mercato sulla stessa partita**, quando i dati lo
  supportano, es. "Over 2.5 + GG", "Under 2.5 + NG", "1 + Over 1.5",
  "Multigol 2-3 + NG" — utili per differenziare il rischio senza dover
  aggiungere un'altra partita

Non usare sempre lo stesso mercato per tutte le partite: scegliere quello
più supportato dai dati raccolti per quella specifica partita (es. due
squadre con pochi gol fatti/subiti → Under o combo Under+NG; due attacchi
prolifici e difese fragili → Over o GG).

> Nota: la richiesta iniziale indicava sia "10 schedine totali" sia "4 per
> ciascuno dei 4 livelli" (= 16). Si è adottata la seconda; va
> confermato/corretto con l'utente se cambia.

Ogni evento riporta una **quota stimata** (`quota_stimata`, derivata da quote
di mercato quando disponibili, altrimenti da una stima qualitativa) e la
probabilità implicita corrispondente (`probabilita_stimata` ≈
`1/quota_stimata`). La **quota combinata** della schedina (`quota_combinata`)
è il prodotto delle quote dei singoli eventi; la probabilità combinata è
`1/quota_combinata`.

**Principio prioritario: le schedine devono essere predisposte per una
vincita potenziale reale, non solo per centrare un numero.** La
progressione di quota qui sotto è una guida di massima, non un vincolo
rigido: non va mai raggiunta scegliendo pick contrarian (contro il
consenso di mercato senza un motivo statistico forte), pick a bassa
probabilità reale (< 0.55 circa) usati solo per aggiustare la quota
combinata, o eventi a bassa confidenza dati quando esiste un'alternativa
più solida sulla stessa partita (es. preferire la doppia chance al segno
secco se i dati non sostengono con forza un vincitore netto). Meglio una
schedina che si allontana leggermente dalla quota target ma con eventi
tutti realisticamente vincibili, che una che centra il numero includendo
1-2 pick deboli o rischiosi solo per matematica.

Le schedine vanno quindi costruite per **avvicinarsi quanto possibile a
una quota di vincita totale target, crescente sia tra le 4 schedine dello
stesso livello sia tra un livello di rischio e il successivo**, ma sempre
subordinatamente al criterio sopra. Schema adottato (4 schedine per
livello, quote target crescenti):

| Livello (eventi) | Quota #1 | Quota #2 | Quota #3 | Quota #4 |
|---|---|---|---|---|
| 4 | ~4  | ~9  | ~14 | ~18 |
| 5 | ~6  | ~11 | ~16 | ~20 |
| 6 | ~8  | ~13 | ~18 | ~22 |
| 7 | ~10 | ~15 | ~20 | ~24 |

La base di ogni livello (prima colonna) e l'incremento tra i livelli sono
un'estrapolazione di quanto indicato dall'utente per il livello 4 (4/9/14/18)
e per la prima schedina del livello 5 (6); va confermata o corretta se la
progressione voluta per i livelli 6 e 7 è diversa.

**Se il pool di partite con dati solidi (campionati principali) non basta
per avvicinarsi alla quota target di un livello senza pick deboli/contrarian:**
1. Prima cosa da fare: **allargare la ricerca** ad altri campionati/coppe
   con partite reali nella finestra e dati verificabili (es. Serie B,
   Championship inglese, Eredivisie, Primeira Liga, Süper Lig, Champions/
   Europa/Conference League, ecc.) per avere più partite solide da cui
   costruire quote più alte senza sacrificare la qualità.
2. Solo se anche allargando la ricerca non ci sono abbastanza pick solidi:
   **accettare una quota combinata più bassa del target** per quella
   schedina, dichiarandolo onestamente in `nota_dati`, piuttosto che
   includere pick deboli/contrarian solo per arrivare al numero.

## Flusso operativo

1. **Prima del turno**: ricerca reale (classifiche, forma, statistiche gol,
   assenze) sui campionati principali (Serie A, Premier League, La Liga,
   Bundesliga, Ligue 1, coppe europee se in calendario); se il numero di
   partite con dati solidi non è sufficiente per costruire le 16 schedine
   rispettando sia il principio di qualità sia la progressione di quota,
   allargare la ricerca ad altri campionati/coppe con partite reali nella
   finestra (vedi sopra) prima di rinunciare alla quota target. Poi
   generazione delle schedine e creazione di `data/<id>.json` con `stato:
   "pubblicata"`, più aggiornamento di `settimane.json`.
2. **Dopo le partite**: verifica dei risultati reali sulle fonti web,
   aggiornamento di `esito` e `risultato_reale` per ogni evento, e
   passaggio dello `stato` della settimana a `"completata"`.

Non esiste ancora un backend/DB per questi dati: sono file JSON statici
versionati in git. Ogni aggiornamento settimanale è un commit su questo
repo.
