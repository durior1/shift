/**
 * Popup script for Shift Paste
 * Handles text input, translation, clipboard writing, and window closing
 */

const textInput = document.getElementById('textInput');
const translateBtn = document.getElementById('translateBtn');
const closeBtn = document.getElementById('closeBtn');
const tooltip = document.getElementById('tooltip');

// Auto-focus the input field
textInput.focus();

// Auto-translate on paste
textInput.addEventListener('input', async (e) => {
  const text = textInput.value.trim();
  
  // Enable button when there's text, disable when empty
  translateBtn.disabled = !text;
  
  if (!text) return;
  
  try {
    // Call the shared translation function
    const translated = await translateText(text);
    
    // Write to clipboard
    await navigator.clipboard.writeText(translated);
    
    // Hide contents of window and make background transparent
    document.body.classList.add('tooltip-only');
    document.querySelector('.container').classList.add('hidden');

    // Show success tooltip
    showTooltip('Translated text copied to clipboard! Paste it now.');
    
    // Close window after a brief delay
    setTimeout(() => {
      window.close();
    }, 1500);
    
  } catch (err) {
    console.error('Translation error:', err);
    showTooltip('Error during translation. Please try again.');
  }
});

// Close button handler
closeBtn.addEventListener('click', () => {
  window.close();
});

// ESC key handler
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.close();
  }
});

// Translate button handler
translateBtn.addEventListener('click', async () => {
  const text = textInput.value.trim();
  
  if (!text) {
    showTooltip('Please enter some text to translate');
    return;
  }
  
  try {
    // Call the shared translation function
    const translated = await translateText(text);
    
    // Write to clipboard
    await navigator.clipboard.writeText(translated);
    
    // Show success tooltip
    showTooltip('Translated text copied to clipboard! Paste it now.');
    
    // Close window after a brief delay
    setTimeout(() => {
      window.close();
    }, 1500);
    
  } catch (err) {
    console.error('Translation error:', err);
    showTooltip('Error during translation. Please try again.');
  }
});

// Helper function to show tooltip
function showTooltip(message, duration = 3000) {
  tooltip.textContent = message;
  tooltip.classList.add('show');
  
  setTimeout(() => {
    tooltip.classList.remove('show');
  }, duration);
}

// Allow Enter key for quick translation (Ctrl+Enter or Cmd+Enter)
textInput.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    translateBtn.click();
  }
});
