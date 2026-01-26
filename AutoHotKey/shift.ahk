#Requires AutoHotkey v2
#Include UIA.ahk

; ---------------------------------------------------------
; Global state
; ---------------------------------------------------------
global undoActive := false
global undoText := ""
global undoLength := 0

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

IsVSCode(exe) {
    return exe ~= "i)^code(.exe)?$"
}

IsOfficeApp(exe) {
    return exe ~= "i)^(winword|excel|powerpnt|outlook|teams).exe$"
}

IsChromeFamily(exe) {
    return exe ~= "i)^(chrome|msedge|brave|opera).exe$"
}

IsGoogleSuiteTab() {
    title := WinGetTitle("A")
    return title ~= "Google Docs|Google Sheets|Google Slides"
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
        sel := word.Selection

        if (sel.Type != 2)
            return ""
        else {
            txt := sel.Text
            if (SubStr(txt, -1) = "`n" || SubStr(txt, -1) = "`r")
                txt := SubStr(txt, 1, -1)
            return txt
        }
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
; SHIFT TAP DETECTION
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
    if IsChromeFamily(exe) && !IsGoogleSuiteTab()
        return

    OutputDebug("Shift released. otherKey=" . otherKey . ", shiftTapHandled=" . shiftTapHandled)
    if (shiftDown && !otherKey && !shiftTapHandled) {
        shiftTapHandled := true
        HandleShiftTap()
    }
    shiftDown := false
}

~*:: {
    global shiftDown, otherKey
    if (shiftDown) {
        otherKey := true
        OutputDebug("Other key pressed while Shift is down: " . A_PriorKey)
    }
}

; All Shift+special keys mark otherKey := true
~+End:: global otherKey := true
~+Home:: global otherKey := true
~+PgUp:: global otherKey := true
~+PgDn:: global otherKey := true
~+Left:: global otherKey := true
~+Right:: global otherKey := true
~+Up:: global otherKey := true
~+Down:: global otherKey := true
~+Delete:: global otherKey := true
~+Insert:: global otherKey := true
~+Backspace:: global otherKey := true
~+Tab:: global otherKey := true
~+Enter:: global otherKey := true
~+F1:: global otherKey := true
~+F2:: global otherKey := true
~+F3:: global otherKey := true
~+F4:: global otherKey := true
~+F5:: global otherKey := true
~+F6:: global otherKey := true
~+F7:: global otherKey := true
~+F8:: global otherKey := true
~+F9:: global otherKey := true
~+F10:: global otherKey := true
~+F11:: global otherKey := true
~+F12:: global otherKey := true
~+Esc:: global otherKey := true
~+Space:: global otherKey := true
~+AppsKey:: global otherKey := true
~+LWin:: global otherKey := true
~+RWin:: global otherKey := true
~+Ctrl:: global otherKey := true
~+Alt:: global otherKey := true
~+PrintScreen:: global otherKey := true
~+ScrollLock:: global otherKey := true
~+Pause:: global otherKey := true
~+CapsLock:: global otherKey := true
~+NumLock:: global otherKey := true

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

TypeWithLayout(str, targetLayout) {
    EnsureLayout(targetLayout)
    for ch in StrSplit(str, "")
        Send ch
}

; ---------------------------------------------------------
; Selection helpers
; ---------------------------------------------------------
x_to_y_step_k(&i, x, y, k := 1) {
    return (i := x + (a_index - 1)) <= y ? (a_index += k - 1, true) : (i -= k, false)
}

SelectNChars(n) {
    i := 0
    while x_to_y_step_k(&i, 1, n)
        Send "+{Left}"
}

; ---------------------------------------------------------
; Google Suite Shift‑tap handler
; ---------------------------------------------------------
HandleGoogleSuiteShiftTap() {
    local gui2  ; Declare GUI variables as local
    oldClip := A_Clipboard
    OutputDebug("Google Suite Shift‑tap: copied clipboard length=" . StrLen(oldClip))
    ; If clipboard is empty, show guidance message and exit early
    if (oldClip = "") {
        gui2 := Gui("+AlwaysOnTop -Caption +ToolWindow")
        gui2.SetFont("s12")
        gui2.Add("Text", , "Shift: in Google - copy text, then press shift")
        gui2.Show("AutoSize Center")

        ; Refocus Chrome so user can copy
        exe := GetActiveExe()
        WinActivate("ahk_exe " exe)

        Sleep 3000
        gui2.Destroy()
        return
    }
    OutputDebug("Google Suite Shift‑tap detected")

    Send "!h"
    Sleep 120
    OutputDebug("Sent Alt+h to remove canvas focus")

    Send "{Shift down}"
    Sleep 50
    Send "{Shift up}"
    OutputDebug("Sent synthetic Shift keypress")

    Sleep 200
    OutputDebug("sending Escape")
    Send "{Esc}"

    changed := false

    loop 50 {
        Sleep 200
        if (A_Clipboard != oldClip) {
            OutputDebug("change detected in clipboard")
            changed := true
            break
        }
    }

    if changed {
        gui2 := Gui("+AlwaysOnTop -Caption +ToolWindow")
        gui2.SetFont("s12")
        gui2.Add("Text", , "Now paste the fixed text")
        gui2.Show("AutoSize Center")

        ; Move focus back to Chrome window
        exe := GetActiveExe()
        WinActivate("ahk_exe " exe)

        ; gui2 stays on top because of +AlwaysOnTop
        Sleep 3000
        gui2.Destroy()
        return
    }

}

; ---------------------------------------------------------
; Main logic: copy → translate → type
; ---------------------------------------------------------
HandleShiftTap() {
    global undoActive, undoText, undoLength

    exe := GetActiveExe()
    if IsChromeFamily(exe) && IsGoogleSuiteTab() {
        return HandleGoogleSuiteShiftTap()
    }

    text := GetSelectedText()
    if (text = "") {
        OutputDebug("No text selected, aborting.")
        return
    }

    if (undoActive) {
        OutputDebug("Performing undo of previous translation: '" . undoText . "' length=" . undoLength)
        SelectNChars(undoLength)
        lang := DetectLanguage(undoText)

        if (lang = "en")
            TypeWithLayout(undoText, 0x040D)
        else
            TypeWithLayout(undoText, 0x0409)

        SelectNChars(undoLength)
        undoActive := false
        return
    }

    undoText := text
    undoActive := true

    lang := DetectLanguage(text)
    shifted := TranslateText(text, lang)
    undoLength := StrLen(shifted)

    if (lang = "en")
        TypeWithLayout(shifted, 0x040D)
    else
        TypeWithLayout(shifted, 0x0409)

    SelectNChars(undoLength)
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