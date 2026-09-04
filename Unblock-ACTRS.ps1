# ACTRS - Unblock helper.
#
# Windows tags every file extracted from a ZIP that was downloaded
# from the internet (including a Cowork/browser download) with a
# hidden "this came from another computer" marker (the Mark of the
# Web). Batch files like Start-ACTRS.bat are blocked from running
# until that marker is removed - that's the "These files can't be
# opened - Your Internet security settings prevented one or more
# files from being opened" Windows Security dialog.
#
# This script removes that marker from every file in this folder, so
# Start-ACTRS.bat (and everything it calls) is allowed to run.
#
# HOW TO RUN THIS:
#   Right-click this file (Unblock-ACTRS.ps1) in File Explorer and
#   choose "Run with PowerShell". Do NOT just double-click it - by
#   default Windows opens .ps1 files in a text editor instead of
#   running them.
#
# You only need to run this once per download - it does not need to
# be run again unless you download a fresh copy of ACTRS.

Write-Host "============================================================"
Write-Host " ACTRS - Unblocking downloaded files"
Write-Host "============================================================"
Write-Host ""

$folder = $PSScriptRoot
$items = Get-ChildItem -Path $folder -Recurse -File -ErrorAction SilentlyContinue

$count = 0
foreach ($item in $items) {
    try {
        Unblock-File -Path $item.FullName -ErrorAction Stop
        $count++
    } catch {
        # Not every file will actually have a block on it - that's fine,
        # Unblock-File simply has nothing to do for those.
    }
}

Write-Host "Done. Checked $($items.Count) file(s) in:"
Write-Host "  $folder"
Write-Host ""
Write-Host "You can now close this window and double-click Start-ACTRS.bat."
Write-Host ""
Read-Host "Press Enter to close this window"
