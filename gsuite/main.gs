/**
 * Shift: Fix Hebrew/English keyboard mistakes
 * Google Docs + Google Slides add-on
 * 
 * Translation logic is in translate.gs
   "version": "1.2.5",
 */

function getActiveUi() {
  try {
    if (typeof DocumentApp !== 'undefined' && DocumentApp.getUi) {
      return DocumentApp.getUi();
    }
  } catch (e) {
    // Ignore and fall through to Slides UI.
  }

  try {
    if (typeof SlidesApp !== 'undefined' && SlidesApp.getUi) {
      return SlidesApp.getUi();
    }
  } catch (e) {
    // Ignore if this is not a Slides context.
  }

  return null;
}

function getActiveDocument() {
  try {
    if (typeof DocumentApp !== 'undefined' && DocumentApp.getActiveDocument) {
      return DocumentApp.getActiveDocument();
    }
  } catch (e) {
    // Ignore and fall through.
  }
  return null;
}

function getActivePresentation() {
  try {
    if (typeof SlidesApp !== 'undefined' && SlidesApp.getActivePresentation) {
      return SlidesApp.getActivePresentation();
    }
  } catch (e) {
    // Ignore and fall through.
  }
  return null;
}

/**
 * Gets selected text in Google Docs.
 * @returns {string|null} Selected text or null if nothing is selected
 */
function getDocSelectedText() {
  const doc = getActiveDocument();
  if (!doc) {
    return null;
  }

  const selection = doc.getSelection();
  if (!selection) {
    return null;
  }

  const elements = selection.getRangeElements();
  if (elements.length === 0) {
    return null;
  }

  const textParts = [];
  for (let i = 0; i < elements.length; i++) {
    const rangeElement = elements[i];
    const element = rangeElement.getElement();

    try {
      if (element.getType() === DocumentApp.ElementType.TEXT) {
        const text = element.asText();
        if (rangeElement.isPartial()) {
          textParts.push(text.getText().substring(rangeElement.getStartOffset(), rangeElement.getEndOffsetInclusive() + 1));
        } else {
          textParts.push(text.getText());
        }
      } else if (element.getType() === DocumentApp.ElementType.PARAGRAPH) {
        const para = element.asParagraph();
        if (rangeElement.isPartial()) {
          const text = para.editAsText();
          textParts.push(text.getText().substring(rangeElement.getStartOffset(), rangeElement.getEndOffsetInclusive() + 1));
        } else {
          textParts.push(para.getText());
        }
      }
    } catch (e) {
      Logger.log("Error in getDocSelectedText element " + i + ": " + e);
    }

    if (i < elements.length - 1) {
      textParts.push("\n");
    }
  }

  const selectedText = textParts.join("");
  Logger.log("getDocSelectedText result length: " + selectedText.length);
  return selectedText;
}

/**
 * Gets selected text in Google Slides.
 * @returns {string|null} Selected text or null if nothing is selected
 */
function getSlidesSelectedText() {
  const presentation = getActivePresentation();
  if (!presentation) {
    Logger.log("getSlidesSelectedText: no active presentation");
    return null;
  }

  const selection = presentation.getSelection();
  if (!selection) {
    Logger.log("getSlidesSelectedText: no selection");
    return null;
  }

  const selectionType = selection.getSelectionType ? selection.getSelectionType() : null;
  Logger.log("getSlidesSelectedText selectionType=" + selectionType);

  if (selectionType === SlidesApp.SelectionType.TEXT) {
    const textRange = selection.getTextRange();
    if (textRange && textRange.getText) {
      const text = textRange.getText();
      Logger.log("getSlidesSelectedText textRangeText=" + text);
      if (text && text.trim()) {
        return text;
      }
    }
  }

  if (selection.getPageElementRange && typeof SlidesApp !== 'undefined') {
    const pageElementRange = selection.getPageElementRange();
    if (pageElementRange && pageElementRange.getPageElements) {
      const elements = pageElementRange.getPageElements();
      Logger.log("getSlidesSelectedText pageElementCount=" + elements.length);

      const textParts = [];
      for (let i = 0; i < elements.length; i++) {
        const pageElement = elements[i];
        const type = pageElement.getPageElementType ? pageElement.getPageElementType() : null;
        Logger.log("getSlidesSelectedText pageElementType=" + type);

        if (type === SlidesApp.PageElementType.SHAPE) {
          const shape = pageElement.asShape();
          const shapeText = shape && shape.getText ? shape.getText() : null;
          const candidates = [
            shapeText && shapeText.getText ? shapeText.getText() : "",
            shapeText && shapeText.asString ? shapeText.asString() : "",
            shapeText && shapeText.getTextRange ? shapeText.getTextRange().getText() : ""
          ];

          for (let j = 0; j < candidates.length; j++) {
            const value = candidates[j];
            Logger.log("getSlidesSelectedText shapeTextCandidate=" + value);
            if (value && value.trim()) {
              textParts.push(value);
              break;
            }
          }
        }
      }

      const selectedText = textParts.join("\n");
      Logger.log("getSlidesSelectedText combinedText=" + selectedText);
      return selectedText || null;
    }
  }

  Logger.log("getSlidesSelectedText: no supported Slides selection content found");
  return null;
}

