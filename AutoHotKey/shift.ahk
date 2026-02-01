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
global unsupportedDialogShown := false

; ---------------------------------------------------------
; App detection
; ---------------------------------------------------------
GetActiveExe() {
    hwnd := WinGetID("A")
    return WinGetProcessName(hwnd)
}

IsWordApp(exe) {
    return exe ~= "i)^(winword).exe$"
}

IsPowerPointApp(exe) {
    return exe ~= "i)^(powerpnt).exe$"
}

IsOfficeApp(exe) {
    return IsWordApp(exe) || IsPowerPointApp(exe)
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
    OutputDebug("Trying to get Office selection")
    text := ""
    start := 0
    end := 0

    ; Word
    if (IsWordApp(GetActiveExe()))
        try {
            OutputDebug("Trying Word selection")
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

    ; PowerPoint (no real indices)
    if (IsPowerPointApp(GetActiveExe()))
        try {
            OutputDebug("Trying PowerPoint selection")
            ppt := ComObjActive("PowerPoint.Application")
            tr := ppt.ActiveWindow.Selection.TextRange
            text := tr.Text
            OutputDebug("Raw PowerPoint text: " . text)
            if (SubStr(text, -1) = "`n" || SubStr(text, -1) = "`r")
                text := SubStr(text, 1, -1)
            OutputDebug("Cleaned PowerPoint text: " . text)
            start := tr.Start
            end := tr.Start + tr.Length
            OutputDebug("PowerPoint selection: " . text . " [" . start . "," . end . "]")
            return true
        }

    return false
}

; ---------------------------------------------------------
; Google Suite handler (unchanged)
; ---------------------------------------------------------
HandleGoogleSuiteShiftTap() {
    oldClip := A_Clipboard

    ; Helper to show popup on same screen as active window
    ShowLocalPopup(text) {
        local gui1
        hwnd := WinGetID("A")
        WinGetPos(&x, &y, &w, &h, hwnd)

        gui1 := Gui("+AlwaysOnTop -Caption +ToolWindow")
        gui1.SetFont("s12")
        gui1.Add("Text", , text)

        ; Center relative to active window
        gui1.Show("AutoSize x" . (x + w // 2 - 150) . " y" . (y + h // 2 - 50))

        WinActivate("A")
        Sleep 3000
        gui1.Destroy()
    }

    if (oldClip = "") {
        ShowLocalPopup("Shift: in Google - copy text, then press shift")
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
            ShowLocalPopup("Now paste the fixed text")
            return
        }
    }
}

; ---------------------------------------------------------
; SHIFT TAP DETECTION
; ---------------------------------------------------------
~LShift::
~RShift::
{
    global shiftDown, otherKey, shiftTapHandled
    shiftDown := true
    otherKey := false
    shiftTapHandled := false

    ih := InputHook("V") ; V = visible, but we only use it to detect keys
    ih.KeyOpt("{All}", "E") ; E = end on any key
    ih.KeyOpt("{LShift}", "-E") ; don't end on Shift
    ih.KeyOpt("{RShift}", "-E")

    ih.Start()
    ih.Wait() ; waits until a non-shift key is pressed

    if (ih.EndKey != "")  ; some other key was pressed
        otherKey := true
    return
}

~LShift up:: HandleShiftRelease()
~RShift up:: HandleShiftRelease()

HandleShiftRelease() {
    OutputDebug("Shift released")
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

ShowUnsupportedDialog() {
    GuiWarn := Gui("+AlwaysOnTop", "Shift plugin doesn't support this app")
    GuiWarn.Add("Text", "w300",
        "Shift plugin for AutoHotKey doesn't support automatic language switching in this application.")
    GuiWarn.Add("Text", "w300", "This is because the application doesn't expose text selection information via COM.")
    GuiWarn.Add("Text", "w300",
        "Shift functionality is available in Chromium-based browsers, as well as Microsoft Word and PowerPoint.")
    GuiWarn.Add("Text", "w300",
        "Support our request for Microsoft to add this functionality directly into Windows to enable broader compatibility."
    )
    GuiWarn.Add("Link", "w300",
        '<a href="https://shift-language-corrector-acae6007.base44.app">Learn more and vote for Windows support</a>')
    GuiWarn.Add("Button", "Default", "OK").OnEvent("Click", (*) => GuiWarn.Destroy())
    GuiWarn.Show()
}

MaybeShowUnsupportedDialog() {
    global unsupportedDialogShown

    if (unsupportedDialogShown)
        return

    unsupportedDialogShown := true
    ShowUnsupportedDialog()
}

; ---------------------------------------------------------
; Main logic
; ---------------------------------------------------------
HandleShiftTap() {
    global undoActive, undoText, undoStart, undoEnd
    OutputDebug("Handling shift tap")

    exe := GetActiveExe()
    OutputDebug("Active exe: " . exe)

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

    ; Everything else → unsupported dialog if not shown yet
    MaybeShowUnsupportedDialog()
}

; ---------------------------------------------------------
; Office replace + reselect
; ---------------------------------------------------------
TryOfficeReplaceAndReselect(newText) {
    global undoStart, undoEnd

    ; Word
    if (IsWordApp(GetActiveExe()))
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

    ; PowerPoint: no indices → just overwrite and reselect whole range
    if (IsPowerPointApp(GetActiveExe()))
        try {
            ppt := ComObjActive("PowerPoint.Application")
            tr := ppt.ActiveWindow.Selection.TextRange
            tr.Text := newText
            tr.Select()

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
    if (IsWordApp(GetActiveExe()))
        try {
            word := ComObjActive("Word.Application")
            sel := word.Selection
            sel.SetRange(undoStart, undoEnd)
            sel.Text := undoText
            sel.SetRange(undoStart, undoStart + StrLen(undoText))
            undoActive := false
            return
        }

    ; PowerPoint
    if (IsPowerPointApp(GetActiveExe()))
        try {
            ppt := ComObjActive("PowerPoint.Application")
            tr := ppt.ActiveWindow.Selection.TextRange
            tr.Text := undoText
            tr.Select()
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