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
    // Try to get real selection
    let sel = window.getSelection();

    // Fallback: Google Calendar often uses hidden textarea
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

    // Undo toggle logic
    const existingId =
      editable.getAttribute && editable.getAttribute("data-shift-undo-id");
    if (existingId) {
      const data = undoStore.get(existingId);
      if (data && data.applied) {
        const currentSel = sel.toString();
        const sameSelection =
          (data.shiftedText && currentSel === data.shiftedText) ||
          (data.type === "input" &&
            editable.value &&
            editable.value.substring(
              data.start,
              data.start + data.shiftedText.length
            ) === data.shiftedText);

        if (sameSelection) {
          if (data.type === "input") {
            editable.value = data.original;
            try {
              editable.setSelectionRange(data.start, data.end);
            } catch (e) {}
          } else if (data.type === "content") {
            editable.innerHTML = data.originalHTML;
          }
          editable.removeAttribute("data-shift-undo-id");
          undoStore.delete(existingId);
          return;
        }
      }
    }

    const id = genId();

    // Load mappings
    const engUrl = chrome.runtime.getURL("mappings/english.json");
    const hebUrl = chrome.runtime.getURL("mappings/hebrew.json");

    async function fetchJson(url) {
      const r = await fetch(url);
      const t = await r.text();
      try {
        return JSON.parse(t);
      } catch (err) {
        console.error("Invalid mapping JSON", url, err);
        return null;
      }
    }

    const [eng, heb] = await Promise.all([fetchJson(engUrl), fetchJson(hebUrl)]);

    function detectLanguage(text, eng, heb) {
      if (!eng || !heb) return "en";
      let engCount = 0;
      let hebCount = 0;
      for (const ch of text) {
        const inEng = eng.charToCode && eng.charToCode[ch];
        const inHeb = heb.charToCode && heb.charToCode[ch];
        if (inHeb && !inEng) hebCount++;
        else if (inEng && !inHeb) engCount++;
      }
      return hebCount > engCount ? "he" : "en";
    }

    function translateCharDirection(c, fromLang) {
      if (!eng || !heb) return c;
      if (fromLang === "en") {
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
      // If the character is uppercase, do NOT translate it
      if (ch !== ch.toLowerCase()) {
        return ch;
      }

      // Only translate lowercase characters that exist in the mapping
      const mapped = translateCharDirection(ch, fromLang);

      // If not mapped, return original
      if (mapped === undefined || mapped === null) {
        return ch;
      }

      return mapped;
    }

    const fromLang = detectLanguage(text, eng, heb);

    let shifted = "";

    for (const ch of text) {
      const mapped = translatePreserveCase(ch, fromLang);

      // If the character is not in the mapping → keep it unchanged
      if (mapped === undefined || mapped === null) {
        shifted += ch;
      } else {
        shifted += mapped;
      }
    }

    //
    // ============================
    //   INPUT / TEXTAREA HANDLING
    // ============================
    //
    if (
      editable.tagName === "INPUT" ||
      editable.tagName === "TEXTAREA"
    ) {
      const el = editable;
      const original = el.value;
      const start = el.selectionStart;
      const end = el.selectionEnd;

      el.setAttribute("data-shift-undo-id", id);
      undoStore.set(id, {
        type: "input",
        original,
        start,
        end,
        applied: false
      });

      // Modern, React-safe replacement
      el.setRangeText(shifted, start, end, "select");

      el.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          inputType: "insertReplacementText",
          data: shifted
        })
      );

      const stored = undoStore.get(id);
      if (stored) {
        stored.applied = true;
        stored.shiftedText = shifted;
      }

      return;
    }

    //
    // ============================
    //   CONTENTEDITABLE HANDLING
    // ============================
    //
    const el = editable;
    const originalHTML = el.innerHTML;

    el.setAttribute("data-shift-undo-id", id);
    undoStore.set(id, {
      type: "content",
      originalHTML,
      applied: false
    });

    try {
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
    } catch (e) {
      el.innerHTML = el.innerHTML.replace(text, shifted);
    }

    const stored = undoStore.get(id);
    if (stored) {
      stored.applied = true;
      stored.shiftedText = shifted;
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
})();
