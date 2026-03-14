/**
 * Background Service Worker for Shift Paste
 * Manages context menu for manual paste translation
 */

// Create context menu on extension load
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "shift-paste",
    title: "Shift Paste - Fix Language",
    contexts: ["editable"],
    documentUrlPatterns: ["<all_urls>"]
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "shift-paste") {
    chrome.windows.create({
      url: "popup.html",
      type: "popup",
      width: 500,
      height: 300,
      focused: true
    });
  }
});
