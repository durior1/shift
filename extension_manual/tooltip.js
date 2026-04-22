/**
 * Shared Tooltip Utility for Shift Extensions
 * Used by both automatic and manual extensions
 */

function createTooltipStyle() {
  const style = document.createElement('style');
  style.textContent = `
    .shift-tooltip {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 999999;
      animation: shift-tooltip-slide-in 0.3s ease-out;
    }
    
    @keyframes shift-tooltip-slide-in {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
    
    .shift-tooltip a {
      color: white;
      text-decoration: underline;
      cursor: pointer;
      font-weight: 600;
    }
    
    .shift-tooltip a:hover {
      opacity: 0.8;
    }
  `;
  document.head.appendChild(style);
}

async function shouldShowTooltip() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['shift-tooltip-last-shown'], (result) => {
      const lastShown = result['shift-tooltip-last-shown'] || 0;
      const now = Date.now();
      const oneDayInMs = 24 * 60 * 60 * 1000;
      
      if (now - lastShown >= oneDayInMs) {
        // Update the last shown timestamp
        chrome.storage.local.set({ 'shift-tooltip-last-shown': now });
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

async function showDocsTooltip() {
  const shouldShow = await shouldShowTooltip();
  
  // if (!shouldShow) return; // COMMENT THIS TO ALWAYS SHOW TOOLTIP FOR TESTING

  createTooltipStyle();
  
  const tooltip = document.createElement('div');
  tooltip.className = 'shift-tooltip';
  tooltip.innerHTML = 'For Shift add-on in Docs, use Extensions menu or <a href="https://workspace.google.com/marketplace/app/shift_fix_hebrewenglish_keyboard_mistake/90353626290" target="_blank">click here</a>';
  
  document.body.appendChild(tooltip);
  
  // Remove tooltip after 600ms
  setTimeout(() => {
    tooltip.remove();
  }, 1500);
}
