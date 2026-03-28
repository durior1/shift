/**
 * Shared Translation Engine (mirrored from ../translate.js)
 * Handles transliteration between English and Hebrew keyboard layouts
 */

// Mapping data embedded from ../mappings/english.json
const ENGLISH_MAPPING = {
  "codeToChar": {
    "KeyA": "a", "KeyB": "b", "KeyC": "c", "KeyD": "d", "KeyE": "e", "KeyF": "f",
    "KeyG": "g", "KeyH": "h", "KeyI": "i", "KeyJ": "j", "KeyK": "k", "KeyL": "l",
    "KeyM": "m", "KeyN": "n", "KeyO": "o", "KeyP": "p", "KeyQ": "q", "KeyR": "r",
    "KeyS": "s", "KeyT": "t", "KeyU": "u", "KeyV": "v", "KeyW": "w", "KeyX": "x",
    "KeyY": "y", "KeyZ": "z", "Digit0": "0", "Digit1": "1", "Digit2": "2",
    "Digit3": "3", "Digit4": "4", "Digit5": "5", "Digit6": "6", "Digit7": "7",
    "Digit8": "8", "Digit9": "9", "Minus": "-", "Equal": "=", "BracketLeft": "[",
    "BracketRight": "]", "Backslash": "\\", "Semicolon": ";", "Quote": "'",
    "Comma": ",", "Period": ".", "Slash": "/", "Backquote": "`"
  },
  "charToCode": {
    "a": "KeyA", "b": "KeyB", "c": "KeyC", "d": "KeyD", "e": "KeyE", "f": "KeyF",
    "g": "KeyG", "h": "KeyH", "i": "KeyI", "j": "KeyJ", "k": "KeyK", "l": "KeyL",
    "m": "KeyM", "n": "KeyN", "o": "KeyO", "p": "KeyP", "q": "KeyQ", "r": "KeyR",
    "s": "KeyS", "t": "KeyT", "u": "KeyU", "v": "KeyV", "w": "KeyW", "x": "KeyX",
    "y": "KeyY", "z": "KeyZ", "0": "Digit0", "1": "Digit1", "2": "Digit2",
    "3": "Digit3", "4": "Digit4", "5": "Digit5", "6": "Digit6", "7": "Digit7",
    "8": "Digit8", "9": "Digit9", "-": "Minus", "=": "Equal", "[": "BracketLeft",
    "]": "BracketRight", "\\": "Backslash", ";": "Semicolon", "'": "Quote",
    ",": "Comma", ".": "Period", "/": "Slash", "`": "Backquote"
  }
};

// Mapping data embedded from ../mappings/hebrew.json
const HEBREW_MAPPING = {
  "codeToChar": {
    "KeyA": "ש", "KeyB": "נ", "KeyC": "ב", "KeyD": "ג", "KeyE": "ק", "KeyF": "כ",
    "KeyG": "ע", "KeyH": "י", "KeyI": "ן", "KeyJ": "ח", "KeyK": "ל", "KeyL": "ך",
    "KeyM": "צ", "KeyN": "מ", "KeyO": "ם", "KeyP": "פ", "KeyQ": "/", "KeyR": "ר",
    "KeyS": "ד", "KeyT": "א", "KeyU": "ו", "KeyV": "ה", "KeyW": "'", "KeyX": "ס",
    "KeyY": "ט", "KeyZ": "ז", "Digit0": "0", "Digit1": "1", "Digit2": "2",
    "Digit3": "3", "Digit4": "4", "Digit5": "5", "Digit6": "6", "Digit7": "7",
    "Digit8": "8", "Digit9": "9", "Minus": "-", "Equal": "=", "BracketLeft": "[",
    "BracketRight": "]", "Backslash": "\\", "Semicolon": "ף", "Quote": ",",
    "Comma": "ת", "Period": "ץ", "Slash": ".", "Backquote": ";"
  },
  "charToCode": {
    "ש": "KeyA", "נ": "KeyB", "ב": "KeyC", "ג": "KeyD", "ק": "KeyE", "כ": "KeyF",
    "ע": "KeyG", "י": "KeyH", "ן": "KeyI", "ח": "KeyJ", "ל": "KeyK", "ך": "KeyL",
    "צ": "KeyM", "מ": "KeyN", "ם": "KeyO", "פ": "KeyP", "/": "KeyQ", "ר": "KeyR",
    "ד": "KeyS", "א": "KeyT", "ו": "KeyU", "ה": "KeyV", "'": "KeyW", "ס": "KeyX",
    "ט": "KeyY", "ז": "KeyZ", "0": "Digit0", "1": "Digit1", "2": "Digit2",
    "3": "Digit3", "4": "Digit4", "5": "Digit5", "6": "Digit6", "7": "Digit7",
    "8": "Digit8", "9": "Digit9", "-": "Minus", "=": "Equal", "[": "BracketLeft",
    "]": "BracketRight", "\\": "Backslash", "ף": "Semicolon", ",": "Quote",
    "ת": "Comma", "ץ": "Period", ".": "Slash", "ג": "Backquote"
  }
};

/**
 * Detects if text is in English or Hebrew
 * @param {string} text - Text to analyze
 * @returns {string} "en" or "he"
 */
function detectLanguage(text) {
  let engCount = 0;
  let hebCount = 0;
  
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const inEng = ENGLISH_MAPPING.charToCode[ch];
    const inHeb = HEBREW_MAPPING.charToCode[ch];
    
    if (inHeb && !inEng) {
      hebCount++;
    } else if (inEng && !inHeb) {
      engCount++;
    }
  }
  
  return hebCount > engCount ? "he" : "en";
}

/**
 * Translates a single character based on detected language
 * @param {string} c - Character to translate
 * @param {string} fromLang - "en" or "he"
 * @returns {string} Translated character
 */
function translateCharDirection(c, fromLang) {
  if (fromLang === "en") {
    // Translate from English to Hebrew
    const engCode = ENGLISH_MAPPING.charToCode[c];
    if (engCode) {
      return HEBREW_MAPPING.codeToChar[engCode] || c;
    }
  } else {
    // Translate from Hebrew to English
    const hebCode = HEBREW_MAPPING.charToCode[c];
    if (hebCode) {
      return ENGLISH_MAPPING.codeToChar[hebCode] || c;
    }
  }
  return c;
}

/**
 * Translates character while preserving case
 * @param {string} ch - Character to translate
 * @param {string} fromLang - "en" or "he"
 * @returns {string} Translated character
 */
function translatePreserveCase(ch, fromLang) {
  // Uppercase letters remain unchanged in transliteration
  if (ch !== ch.toLowerCase()) {
    return ch;
  }
  return translateCharDirection(ch, fromLang);
}

/**
 * Main translation function
 * Detects if text is in English or Hebrew and transliterates to the other language
 * @param {string} text - Text to translate
 * @returns {string} Translated text
 */
function translateText(text) {
  const fromLang = detectLanguage(text);
  let shifted = "";
  
  for (let i = 0; i < text.length; i++) {
    shifted += translatePreserveCase(text[i], fromLang);
  }
  
  return shifted;
}
