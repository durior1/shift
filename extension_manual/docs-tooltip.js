/**
 * Google Docs Tooltip Initializer
 * Shared by both automatic and manual extensions
 */

if (location.hostname.includes('docs.google.com')) {
  showDocsTooltip().catch(err => console.error('[Shift] Tooltip error:', err));
}
