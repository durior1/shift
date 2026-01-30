#Requires AutoHotkey v2

; ---------------------------------------------------------
; Global state (for Office undo)
; ---------------------------------------------------------
global undoActive := false
global undoText := ""
global undoStart := 0
global undoEnd := 0

global shiftDown := false
global otherKey := false
global shiftTapHandled := false

; ---------------------------------------------------------
; App detection
; ---------------------------------------------------------
GetActiveExe() {
    hwnd := WinGetID("A")
    return WinGetProcessName(hwnd)
}

IsOfficeApp(exe) {
    return exe ~= "i)^(winword|outlook|powerpnt|excel).exe$"
}

IsChromeFamily(exe) {
    return exe ~= "i)^(chrome|msedge|brave|opera).exe$"
}

IsGoogleSuiteTab() {
    title := WinGetTitle("A")
    return title ~= "Google Docs|Google Sheets|Google Slides"
}

; ---------------------------------------------------------
; Office COM selection: get text + indices when possible
; ---------------------------------------------------------
TryGetOfficeSelection(&text, &start, &end) {
    text := ""
    start := 0
    end := 0

    ; Word
    try {
        word := ComObjActive("Word.Application")
        sel := word.Selection
        if (sel.Type = 2) {
            text := sel.Text
            if (SubStr(text, -1) = "`n" || SubStr(text, -1) = "`r")
                text := SubStr(text, 1, -1)
            start := sel.Start
            end := sel.End
            return true
        }
    }

    ; Outlook (Word editor)
    try {
        outlook := ComObjActive("Outlook.Application")
        editor := outlook.ActiveInspector().WordEditor.Application
        sel := editor.Selection
        if (sel.Type = 2) {
            text := sel.Text
            start := sel.Start
            end := sel.End
            return true
        }
    }

    ; PowerPoint (no real indices)
    try {
        ppt := ComObjActive("PowerPoint.Application")
        tr := ppt.ActiveWindow.Selection.TextRange
        text := tr.Text
        start := 1
        end := StrLen(text)
        return true
    }

    ; Excel (cell text)
    try {
        excel := ComObjActive("Excel.Application")
        text := excel.ActiveCell.Text
        start := 1
        end := StrLen(text)
        return true
    }

    return false
}

; ---------------------------------------------------------
; Google Suite handler (unchanged)
; ---------------------------------------------------------
HandleGoogleSuiteShiftTap() {
    oldClip := A_Clipboard

    if (oldClip = "") {
        gui2 := Gui("+AlwaysOnTop -Caption +ToolWindow")
        gui2.SetFont("s12")
        gui2.Add("Text", , "Shift: in Google - copy text, then press shift")
        gui2.Show("AutoSize Center")
        WinActivate("A")
        Sleep 3000
        gui2.Destroy()
        return
    }

    Send "!h"
    Sleep 120
    Send "{Shift down}"
    Sleep 50
    Send "{Shift up}"
    Sleep 200
    Send "{Esc}"

    loop 50 {
        Sleep 200
        if (A_Clipboard != oldClip) {
            gui2 := Gui("+AlwaysOnTop -Caption +ToolWindow")
            gui2.SetFont("s12")
            gui2.Add("Text", , "Now paste the fixed text")
            gui2.Show("AutoSize Center")
            WinActivate("A")
            Sleep 3000
            gui2.Destroy()
            return
        }
    }
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

    ; Ignore plain Chrome tabs (non‑Google Suite)
    if IsChromeFamily(exe) && !IsGoogleSuiteTab()
        return

    if (shiftDown && !otherKey && !shiftTapHandled) {
        shiftTapHandled := true
        HandleShiftTap()
    }
    shiftDown := false
}

~*:: {
    global shiftDown, otherKey
    if (shiftDown)
        otherKey := true
}

