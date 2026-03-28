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
  
  let selectedText = "";
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    const text = element.getElement().asText();
    
    if (element.isPartial()) {
      selectedText += text.getText().substring(element.getStartOffset(), element.getEndOffsetInclusive() + 1);
    } else {
      selectedText += text.getText();
    }
  }
  
  return selectedText;
}

/**
 * Replaces selected text with new text
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
  
  // Clear selection - replace first element fully, then delete rest
  const firstElement = elements[0];
  const text = firstElement.getElement().asText();
  
  if (firstElement.isPartial()) {
    // Partial selection - replace just the selected portion
    text.deleteText(firstElement.getStartOffset(), firstElement.getEndOffsetInclusive());
    text.insertText(firstElement.getStartOffset(), newText);
  } else {
    // Full element selection - replace entire text
    text.setText(newText);
  }
  
  // Delete remaining elements if multi-element selection
  for (let i = 1; i < elements.length; i++) {
    const element = elements[i].getElement();
    const parent = element.getParent();
    parent.removeChild(element);
  }
  
  return true;
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
  
  if (!replaceSelectedText(translatedText)) {
    DocumentApp.getUi().alert("Failed to replace selected text.");
  }
}

/**
 * Adds menu items when document opens
 */
function onOpen(e) {
  DocumentApp.getUi()
    .createMenu("Shift: Translate")
    .addItem("Translate Selected Text (He ↔ En)", "translateSelectedText")
    .addToUi();
}
