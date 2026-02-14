/**
 * Background Service Worker for Shift Paste
 * Listens for the keyboard command and opens the translation popup window
 */

chrome.commands.onCommand.addListener((command) => {
  if (command === "activate") {
    chrome.windows.create({
      url: "popup.html",
      type: "popup",
      width: 500,
      height: 200,
      focused: true
    });
  }
});
