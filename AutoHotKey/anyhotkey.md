# SHIFT AnyHotKey — Development Summary

This document captures the major insights, design decisions, limitations, and next‑step options that emerged while developing the **SHIFT AnyHotKey** script.

---

## ## Core Goals of the Script
- Detect a **single Shift‑tap** and use it as a universal trigger.
- Translate selected text **English ↔ Hebrew** typed in the wrong keyboard layout.
- Restore the original selection after translation or undo.
- Handle text extraction across applications that expose selection via COM (Word, etc.)
- Assist Google Suite apps in web browsers that support chrome web extensions
- Avoid interfering with normal typing (e.g., Shift+1 → `!`).

---

## ## Key Technical Milestones

### ### 1. Reliable Shift‑tap detection
- Built logic to distinguish:
  - **Shift‑tap**
  - **Shift‑hold**
  - **Shift used with another key**
- Added logic to **ignore printable characters** so punctuation like `!` doesn’t cancel the tap.
- Added ability to detect **both Shift keys pressed together**.

---

### ### 2. Selection extraction across applications
We explored multiple extraction strategies:

#### **Word (COM)**
- `Selection.Text` returns the *next character* when nothing is selected.
- Fix: check `Selection.Type` (`0 = insertion point`, `1 = real selection`).
- Trim trailing CR/LF because Word often appends newline characters.

#### **General apps**
- Clipboard sentinel method works well:
  - Clear clipboard → send Ctrl+C → wait for change.

#### **Google Docs**
- Clipboard sentinel fails because Docs uses a **virtual clipboard**.
- UIA cannot read text because Docs uses a **canvas-based editor**.
- DOM cannot be accessed from AHK due to Chrome sandboxing.

This is the biggest limitation discovered.

---

### ### 3. Unicode handling
- `Ord()` gives the UTF‑16 code unit, which equals the Unicode code point for Hebrew/English.
- Added helper for surrogate pairs (emoji, rare symbols).

---

### ### 4. Restoring selection after translation/undo
- After typing replacement text, reselect it using:
  - `Send "+{Left}"` repeated for the text length.
- Works universally across apps.

---

## ## Major Limitations Identified

### ### 1. **Google Docs cannot be automated via AHK alone**
- Clipboard access is restricted.
- UIA cannot read text.
- DOM is sandboxed.
- No HWND per text element.
- No reliable way to extract or replace text from AHK.

### ### 2. **Chrome does not expose DOM or selection to external apps**
- Only a browser extension or DevTools protocol can access it.

### ### 3. **Simulated Ctrl+C is not always treated as a trusted gesture**
- Especially in Docs, which blocks synthetic clipboard writes.

---

## ## Workable Solutions Identified

### ### 1. Use a **Chrome extension** as a bridge
- Extension can read selection via `window.getSelection()`.
- Extension can insert text via `document.execCommand("insertText")`.
- AHK triggers the extension via a **keyboard shortcut**.




---

## ## Summary
The SHIFT AnyHotKey script is now robust across almost all desktop applications. The only major obstacle is **Google Docs**, which cannot be automated reliably using AutoHotkey alone due to browser sandboxing and virtual clipboard behavior. The clean solution is to integrate a **Chrome extension** triggered by AHK via a safe keyboard shortcut. This gives full access to the DOM and enables perfect text extraction and replacement.

This hybrid approach will make the script fully universal and future‑proof.

