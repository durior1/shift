#Requires AutoHotkey v2
#Include UIA.ahk

; ---------------------------------------------------------
; Global state
; ---------------------------------------------------------
global undoActive := false
global undoText := ""

global shiftDown := false
global otherKey := false
global shiftTapHandled := false

; ---------------------------------------------------------
; App detection helpers
; ---------------------------------------------------------
GetActiveExe() {
    hwnd := WinGetID("A")
    return WinGetProcessName(hwnd)
}

IsChromeFamily(exe) {
    return exe ~= "i)^(chrome|msedge|brave|opera).exe$"
}

IsVSCode(exe) {
    return exe ~= "i)^code(.exe)?$"
}

IsOfficeApp(exe) {
    return exe ~= "i)^(winword|excel|powerpnt|outlook|teams).exe$"
}

; ---------------------------------------------------------
; Clipboard sentinel method
; ---------------------------------------------------------
CopyViaClipboard(timeoutMs := 1500) {
    sentinel := "__WAITING__"
    Clipboard := sentinel
    Send "^c"

    start := A_TickCount
    while (Clipboard = sentinel) {
        if (A_TickCount - start > timeoutMs)
            return ""
        Sleep 20
    }

    text := Clipboard
    if !(text is String) {
        tmp := Clipboard
        Sleep 30
        text := Clipboard
    }
    return text
}

; ---------------------------------------------------------
; Office COM selection
; ---------------------------------------------------------
CopyViaCOM() {
    try {
        word := ComObjActive("Word.Application")
        return word.Selection.Text
    }
    catch {
        return ""
    }

    try {
        excel := ComObjActive("Excel.Application")
        return excel.ActiveCell.Text
    }
    catch {
        return ""
    }

    try {
        ppt := ComObjActive("PowerPoint.Application")
        return ppt.ActiveWindow.Selection.TextRange.Text
    }
    catch {
        return ""
    }

    try {
        outlook := ComObjActive("Outlook.Application")
        return outlook.ActiveInspector().WordEditor.Application.Selection.Text
    }
    catch {
        return ""
    }

    try {
        teams := ComObjActive("Teams.Application")
    }
    catch {
        return ""
    }

    return ""
}

; ---------------------------------------------------------
; UIA selection
; ---------------------------------------------------------
CopyViaUIA() {
    try {
        focused := UIA.GetFocusedElement()
        tp := focused.GetTextPattern()
        ranges := tp.GetSelection()
        if (ranges.Length > 0)
            return ranges[1].GetText(-1)
    }
    catch {
        return ""
    }
    return ""
}

; ---------------------------------------------------------
; Universal selection engine
; ---------------------------------------------------------
GetSelectedText() {
    exe := GetActiveExe()

    if IsChromeFamily(exe)
        return ""

    if IsOfficeApp(exe) {
        t := CopyViaCOM()
        if (t != "")
            return t
    }

    if IsVSCode(exe) {
        t := CopyViaClipboard()
        if (t != "")
            return t
    }

    t := CopyViaUIA()
    if (t != "")
        return t

    return CopyViaClipboard()
}

; ---------------------------------------------------------
; SHIFT TAP DETECTION (Chrome ignored)
; ---------------------------------------------------------
~LShift:: {
    global shiftDown, otherKey, shiftTapHandled
    shiftDown := true
    otherKey := false
    shiftTapHandled := false
}

~RShift:: {
    global shiftDown, otherKey, shiftTapHandled
    shiftDown := true
    otherKey := false
    shiftTapHandled := false
}

~LShift up:: HandleShiftRelease()
~RShift up:: HandleShiftRelease()

HandleShiftRelease() {
    global shiftDown, otherKey, shiftTapHandled

    exe := GetActiveExe()
    if IsChromeFamily(exe)
        return

    if (shiftDown && !otherKey && !shiftTapHandled) {
        shiftTapHandled := true
        HandleShiftTap()
    }
    shiftDown := false
}

