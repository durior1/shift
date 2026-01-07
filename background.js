chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || message.type !== 'shift_selection') return;

  const tabId = sender.tab && sender.tab.id;
  if (!tabId) return;

  const key = 'shift_selection_' + tabId;
  const payload = {
    text: message.text,
    undoId: message.undoId,
    info: message.info,
    time: Date.now()
  };

  chrome.storage.local.set({[key]: payload}, () => {
    return; // disabling popup
    try {
      if (chrome.action && chrome.action.openPopup) {
        chrome.action.openPopup();
      }
    } catch (err) {
      console.warn('Could not open popup automatically', err);
    }
  });
});

// Provide the stored selection to the popup when requested
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return;
  if (message.type === 'get_shift_selection') {
    const tabId = message.tabId;
    const key = 'shift_selection_' + tabId;
    chrome.storage.local.get(key, (items) => {
      sendResponse(items[key] || null);
    });
    return true; // indicate async response
  }
});
