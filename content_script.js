(() => {
  const undoStore = new Map();

  let shiftPressed = false;
  let otherKeyPressed = false;

  function genId() {
    return 'shift-' + Math.random().toString(36).slice(2, 9);
  }

  function nearestEditable(node) {
    while (node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node;
        const tag = el.tagName && el.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return el;
        if (el.isContentEditable) return el;
      }
      node = node.parentNode;
    }
    return null;
  }

  async function handleShiftTap() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;

    const text = sel.toString();
    if (!text) return;

    const anchorNode = sel.anchorNode;
    const editable = nearestEditable(anchorNode) || (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') ? document.activeElement : null);
    if (!editable) return;

    // if this element already has an undo id, treat as toggle: restore original if still applied
    const existingId = editable.getAttribute && editable.getAttribute('data-shift-undo-id');
    if (existingId) {
      const data = undoStore.get(existingId);
      if (data && data.applied) {
        // check whether selection hasn't changed: if current selected text equals applied shiftedText (or selection within input matches)
        const currentSel = sel.toString();
        const sameSelection = (data.shiftedText && currentSel === data.shiftedText) || (data.type === 'input' && editable.value && editable.value.substring(data.start, data.start + data.shiftedText.length) === data.shiftedText);
        if (sameSelection) {
          // restore
          if (data.type === 'input') {
            editable.value = data.original;
            try { editable.setSelectionRange(data.start, data.end); } catch (e) {}
          } else if (data.type === 'content') {
            editable.innerHTML = data.originalHTML;
          }
          editable.removeAttribute('data-shift-undo-id');
          undoStore.delete(existingId);
          return;
        }
      }
      // if we get here, fall through to capture new selection
    }

    const id = genId();

    if (editable.tagName === 'INPUT' || editable.tagName === 'TEXTAREA') {
      const el = editable;
      const original = el.value;
      const start = el.selectionStart;
      const end = el.selectionEnd;

      el.setAttribute('data-shift-undo-id', id);
      undoStore.set(id, {type: 'input', original, start, end, applied: false});

      // fetch mappings from extension
      const engUrl = chrome.runtime.getURL('mappings/english.json');
      const hebUrl = chrome.runtime.getURL('mappings/hebrew.json');
      async function fetchJson(url) {
        const r = await fetch(url);
        const text = await r.text();
        try { return JSON.parse(text); } catch (err) { console.error('Invalid mapping JSON', url, err); return null; }
      }

      const [eng, heb] = await Promise.all([fetchJson(engUrl), fetchJson(hebUrl)]);

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

      function translatePreserveCase(ch, fromLang) {
        if (!ch) return ch;
        const isUpper = ch.toLowerCase() !== ch && ch.toUpperCase() === ch;
        const base = isUpper ? ch.toLowerCase() : ch;
        const out = translateCharDirection(base, fromLang);
        if (isUpper && typeof out === 'string' && out.length === 1 && /[a-z]/i.test(out)) return out.toUpperCase();
        return out;
      }

      const fromLang = detectLanguage(text, eng, heb);
      let shifted = '';
      for (const ch of text) shifted += translatePreserveCase(ch, fromLang);

      // apply replacement in input/textarea
      const newVal = original.slice(0, start) + shifted + original.slice(end);
      el.value = newVal;
      try { el.setSelectionRange(start, start + shifted.length); } catch (e) {}

      // mark applied and store shifted text for toggling
      const stored = undoStore.get(id);
      if (stored) {
        stored.applied = true;
        stored.shiftedText = shifted;
      }

      try {
        chrome.runtime.sendMessage({ type: 'shift_selection', text, undoId: id, info: {type: 'input', start, end} });
      } catch (err) {
        console.warn('Failed to send shift_selection message', err);
      }
    } else {
      const el = editable;
      const originalHTML = el.innerHTML;

      el.setAttribute('data-shift-undo-id', id);
      undoStore.set(id, {type: 'content', originalHTML, applied: false});

      // fetch mappings
      const engUrl = chrome.runtime.getURL('mappings/english.json');
      const hebUrl = chrome.runtime.getURL('mappings/hebrew.json');
      async function fetchJson(url) {
        const r = await fetch(url);
        const text = await r.text();
        try { return JSON.parse(text); } catch (err) { console.error('Invalid mapping JSON', url, err); return null; }
      }

      const [eng, heb] = await Promise.all([fetchJson(engUrl), fetchJson(hebUrl)]);

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

      function translatePreserveCase(ch, fromLang) {
        if (!ch) return ch;
        const isUpper = ch.toLowerCase() !== ch && ch.toUpperCase() === ch;
        const base = isUpper ? ch.toLowerCase() : ch;
        const out = translateCharDirection(base, fromLang);
        if (isUpper && typeof out === 'string' && out.length === 1 && /[a-z]/i.test(out)) return out.toUpperCase();
        return out;
      }

      const fromLang = detectLanguage(text, eng, heb);
      let shifted = '';
      for (const ch of text) shifted += translatePreserveCase(ch, fromLang);

      // replace selection range using Range API
      try {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const node = document.createTextNode(shifted);
        range.insertNode(node);
        // normalize selection to the inserted node
        sel.removeAllRanges();
        const newRange = document.createRange();
        newRange.setStart(node, 0);
        newRange.setEnd(node, shifted.length);
        sel.addRange(newRange);
      } catch (e) {
        // fallback: replace innerHTML (less safe)
        el.innerHTML = el.innerHTML.split(text).join(shifted);
      }

      const stored = undoStore.get(id);
      if (stored) {
        stored.applied = true;
        stored.shiftedText = shifted;
      }

      try {
        chrome.runtime.sendMessage({ type: 'shift_selection', text, undoId: id, info: {type: 'content'} });
      } catch (err) {
        console.warn('Failed to send shift_selection message', err);
      }
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') {
      shiftPressed = true;
      otherKeyPressed = false;
    } else if (shiftPressed) {
      otherKeyPressed = true;
    }
  }, true);

  document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift' && shiftPressed) {
      if (!otherKeyPressed) {
        handleShiftTap().catch(err => console.error('shift extension error', err));
      }
      shiftPressed = false;
      otherKeyPressed = false;
    }
  }, true);

  // react to commands from popup/background (undo/apply)
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.type) return;
    if (msg.type === 'shift_undo') {
      const id = msg.undoId;
      const data = undoStore.get(id);
      if (!data) return;
      if (data.type === 'input') {
        // find element with matching attribute
        const el = document.querySelector('[data-shift-undo-id="' + id + '"]');
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
          el.value = data.original;
        }
      } else if (data.type === 'content') {
        const el = document.querySelector('[data-shift-undo-id="' + id + '"]');
        if (el) el.innerHTML = data.originalHTML;
      }
      undoStore.delete(id);
    }
  });
})();