~*:: {
    global shiftDown, otherKey
    if (shiftDown && A_PriorKey != "Shift")
        otherKey := true
}

; ---------------------------------------------------------
; Keyboard layout helpers
; ---------------------------------------------------------
GetKeyboardLayoutID() {
    threadID := DllCall("GetWindowThreadProcessId", "ptr", WinGetID("A"), "uint*", 0, "uint")
    layout := DllCall("GetKeyboardLayout", "uint", threadID, "ptr")
    return layout & 0xFFFF
}

ToggleLayout() {
    Send "# "
    Sleep 80
}

EnsureLayout(target) {
    attempts := 0
    while (GetKeyboardLayoutID() != target && attempts < 5) {
        ToggleLayout()
        attempts++
    }
}

; ---------------------------------------------------------
; Type characters using the correct layout (no restore)
; ---------------------------------------------------------
TypeWithLayout(str, targetLayout) {
    EnsureLayout(targetLayout)

    for ch in StrSplit(str, "") {
        if EngCharToCode.Has(ch) {
            Send "{" EngCharToCode[ch] "}"
        } else {
            Send ch
        }
    }
}

; ---------------------------------------------------------
; Main logic: copy → translate → type
; ---------------------------------------------------------
HandleShiftTap() {
    global undoActive, undoText

    text := GetSelectedText()
    if (text = "")
        return

    if (undoActive) {
        ; Undo: type original text in correct layout
        lang := DetectLanguage(undoText)
        if (lang = "en")
            TypeWithLayout(undoText, 0x040D)
        else
            TypeWithLayout(undoText, 0x0409)

        undoActive := false
        return
    }

    undoText := text
    undoActive := true

    lang := DetectLanguage(text)
    shifted := TranslateText(text, lang)

    if (lang = "en")
        TypeWithLayout(shifted, 0x040D) ; Hebrew
    else
        TypeWithLayout(shifted, 0x0409) ; English
}

; ---------------------------------------------------------
; Detect language
; ---------------------------------------------------------
DetectLanguage(text) {
    engCount := 0
    hebCount := 0

    for ch in StrSplit(text, "") {
        if EngCharToCode.Has(ch)
            engCount++
        if HebCharToCode.Has(ch)
            hebCount++
    }

    return (hebCount > engCount) ? "he" : "en"
}

; ---------------------------------------------------------
; Translate text
; ---------------------------------------------------------
TranslateText(text, lang) {
    out := ""
    for ch in StrSplit(text, "")
        out .= TranslateChar(ch, lang)
    return out
}

TranslateChar(ch, lang) {
    if (ch != StrLower(ch))
        return ch

    if (lang = "en") {
        if EngCharToCode.Has(ch) {
            code := EngCharToCode[ch]
            return HebCodeToChar.Has(code) ? HebCodeToChar[code] : ch
        }
        return ch
    } else {
        if HebCharToCode.Has(ch) {
            code := HebCharToCode[ch]
            return EngCodeToChar.Has(code) ? EngCodeToChar[code] : ch
        }
        return ch
    }
}

; ---------------------------------------------------------
; Mapping tables
; ---------------------------------------------------------
EngCodeToChar := Map(
    "KeyA", "a", "KeyB", "b", "KeyC", "c", "KeyD", "d", "KeyE", "e", "KeyF", "f", "KeyG", "g", "KeyH", "h",
    "KeyI", "i", "KeyJ", "j", "KeyK", "k", "KeyL", "l", "KeyM", "m", "KeyN", "n", "KeyO", "o", "KeyP", "p",
    "KeyQ", "q", "KeyR", "r", "KeyS", "s", "KeyT", "t", "KeyU", "u", "KeyV", "v", "KeyW", "w", "KeyX", "x",
    "KeyY", "y", "KeyZ", "z",
    "Digit0", "0", "Digit1", "1", "Digit2", "2", "Digit3", "3", "Digit4", "4", "Digit5", "5", "Digit6", "6",
    "Digit7", "7", "Digit8", "8", "Digit9", "9",
    "Minus", "-", "Equal", "=", "BracketLeft", "[", "BracketRight", "]", "Backslash", "\\", "Semicolon", ";",
    "Quote", "'", "Comma", ",", "Period", ".", "Slash", "/", "Backquote", "``"
)

