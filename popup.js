document.addEventListener('DOMContentLoaded', async () => {
  const selectedEl = document.getElementById('selected');
  const undoBtn = document.getElementById('undo');
  const closeBtn = document.getElementById('close');

  const tabs = await chrome.tabs.query({active: true, currentWindow: true});
  const tab = tabs[0];
  if (!tab) return;

  chrome.runtime.sendMessage({type: 'get_shift_selection', tabId: tab.id}, (data) => {
    if (!data) {
      selectedEl.value = '';
      selectedEl.placeholder = 'No recent selection for this tab.';
      undoBtn.disabled = true;
      return;
    }
    selectedEl.value = data.text || '';
    undoBtn.dataset.undoId = data.undoId;
  });

  undoBtn.addEventListener('click', async () => {
    const undoId = undoBtn.dataset.undoId;
    if (!undoId) return;
    // tell the content script to undo
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    const tab = tabs[0];
    if (!tab) return;
    chrome.tabs.sendMessage(tab.id, {type: 'shift_undo', undoId});
    window.close();
  });

  closeBtn.addEventListener('click', () => window.close());
});
