# Produzione video e materiali Udemy — 5 pilastri SkillEasy

Questa cartella contiene tutto quello che serve per produrre le video lezioni dei 5 corsi Udemy (Contabilità, Fisco, Gestione aziendale, Controllo di gestione, Programmazione e finanza) con la voce del Dr. Mascia, più i materiali da caricare su Udemy e da vendere sul sito.

**Non è pubblicata sul sito**: sta nel repository `analisiebusinessplan`, non in quello di skilleasy.it.

## Cosa c'è per ogni corso (`corsi/<corso>/`)

| File | A cosa serve |
|---|---|
| `studio-registrazione-<corso>.html` | Lo studio di registrazione: si apre con Chrome sul tuo computer, mostra la slide e il testo da leggere, registra una traccia per slide |
| `SkillEasy-<Corso>-Copione-Registrazione.pdf` | Lo stesso copione in PDF, da stampare o tenere su un secondo schermo |
| `pacchetti/L01.md … L29.md` | Il sorgente di ogni lezione: slide (HTML) e testo parlato sincronizzati, slide per slide |
| `udemy-dispense/*.pdf` | Le 3 dispense da allegare alle 3 sezioni del corso su Udemy (obiettivi, punti chiave, norme, errori comuni, esercizio con soluzione per ogni lezione) |
| `SkillEasy-<Corso>-Manuale-Completo.pdf` | Il manuale completo (70-130 pagine): da vendere sul sito come guida integrale, **non** da caricare su Udemy |

Numeri complessivi: 131 lezioni, circa 1.660 slide, circa 197.000 parole di copione (circa 23 ore di video).

## Come registrare (una lezione alla volta)

1. **Prova tecnica**: prima di tutto registra la Lezione 1 di Fisco e caricala su Udemy come "test video" gratuito: il loro team ti dice se audio e qualità vanno bene.
2. **Attrezzatura**: microfono esterno (USB o ad archetto), stanza silenziosa e non rimbombante (tende, tappeti, libreria), notifiche spente.
3. **Apri lo studio** del corso in Google Chrome (doppio clic sul file `.html`; al primo avvio Chrome chiede il permesso di usare il microfono).
4. **Registra slide per slide**: scegli la lezione a sinistra, premi **Spazio**, leggi il testo, premi di nuovo **Spazio**. Lo studio passa da solo alla slide successiva. Se sbagli, torna sulla slide e riregistra solo quella. Con **P** riascolti. Il testo è una traccia: puoi dirlo con parole tue, purché numeri ed esempi restino quelli.
5. Le registrazioni restano salvate nel browser anche se chiudi la pagina. A fine lezione premi **Esporta lezione**: scarichi uno `.zip` (circa 5-10 MB a lezione).
6. **Consegna**: carica gli `.zip` nella cartella `registrazioni/` di questo repository dal sito di GitHub (*Add file → Upload files*), oppure mandameli in chat. Io monto i video finali.

## Come vengono montati i video finali

Il programma `strumenti/tools/assemble_course.py` prende gli zip, renderizza le slide in Full HD (1920×1080), mette la tua voce slide per slide con brevi dissolvenze, normalizza il volume (standard -16 LUFS) e genera per ogni lezione:
- `<corso>-L##.mp4`: video H.264 1080p con audio AAC, pronto per Udemy;
- `<corso>-L##.srt`: sottotitoli in italiano sincronizzati, da caricare su Udemy come didascalie.

Se in uno zip manca la registrazione di qualche slide, il video viene montato lo stesso con una voce sintetica di anteprima su quella slide, e il programma elenca le slide mancanti: quei video non vanno pubblicati finché non le registri.

Comando (dalla cartella `produzione-video`):

```
python3 strumenti/tools/assemble_course.py corsi output registrazioni/*.zip
```

Requisiti: Python 3.11 con i pacchetti di `strumenti/requirements.txt` e il browser Chromium di Playwright (`playwright install chromium`, oppure il percorso indicato in `render_slides.py`).

## Anteprime con voce sintetica

Per ogni corso è stata generata l'anteprima della Lezione 1 con una voce sintetica, utile per controllare ritmo e slide prima di registrare. Le anteprime non vanno pubblicate su Udemy: le regole Udemy chiedono di dichiarare la voce sintetica, vietano che una voce sintetica si presenti come l'istruttore e i video finali sono previsti con la tua voce.

## Su Udemy, per ogni corso

- 3 sezioni (Base, Intermedio, Avanzato) + Introduzione e Conclusione, come da scheda in `skilleasy/udemy/<corso>.md`;
- un video per lezione con i suoi sottotitoli `.srt`;
- la dispensa PDF come "risorsa" dell'ultima lezione di ogni sezione;
- il quiz di fine sezione (testo pronto nella scheda Udemy).