EngCharToCode := Map(
    "a", "KeyA", "b", "KeyB", "c", "KeyC", "d", "KeyD", "e", "KeyE", "f", "KeyF", "g", "KeyG", "h", "KeyH",
    "i", "KeyI", "j", "KeyJ", "k", "KeyK", "l", "KeyL", "m", "KeyM", "n", "KeyN", "o", "KeyO", "p", "KeyP",
    "q", "KeyQ", "r", "KeyR", "s", "KeyS", "t", "KeyT", "u", "KeyU", "v", "KeyV", "w", "KeyW", "x", "KeyX",
    "y", "KeyY", "z", "KeyZ",
    "0", "Digit0", "1", "Digit1", "2", "Digit2", "3", "Digit3", "4", "Digit4", "5", "Digit5", "6", "Digit6",
    "7", "Digit7", "8", "Digit8", "9", "Digit9",
    "-", "Minus", "=", "Equal", "[", "BracketLeft", "]", "BracketRight", "\\", "Backslash", ";", "Semicolon",
    "'", "Quote", ",", "Comma", ".", "Period", "/", "Slash", "``", "Backquote"
)

HebCodeToChar := Map(
    "KeyA", "ש", "KeyB", "נ", "KeyC", "ב", "KeyD", "ג", "KeyE", "ק", "KeyF", "כ", "KeyG", "ע", "KeyH", "י",
    "KeyI", "ן", "KeyJ", "ח", "KeyK", "ל", "KeyL", "ך", "KeyM", "צ", "KeyN", "מ", "KeyO", "ם", "KeyP", "פ",
    "KeyQ", "/", "KeyR", "ר", "KeyS", "ד", "KeyT", "א", "KeyU", "ו", "KeyV", "ה", "KeyW", "'", "KeyX", "ס",
    "KeyY", "ט", "KeyZ", "ז",
    "Digit0", "0", "Digit1", "1", "Digit2", "2", "Digit3", "3", "Digit4", "4", "Digit5", "5", "Digit6", "6",
    "Digit7", "7", "Digit8", "8", "Digit9", "9",
    "Minus", "-", "Equal", "=", "BracketLeft", "[", "BracketRight", "]", "Backslash", "\\", "Semicolon", "ף",
    "Quote", ",", "Comma", "ת", "Period", "ץ", "Slash", ".", "Backquote", ";"
)

HebCharToCode := Map(
    "ש", "KeyA", "נ", "KeyB", "ב", "KeyC", "ג", "KeyD", "ק", "KeyE", "כ", "KeyF", "ע", "KeyG", "י", "KeyH",
    "ן", "KeyI", "ח", "KeyJ", "ל", "KeyK", "ך", "KeyL", "צ", "KeyM", "מ", "KeyN", "ם", "KeyO", "פ", "KeyP",
    "/", "KeyQ", "ר", "KeyR", "ד", "KeyS", "א", "KeyT", "ו", "KeyU", "ה", "KeyV", "'", "KeyW", "ס", "KeyX",
    "ט", "KeyY", "ז", "KeyZ",
    "0", "Digit0", "1", "Digit1", "2", "Digit2", "3", "Digit3", "4", "Digit4", "5", "Digit5", "6", "Digit6",
    "7", "Digit7", "8", "Digit8", "9", "Digit9",
    "-", "Minus", "=", "Equal", "[", "BracketLeft", "]", "BracketRight", "\\", "Backslash", "ף", "Semicolon",
    ",", "Quote", "ת", "Comma", "ץ", "Period", ".", "Slash", ";", "Backquote"
)