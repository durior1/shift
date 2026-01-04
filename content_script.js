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

  function handleShiftTap() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;

    const text = sel.toString();
    if (!text) return;

    const anchorNode = sel.anchorNode;
    const editable = nearestEditable(anchorNode) || (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') ? document.activeElement : null);
    if (!editable) return;

    const id = genId();

    if (editable.tagName === 'INPUT' || editable.tagName === 'TEXTAREA') {
      const el = editable;
      const original = el.value;
      const start = el.selectionStart;
      const end = el.selectionEnd;

      el.setAttribute('data-shift-undo-id', id);
      undoStore.set(id, {type: 'input', original, start, end});

      try {
        chrome.runtime.sendMessage({
          type: 'shift_selection',
          text,
          undoId: id,
          info: {type: 'input', start, end}
        });
      } catch (err) {
        console.warn('Failed to send shift_selection message (extension context may be invalidated)', err);
        el.removeAttribute('data-shift-undo-id');
        undoStore.delete(id);
      }
    } else {
      const el = editable;
      const originalHTML = el.innerHTML;
      const fullText = el.innerText || el.textContent || '';
      const selectedText = text;
      const idx = fullText.indexOf(selectedText);
      const start = idx >= 0 ? idx : null;
      const end = start !== null ? start + selectedText.length : null;

      el.setAttribute('data-shift-undo-id', id);
      undoStore.set(id, {type: 'content', originalHTML, start, end});

      try {
        chrome.runtime.sendMessage({
          type: 'shift_selection',
          text,
          undoId: id,
          info: {type: 'content', start, end}
        });
      } catch (err) {
        console.warn('Failed to send shift_selection message (extension context may be invalidated)', err);
        el.removeAttribute('data-shift-undo-id');
        undoStore.delete(id);
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
        try {
          handleShiftTap();
        } catch (err) {
          console.error('shift extension error', err);
        }
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
