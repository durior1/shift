/**
 * Background Service Worker for Manual Shift Extension
 * Manages context menu for paste translation
 */

// Create context menu on extension load
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "shift-paste-manual",
    title: "Shift Paste - &\\ to fix language",
    contexts: ["editable"],
    documentUrlPatterns: ["<all_urls>"]
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "shift-paste-manual") {
    chrome.windows.create({
      url: "popup.html",
      type: "popup",
      width: 500,
      height: 300,
      focused: true
    });
  }
});
