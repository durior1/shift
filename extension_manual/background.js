/**
 * Background Service Worker for Shift Extension
 * Manages context menu for paste translation
 * Shared by both automatic and manual extensions
 */

// Create context menu on extension load
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "shift-paste",
    title: "Shift Paste - &\\ to fix language",
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
