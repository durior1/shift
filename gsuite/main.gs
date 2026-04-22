/**
 * Shift: Fix Hebrew/English keyboard mistakes
 * Google Docs Add-on
 * 
 * Translation logic is in translate.gs
 */

/**
 * Gets selected text in the document
 * @returns {string|null} Selected text or null if nothing is selected
 */
function getSelectedText() {
  const selection = DocumentApp.getActiveDocument().getSelection();
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
    } catch(e) {
      Logger.log("Error in getSelectedText element " + i + ": " + e);
    }
    
    // Add newline between elements (except last)
    if (i < elements.length - 1) {
      textParts.push("\n");
    }
  }
  const selectedText = textParts.join("");
  
  Logger.log("getSelectedText result length: " + selectedText.length);
  return selectedText;
}

/**
 * Replaces selected text with new text, preserving paragraph structure
 * @param {string} newText - Text to replace with
 * @returns {boolean} Success status
 */
function replaceSelectedText(newText) {
  const doc = DocumentApp.getActiveDocument();
  const selection = doc.getSelection();
  
  if (!selection) {
    return false;
  }
  
  const elements = selection.getRangeElements();
  
  if (elements.length === 0) {
    return false;
  }
  
  try {
    // Split the new text by newlines to match original structure
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
      // Multiple elements - replace each while preserving structure
      for (let i = 0; i < elements.length; i++) {
        const rangeElement = elements[i];
        const element = rangeElement.getElement();
        let lineContent = i < lines.length ? lines[i] : "";
        
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
  } catch(e) {
    Logger.log("replaceSelectedText error: " + e.toString());
    return false;
  }
}

/**
 * Translates selected text in place
 */
function translateSelectedText() {
  const selectedText = getSelectedText();
  
  if (!selectedText) {
    DocumentApp.getUi().alert("Please select some text to fix.");
    return;
  }
  
  const translatedText = translateText(selectedText);
  
  try {
    if (!replaceSelectedText(translatedText)) {
      DocumentApp.getUi().alert("Failed to replace selected text.");
    }
  } catch(e) {
    DocumentApp.getUi().alert("Error: " + e.toString());
  }
}

/**
 * Adds menu items when document opens
 */
function onOpen(e) {
  DocumentApp.getUi()
    .createMenu("Shift: Translate")
    .addItem("Fix Selected Text (He ↔ En)", "translateSelectedText")
    .addToUi();
}
