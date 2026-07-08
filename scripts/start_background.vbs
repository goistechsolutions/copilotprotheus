Set WshShell = CreateObject("WScript.Shell")
' 0 = Hide window
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\start_all.ps1""", 0, False
