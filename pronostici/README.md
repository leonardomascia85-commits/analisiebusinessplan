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
  "schedine": [
    {
      "id": "L4-1",
      "livello_rischio": 4,
      "probabilita_combinata": 0.35,
      "eventi": [
        {
          "partita": "Inter - Sassuolo",
          "campionato": "Serie A",
          "data": "2026-09-20T18:00:00+02:00",
          "mercato": "1X2 | OU25 | GGNG | DC",
          "pronostico": "1 | X | 2 | Over 2.5 | Under 2.5 | GG | NG | 1X | X2 | 12",
          "probabilita_stimata": 0.68,
          "motivazione": "breve nota sui dati usati (forma, h2h, statistiche gol)",
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

Per ogni settimana si preparano schedine su 4 livelli di rischio crescente
(4, 5, 6 e 7 eventi calcistici), usando solo mercati da statistiche di
squadra: 1X2, Under/Over 2.5 gol, Gol/No Gol (BTTS), doppia chance.

> Nota: la richiesta iniziale indicava sia "10 schedine totali" sia "4 per
> ciascuno dei 4 livelli" (= 16). In assenza di una scelta esplicita si è
> adottata la seconda (16 schedine, 4 per livello); va confermato/corretto
> con l'utente e questo file va aggiornato di conseguenza se cambia.

Ogni evento riporta una probabilità stimata individuale (da forma recente,
classifica, h2h, medie gol); la probabilità combinata della schedina è il
prodotto delle probabilità dei singoli eventi (assumendo indipendenza
approssimata), eventualmente arrotondata per difetto per prudenza.

## Flusso operativo

1. **Prima del turno**: ricerca reale (classifiche, forma, statistiche gol,
   assenze) sui campionati principali (Serie A, Premier League, La Liga,
   Bundesliga, Ligue 1, coppe europee se in calendario), poi generazione
   delle schedine e creazione di `data/<id>.json` con `stato:
   "pubblicata"`, più aggiornamento di `settimane.json`.
2. **Dopo le partite**: verifica dei risultati reali sulle fonti web,
   aggiornamento di `esito` e `risultato_reale` per ogni evento, e
   passaggio dello `stato` della settimana a `"completata"`.

Non esiste ancora un backend/DB per questi dati: sono file JSON statici
versionati in git. Ogni aggiornamento settimanale è un commit su questo
repo.
