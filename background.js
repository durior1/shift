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
});
