# Förslag: snyggare elevinmatning + automatisk ordanalys i Google Sheets

Nu finns två delar:

1. **Elevvy (webbapp):** eleven skriver sitt **förnamn (obligatoriskt)** och kan skriva in många ord i en textruta.
2. **Lärarvy (översikt):** automatiskt blad med frekvens, ordklass och verbformer.

## Filer

- `apps_script/Code.gs`
- `apps_script/Index.html`
- `apps_script/Wordbank.html`
- `apps_script/GrammarAdapter.example.gs`

## Var finns koden?

Ja – koden finns i detta repo i:
- `apps_script/Code.gs`
- `apps_script/Index.html`
- `apps_script/Wordbank.html`
- `apps_script/GrammarAdapter.example.gs`

Eftersom Google Apps Script körs i Googles editor behöver du normalt **kopiera in filerna manuellt** första gången
(om du inte använder `clasp` för synkning via terminal/Git).

Kort svar: **koden finns i repot, men du kopierar den till Apps Script-projektet**.



## Hämtad logik från ditt andra repo

Jag har nu bakat in logik direkt från:
- `src/data/questions_verb.ts` (verbgrupp 1, 2a, 2b, 3, 4 via imperativform)
- `src/components/GrammarApp.tsx` (deklinationsgrupper n1–n5 som grund för substantivheuristik)

Det gör att klassificeringen i `Code.gs` inte bara är generisk utan följer samma gruppindelning som din plattform.

## Nya steg du bad om (1 och 2)

### 1) Plugga in kod från andra repon (verbgrupp/deklination)

I `Code.gs` finns nu adapter-hookar:
- `customAnalyzeWord_(lemma, ordklass)` (övergripande analys)
- `classifyNounDeclension_(lemma)` (substantiv-deklination)

Om du klistrar in sådana funktioner i samma Apps Script-projekt används de automatiskt av `uppdateraOversikt()`.

### 2) Enkel webb-ordbank med språkfilter

Nytt stöd för bladet `Ordbank` och publik läsvy:
- kör `Bygg Ordbank från Översikt` från menyn `Ordverktyg`
- öppna webbappen med parametern `?view=ordbank`
- filtrera på ordklass, språk och sökord i `Wordbank.html`


## Snabb integration av din befintliga grammatik-kod

1. Kopiera `apps_script/GrammarAdapter.example.gs` till Apps Script och döp filen till `GrammarAdapter.gs`.
2. Klistra in din kod för verbgrupp/deklination i den filen.
3. Implementera minst en av funktionerna:
   - `customAnalyzeWord_(lemma, ordklass)`
   - `classifyNounDeclension_(lemma)`
4. Kör `uppdateraOversikt()` igen.

När dessa funktioner finns används de automatiskt av huvudkoden i `Code.gs`.

## Snabbstart

1. Öppna ditt Google Sheet.
2. Gå till **Extensions → Apps Script**.
3. Skapa/klistra in:

> Får du felet **"Ingen HTML-fil med namnet Index hittades"** betyder det att `Index.html` inte finns i Apps Script-projektet ännu (eller har annat namn).
> Skapa filen `Index.html`, klistra in innehållet från repot och deploya igen.

   - `Code.gs` (kod från `apps_script/Code.gs`)
   - `Index.html` (kod från `apps_script/Index.html`)
   - `Wordbank.html` (kod från `apps_script/Wordbank.html`)
4. Skapa ett blad som heter `Svar` med rubriker på rad 1:
   - `Timestamp`
   - `Elev`
   - `Ord`
5. Kör funktionen `konfigureraValidering()` en gång.
6. Publicera webbappen:
   - **Deploy → New deployment → Web app**
   - Välj vem som får använda appen (t.ex. elever i domänen)
   - Dela länken med eleverna.

## Hur inmatningen fungerar

- Förnamn är obligatoriskt i webbappen.
- Eleven skriver flera ord i samma ruta.
- Orden separeras med **mellanslag**.
- Punkt, kommatecken och liknande tecken rensas bort automatiskt.
- Varje ord sparas som **en egen rad** i `Svar`.

## Hur enords-kravet säkras (och ändå många ord per elev)

- `submitWords()` normaliserar texten till ordlista.
- `submitWords()`/`submitWord()` nekar ogiltiga värden.
- `konfigureraValidering()` sätter datavalidering i kolumn C i bladet `Svar`.
- `onEdit()` rensar ogiltig manuell inmatning i kolumn C.
- `uppdateraOversikt()` räknar bara giltiga enordsvärden.

## Översikten

Kör `uppdateraOversikt()` för att skapa/uppdatera bladet `Översikt` med:

- lemma
- ordklass (enkel gissning)
- frekvens
- verbgrupp
- infinitiv
- imperativ
- presens
- preteritum
- supinum

## Kan andra repon med bättre grammatik-kod användas?

Ja, absolut. En bra väg är att:

1. Behålla detta som inmatningslager.
2. Flytta grammatikanalys till separata funktioner/moduler (verbgrupp, deklination osv).
3. Anropa dessa moduler när `uppdateraOversikt()` körs.

Det brukar inte bli för komplicerat om vi gör det stegvis.

## "Dröm"-läge: klassens ordbank med översättningar

Det här upplägget kan byggas ut till en webb-ordbank. Förslag på nästa steg:

1. Lägg till ett blad `Ordbank` med ord + kategori + källa (vilken text ordet kommer från).
2. Lägg till översättningskolumner per språk.
3. Publicera en enkel läsvy (webbapp) med sök och filtrering.
4. Senare: bättre design, elevinloggning och redigeringsflöde för lärare.

## Korrekta paths

Relativt repo-roten ska filerna ligga här:

- `apps_script/Code.gs`
- `apps_script/Index.html`
- `apps_script/Wordbank.html`
- `apps_script/GrammarAdapter.example.gs`

Det ska **inte** vara dubbla mappar som `apps_script/apps_script/...` och inte ett radbrytningstrassel som ser ut som
`skrivaInNyaOrd/apps_script
/apps_script/`.

## Felsökning: "Jag hittar inga filer i mitt repo"

Kontrollera följande i terminalen i ditt repo:

```bash
git branch --show-current
git pull
find . -maxdepth 2 -type f | sed 's#^./##'
```

Du ska se åtminstone:
- `README.md`
- `apps_script/Code.gs`
- `apps_script/Index.html`
- `apps_script/Wordbank.html`
- `apps_script/GrammarAdapter.example.gs`

Om filerna fortfarande saknas jobbar du troligen i fel repo eller fel branch.
