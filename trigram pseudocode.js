// TODO store the location of first trigram in current language, so we can select all of its text when language change is detected
// Load your trigram lists (you’ll replace these with your real JSON)
import hebrewTrigrams from "./hebrew_trigrams.json";
import englishTrigrams from "./english_trigrams.json";

const hebSet = new Set(hebrewTrigrams);
const engSet = new Set(englishTrigrams);

// State
let buffer = "";                 // last typed characters
let currentLanguage = null;      // "he" | "en" | null
let lastFocusedElement = null;

// Utility: determine language of a trigram
function detectTrigramLanguage(trigram) {
    const inHeb = hebSet.has(trigram);
    const inEng = engSet.has(trigram);

    if (inHeb && !inEng) return "he";
    if (inEng && !inHeb) return "en";
    return null; // ambiguous or unknown
}

// Handle typing
function handleInputEvent(e) {
    const el = e.target;

    // If focus changed, reset state
    if (el !== lastFocusedElement) {
        resetState();
        lastFocusedElement = el;
    }

    // Only track text inputs / editable elements
    if (!isEditable(el)) return;

    // Update buffer
    buffer += e.data ?? ""; // e.data is the typed character
    if (buffer.length > 3) buffer = buffer.slice(-3);

    if (buffer.length === 3) {
        const trigramLang = detectTrigramLanguage(buffer);

        if (currentLanguage === null) {
            // First detection
            if (trigramLang) {
                currentLanguage = trigramLang;
                console.log("Initial language:", currentLanguage);
            }
        } else {
            // Already have a language — check for switch
            if (trigramLang && trigramLang !== currentLanguage) {
                console.log("Language switched to:", trigramLang);
                currentLanguage = trigramLang;
            }
        }
    }
}

// Detect selection changes (arrow keys, mouse selection)
function handleSelectionChange() {
    resetState();
}

//TODO do we need this, or does handleSelectionChange cover it?
function handleKeydown(e) {
    // Arrow keys or navigation keys → reset
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        resetState();
    }
}

function isEditable(el) {
    return (
        el instanceof HTMLInputElement && el.type === "text" ||
        el instanceof HTMLTextAreaElement ||
        el.isContentEditable
    );
}

function resetState() {
    buffer = "";
    currentLanguage = null;
}

// Attach listeners
document.addEventListener("input", handleInputEvent, true);
document.addEventListener("selectionchange", handleSelectionChange, true);
document.addEventListener("keydown", handleKeydown, true);