/**
 * Gets selected text in the current app.
 * @returns {string|null} Selected text or null if nothing is selected
 */
function getSelectedText() {
  const docText = getDocSelectedText();
  if (docText) {
    return docText;
  }

  const slidesText = getSlidesSelectedText();
  return slidesText;
}

/**
 * Replaces selected text in Google Docs, preserving paragraph structure.
 * @param {string} newText - Text to replace with
 * @returns {boolean} Success status
 */
function replaceDocSelectedText(newText) {
  const doc = getActiveDocument();
  if (!doc) {
    return false;
  }

  const selection = doc.getSelection();
  if (!selection) {
    return false;
  }

  const elements = selection.getRangeElements();
  if (elements.length === 0) {
    return false;
  }

  try {
    const lines = newText.split("\n");

    if (elements.length === 1) {
      const rangeElement = elements[0];
      const element = rangeElement.getElement();

      if (element.getType() === DocumentApp.ElementType.TEXT) {
        const text = element.asText();
        if (rangeElement.isPartial()) {
          text.deleteText(rangeElement.getStartOffset(), rangeElement.getEndOffsetInclusive());
          text.insertText(rangeElement.getStartOffset(), newText);
        } else {
          text.setText(newText);
        }
      } else if (element.getType() === DocumentApp.ElementType.PARAGRAPH) {
        const para = element.asParagraph();
        para.clear();
        para.appendText(newText);
      }
    } else {
      for (let i = 0; i < elements.length; i++) {
        const rangeElement = elements[i];
        const element = rangeElement.getElement();
        const lineContent = i < lines.length ? lines[i] : "";

        if (element.getType() === DocumentApp.ElementType.PARAGRAPH) {
          const para = element.asParagraph();
          para.clear();
          if (lineContent) {
            para.appendText(lineContent);
          }
        } else if (element.getType() === DocumentApp.ElementType.TEXT) {
          const text = element.asText();
          text.setText(lineContent);
        }
      }
    }

    return true;
  } catch (e) {
    Logger.log("replaceDocSelectedText error: " + e.toString());
    return false;
  }
}

/**
 * Replaces selected text in Google Slides.
 * @param {string} newText - Text to replace with
 * @returns {boolean} Success status
 */
function replaceSlidesSelectedText(newText) {
  const presentation = getActivePresentation();
  if (!presentation) {
    return false;
  }

  const selection = presentation.getSelection();
  if (!selection) {
    return false;
  }

  if (selection.getSelectionType && selection.getTextRange) {
    const selectionType = selection.getSelectionType();
    if (selectionType === SlidesApp.SelectionType.TEXT) {
      const textRange = selection.getTextRange();
      if (textRange && textRange.setText) {
        textRange.setText(newText);
        return true;
      }
    }
  }

  if (selection.getPageElementRange && typeof SlidesApp !== 'undefined') {
    const pageElementRange = selection.getPageElementRange();
    if (pageElementRange && pageElementRange.getPageElements) {
      const elements = pageElementRange.getPageElements();
      let replaced = false;

      for (let i = 0; i < elements.length; i++) {
        const pageElement = elements[i];
        if (pageElement.getPageElementType && pageElement.getPageElementType() === SlidesApp.PageElementType.SHAPE) {
          const shape = pageElement.asShape();
          const text = shape && shape.getText ? shape.getText() : null;
          if (text && text.setText) {
            text.setText(newText);
            replaced = true;
          }
        }
      }

      return replaced;
    }
  }

  return false;
}

/**
 * Replaces the current selection with new text in the active app.
 * @param {string} newText - Text to replace with
 * @returns {boolean} Success status
 */
function replaceSelectedText(newText) {
  if (getActiveDocument()) {
    return replaceDocSelectedText(newText);
  }

  if (getActivePresentation()) {
    return replaceSlidesSelectedText(newText);
  }

  return false;
}

/**
 * Translates selected text in place.
 */
function translateSelectedText() {
  const selectedText = getSelectedText();
  const ui = getActiveUi();

  if (!selectedText) {
    if (ui) {
      ui.alert("Please select some text to fix.");
    }
    return;
  }

  const translatedText = translateText(selectedText);

  try {
    if (!replaceSelectedText(translatedText)) {
      if (ui) {
        ui.alert("Failed to replace selected text.");
      }
    }
  } catch (e) {
    if (ui) {
      ui.alert("Error: " + e.toString());
    }
  }
}

/**
 * Adds menu items when a document or presentation opens.
 */
function onOpen(e) {
  const ui = getActiveUi();
  if (!ui) {
    return;
  }

  ui.createMenu("Shift: Translate")
    .addItem("Fix Selected Text (He ↔ En)", "translateSelectedText")
    .addToUi();
}
