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

  // Google Docs helpers
  function isGoogleDocs() {
    return location.hostname.includes("docs.google.com");
  }

  // ============================================================
  // SHARED TRANSLATION ENGINE (no duplication anywhere else)
  // ============================================================
  async function translateText(text) {
    const engUrl = chrome.runtime.getURL("mappings/english.json");
    const hebUrl = chrome.runtime.getURL("mappings/hebrew.json");

    const [eng, heb] = await Promise.all([
      fetch(engUrl).then(r => r.json()),
      fetch(hebUrl).then(r => r.json())
    ]);

    function detectLanguage(text) {
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

    function translateCharDirection(c, fromLang) {
      if (fromLang === "en") {
        const engCode = eng.charToCode[c];
        return engCode ? (heb.codeToChar[engCode] ?? c) : c;
      } else {
        const hebCode = heb.charToCode[c];
        return hebCode ? (eng.codeToChar[hebCode] ?? c) : c;
      }
    }

    function translatePreserveCase(ch, fromLang) {
      if (ch !== ch.toLowerCase()) return ch;
      const mapped = translateCharDirection(ch, fromLang);
      return mapped ?? ch;
    }

    const fromLang = detectLanguage(text);
    let shifted = "";
    for (const ch of text) shifted += translatePreserveCase(ch, fromLang);

    return shifted;
  }

  // ============================================================
  // MAIN HANDLER
  // ============================================================
  async function handleShiftTap() {

    // ============================================================
    // GOOGLE DOCS — CLIPBOARD MODE
    // ============================================================
    if (isGoogleDocs()) {
      try {
        const selected = await navigator.clipboard.readText();

        if (!selected || !selected.trim()) {
          console.debug("[Shift] Clipboard empty or no selection");
          return;
        }

        // console.debug("[Shift] Clipboard contains:", selected);

        const shifted = await translateText(selected);

        // console.debug("[Shift] Translated:", shifted);

        await navigator.clipboard.writeText(shifted);

        console.debug("[Shift] Clipboard updated");

      } catch (err) {
        console.error("[Shift] Clipboard error:", err);
      }

      return;
    }

    // ============================================================
    // NORMAL EDITABLE HANDLING
    // ============================================================

    let sel = window.getSelection();

    // Fallback for hidden textarea (Google Calendar)
    if (sel && sel.isCollapsed && document.activeElement) {
      const el = document.activeElement;
      if (el.selectionStart !== undefined && el.selectionEnd !== undefined) {
        const text = el.value.substring(el.selectionStart, el.selectionEnd);
        if (text.length > 0) {
          sel = {
            toString: () => text,
            anchorNode: el,
            isCollapsed: false
          };
        }
      }
    }

    if (!sel || sel.isCollapsed) return;

    const text = sel.toString();
    if (!text) return;

    const editable =
      nearestEditable(sel.anchorNode) ||
      (document.activeElement &&
      (document.activeElement.tagName === "INPUT" ||
        document.activeElement.tagName === "TEXTAREA")
        ? document.activeElement
        : null);

    if (!editable) return;

    // Undo toggle
    const existingId = editable.getAttribute("data-shift-undo-id");
    if (existingId) {
      const data = undoStore.get(existingId);
      if (data) {
        if (editable.tagName === "INPUT" || editable.tagName === "TEXTAREA") {
          editable.value = data.original;
        } else {
          editable.innerHTML = data.originalHTML;
        }
        editable.removeAttribute("data-shift-undo-id");
        undoStore.delete(existingId);
        return;
      }
    }

    const id = genId();

    // Translate using shared engine
    const shifted = await translateText(text);

    //
    // INPUT / TEXTAREA
    //
    if (editable.tagName === "INPUT" || editable.tagName === "TEXTAREA") {
      const el = editable;
      const original = el.value;

      el.setAttribute("data-shift-undo-id", id);
      undoStore.set(id, { original });

      const start = el.selectionStart;
      const end = el.selectionEnd;

      el.setRangeText(shifted, start, end, "select");

      el.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          inputType: "insertReplacementText",
          data: shifted
        })
      );

      return;
    }

    //
    // CONTENTEDITABLE
    //
    const el = editable;
    const originalHTML = el.innerHTML;

    el.setAttribute("data-shift-undo-id", id);
    undoStore.set(id, { originalHTML });

    const range = window.getSelection().getRangeAt(0);
    range.deleteContents();

    const textNode = document.createTextNode(shifted);
    range.insertNode(textNode);

    const newSel = window.getSelection();
    newSel.removeAllRanges();
    const newRange = document.createRange();
    newRange.setStart(textNode, 0);
    newRange.setEnd(textNode, shifted.length);
    newSel.addRange(newRange);

    el.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType: "insertReplacementText",
        data: shifted
      })
    );
  }

  // ============================================================
  // GLOBAL KEY LISTENERS
  // ============================================================

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') {
      shiftPressed = true;
      otherKeyPressed = false;
    } else if (shiftPressed) {
      otherKeyPressed = true;
    }
  }, { capture: true });

  window.addEventListener('keyup', async (e) => {
    if (e.key === 'Shift' && shiftPressed) {
      if (!otherKeyPressed) {

        handleShiftTap().catch(err => console.error('shift extension error', err));
      }
      shiftPressed = false;
      otherKeyPressed = false;
    }
  }, { capture: true });

})();