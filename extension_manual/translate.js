/**
 * Shared Translation Engine
 * Handles transliteration between English and Hebrew keyboard layouts
 */

async function loadMappings() {
  const engUrl = chrome.runtime.getURL("../mappings/english.json");
  const hebUrl = chrome.runtime.getURL("../mappings/hebrew.json");

  const [eng, heb] = await Promise.all([
    fetch(engUrl).then(r => r.json()),
    fetch(hebUrl).then(r => r.json())
  ]);

  return { eng, heb };
}

function detectLanguage(text, eng, heb) {
  let engCount = 0;
  let hebCount = 0;
  for (const ch of text) {
    const inEng = eng.charToCode[ch];
    const inHeb = heb.charToCode[ch];
    if (inHeb && !inEng) hebCount++;
    else if (inEng && !inHeb) engCount++;
  }
  return hebCount > engCount ? "he" : "en";
}

function translateCharDirection(c, fromLang, eng, heb) {
  if (fromLang === "en") {
    const engCode = eng.charToCode[c];
    return engCode ? (heb.codeToChar[engCode] ?? c) : c;
  } else {
    const hebCode = heb.charToCode[c];
    return hebCode ? (eng.codeToChar[hebCode] ?? c) : c;
  }
}

function translatePreserveCase(ch, fromLang, eng, heb) {
  if (ch !== ch.toLowerCase()) return ch;
  const mapped = translateCharDirection(ch, fromLang, eng, heb);
  return mapped ?? ch;
}

/**
 * Main translation function
 * Detects if text is in English or Hebrew and transliterates to the other language
 * @param {string} text - Text to translate
 * @returns {Promise<string>} Translated text
 */
async function translateText(text) {
  const { eng, heb } = await loadMappings();
  
  const fromLang = detectLanguage(text, eng, heb);
  let shifted = "";
  for (const ch of text) {
    shifted += translatePreserveCase(ch, fromLang, eng, heb);
  }

  return shifted;
}

// Export for use in both automatic and manual extensions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { translateText, loadMappings, detectLanguage };
}