; ---------------------------------------------------------
; Main logic
; ---------------------------------------------------------
HandleShiftTap() {
    global undoActive, undoText, undoStart, undoEnd

    exe := GetActiveExe()

    ; Google Docs/Sheets/Slides → special handler
    if IsChromeFamily(exe) && IsGoogleSuiteTab() {
        return HandleGoogleSuiteShiftTap()
    }

    ; Office apps → COM-based logic
    if IsOfficeApp(exe) {
        local text, start, end
        if !TryGetOfficeSelection(&text, &start, &end)
            return

        if (text = "")
            return

        ; -------------------------
        ; UNDO MODE
        ; -------------------------
        if (undoActive) {
            ; Only undo if selection indices match what we stored
            if (start = undoStart && end = undoEnd) {
                TryOfficeUndo()
                return
            } else {
                ; Selection changed → treat this as a new translation
                undoActive := false
            }
        }

        ; -------------------------
        ; NORMAL TRANSLATION MODE
        ; -------------------------
        undoActive := true
        undoText := text
        undoStart := start
        undoEnd := end

        lang := DetectLanguage(text)
        shifted := TranslateText(text, lang)

        TryOfficeReplaceAndReselect(shifted)
        return
    }

    ; Everything else → do nothing
}

; ---------------------------------------------------------
; Office replace + reselect
; ---------------------------------------------------------
TryOfficeReplaceAndReselect(newText) {
    global undoStart, undoEnd

    ; Word
    try {
        word := ComObjActive("Word.Application")
        sel := word.Selection

        ; Replace original range
        sel.SetRange(undoStart, undoEnd)
        sel.Text := newText

        ; Reselect the newly inserted text
        newEnd := undoStart + StrLen(newText)
        sel.SetRange(undoStart, newEnd)

        ; Update undo range
        undoEnd := newEnd
        return
    }

    ; Outlook (Word editor)
    try {
        outlook := ComObjActive("Outlook.Application")
        editor := outlook.ActiveInspector().WordEditor.Application
        sel := editor.Selection

        sel.SetRange(undoStart, undoEnd)
        sel.Text := newText

        newEnd := undoStart + StrLen(newText)
        sel.SetRange(undoStart, newEnd)

        undoEnd := newEnd
        return
    }

    ; PowerPoint: no indices → just overwrite and reselect whole range
    try {
        ppt := ComObjActive("PowerPoint.Application")
        tr := ppt.ActiveWindow.Selection.TextRange
        tr.Text := newText
        tr.Select()

        undoStart := 1
        undoEnd := StrLen(newText)
        return
    }

    ; Excel: overwrite cell and select entire cell text
    try {
        excel := ComObjActive("Excel.Application")
        excel.ActiveCell.Value := newText
        excel.ActiveCell.Select()

        undoStart := 1
        undoEnd := StrLen(newText)
        return
    }
}

; ---------------------------------------------------------
; Office undo
; ---------------------------------------------------------
TryOfficeUndo() {
    global undoActive, undoText, undoStart, undoEnd

    ; Word
    try {
        word := ComObjActive("Word.Application")
        sel := word.Selection
        sel.SetRange(undoStart, undoEnd)
        sel.Text := undoText
        sel.SetRange(undoStart, undoStart + StrLen(undoText))
        undoActive := false
        return
    }

    ; Outlook
    try {
        outlook := ComObjActive("Outlook.Application")
        editor := outlook.ActiveInspector().WordEditor.Application
        sel := editor.Selection
        sel.SetRange(undoStart, undoEnd)
        sel.Text := undoText
        sel.SetRange(undoStart, undoStart + StrLen(undoText))
        undoActive := false
        return
    }

    ; PowerPoint
    try {
        ppt := ComObjActive("PowerPoint.Application")
        tr := ppt.ActiveWindow.Selection.TextRange
        tr.Text := undoText
        tr.Select()
        undoActive := false
        return
    }

    ; Excel
    try {
        excel := ComObjActive("Excel.Application")
        excel.ActiveCell.Value := undoText
        excel.ActiveCell.Select()
        undoActive := false
        return
    }
}

; ---------------------------------------------------------
; Language detection & translation
; ---------------------------------------------------------
DetectLanguage(text) {
    eng := 0, heb := 0
    for ch in StrSplit(text, "") {
        if EngCharToCode.Has(ch)
            eng++
        if HebCharToCode.Has(ch)
            heb++
    }
    return (heb > eng) ? "he" : "en"
}

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

EngCodeToChar := Map()
for k, v in EngCharToCode
    EngCodeToChar[v] := k

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

HebCodeToChar := Map()
for k, v in HebCharToCode
    HebCodeToChar[v] := k