document.addEventListener('DOMContentLoaded', async () => {
  const selectedEl = document.getElementById('selected');
  const shiftedEl = document.getElementById('shifted');
  const undoBtn = document.getElementById('undo');
  const closeBtn = document.getElementById('close');

  const tabs = await chrome.tabs.query({active: true, currentWindow: true});
  const tab = tabs[0];
  if (!tab) return;

  // load mappings with debug wrapper to log invalid JSON
  const engUrl = chrome.runtime.getURL('mappings/english.json');
  const hebUrl = chrome.runtime.getURL('mappings/hebrew.json');

  function fetchJsonDebug(url, name) {
    return fetch(url)
      .then(r => r.text())
      .then(text => {
        try { return JSON.parse(text); }
        catch (err) {
          console.error('Invalid JSON in', name || url, text.slice(0, 800), err);
          throw err;
        }
      });
  }

  const mappingsPromise = Promise.all([
    fetchJsonDebug(engUrl, 'english.json'),
    fetchJsonDebug(hebUrl, 'hebrew.json')
  ]).catch((err) => {
    console.error('Failed to load mappings', err);
    return [null, null];
  });

  chrome.runtime.sendMessage({type: 'get_shift_selection', tabId: tab.id}, async (data) => {
    const [eng, heb] = await mappingsPromise;
    if (!data) {
      selectedEl.value = '';
      selectedEl.placeholder = 'No recent selection for this tab.';
      shiftedEl.value = '';
      undoBtn.disabled = true;
      return;
    }

    const original = data.text || '';
    selectedEl.value = original;
    undoBtn.dataset.undoId = data.undoId;

    // language detection: count chars unique to each mapping
    function detectLanguage(text, eng, heb) {
      if (!eng || !heb) return 'en';
      let engCount = 0;
      let hebCount = 0;
      for (const ch of text) {
        const inEng = eng.charToCode && eng.charToCode[ch];
        const inHeb = heb.charToCode && heb.charToCode[ch];
        if (inHeb && !inEng) hebCount++;
        else if (inEng && !inHeb) engCount++;
      }
      return hebCount > engCount ? 'he' : 'en';
    }

    // translate a single char in a given direction
    function translateCharDirection(c, fromLang) {
      if (!eng || !heb) return c;
      if (fromLang === 'en') {
        const engCode = eng.charToCode && eng.charToCode[c];
        if (engCode) {
          const mapped = heb.codeToChar && heb.codeToChar[engCode];
          if (mapped !== undefined && mapped !== null) return mapped;
        }
        return c;
      } else {
        const hebCode = heb.charToCode && heb.charToCode[c];
        if (hebCode) {
          const mapped = eng.codeToChar && eng.codeToChar[hebCode];
          if (mapped !== undefined && mapped !== null) return mapped;
        }
        return c;
      }
    }

    // preserve simple uppercase for Latin letters: map lower then uppercase result if needed
    function translatePreserveCase(ch, fromLang) {
      if (!ch) return ch;
      const isUpper = ch.toLowerCase() !== ch && ch.toUpperCase() === ch;
      const base = isUpper ? ch.toLowerCase() : ch;
      const out = translateCharDirection(base, fromLang);
      if (isUpper && typeof out === 'string' && out.length === 1 && /[a-z]/i.test(out)) return out.toUpperCase();
      return out;
    }

    const fromLang = detectLanguage(original, eng, heb);
    let shifted = '';
    for (const ch of original) {
      shifted += translatePreserveCase(ch, fromLang);
    }

    shiftedEl.value = shifted;
  });

  undoBtn.addEventListener('click', async () => {
    const undoId = undoBtn.dataset.undoId;
    if (!undoId) return;
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    const tab = tabs[0];
    if (!tab) return;
    chrome.tabs.sendMessage(tab.id, {type: 'shift_undo', undoId});
    window.close();
  });

  closeBtn.addEventListener('click', () => window.close());
});
