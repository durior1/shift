/**
 * Shared Tooltip Utility for Shift Extensions
 * Used by both automatic and manual extensions
 */

function createTooltipStyle() {
  const style = document.createElement('style');
  style.textContent = `
    .shift-tooltip {
      position: fixed;
      top: 20px;
      right: 20px;
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
        transform: translateX(20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
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
  
  if (!shouldShow) return; // COMMENT THIS TO ALWAYS SHOW TOOLTIP FOR TESTING

  createTooltipStyle();
  
  const tooltip = document.createElement('div');
  tooltip.className = 'shift-tooltip';
  tooltip.textContent = 'Shift available in Docs through Extensions menu';
  
  document.body.appendChild(tooltip);
  
  // Remove tooltip after 300ms
  setTimeout(() => {
    tooltip.remove();
  }, 300);
}
