/**
 * EXEMPEL: Adapter för att koppla in grammatik-kod från andra repon.
 *
 * Användning:
 * 1) Kopiera filen till ditt Apps Script-projekt som "GrammarAdapter.gs".
 * 2) Byt ut stubbarna mot dina egna funktioner.
 * 3) Kör sedan uppdateraOversikt().
 *
 * Om funktionerna nedan finns kommer Code.gs att använda dem automatiskt.
 */

/**
 * Övergripande hook som kan returnera valfria analysfält.
 * @param {string} lemma
 * @param {string} ordklass
 * @return {{deklination?:string, verbgrupp?:string, infinitiv?:string,
 *           imperativ?:string, presens?:string, preteritum?:string, supinum?:string}}
 */
function customAnalyzeWord_(lemma, ordklass) {
  if (ordklass === 'verb') {
    return analyseraVerbExtern_(lemma);
  }

  if (ordklass === 'substantiv') {
    return {
      deklination: classifyNounDeclension_(lemma)
    };
  }

  return {};
}

/**
 * Hook för substantiv-deklination.
 * Returnera t.ex. "1", "2", "3", "4", "5" eller tom sträng.
 */
function classifyNounDeclension_(lemma) {
  // TODO: ersätt med logik från ditt andra repo
  // Exempel: return externalDeclensionClassifier(lemma);
  return '';
}

/**
 * EXEMPEL: koppla in verbanalys från annan kodbas.
 */
function analyseraVerbExtern_(lemma) {
  // TODO: ersätt med riktiga anrop till din befintliga kod.
  // Viktigt: returnera exakt dessa nycklar.
  return {
    verbgrupp: '',
    infinitiv: lemma,
    imperativ: '',
    presens: '',
    preteritum: '',
    supinum: ''
  };
}
