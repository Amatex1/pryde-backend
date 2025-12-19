# Batch fix theme overrides in all remaining component CSS files
# This script removes all [data-theme="dark"], body.dark-mode, and [data-quiet-mode="true"] selectors

$componentsPath = "src/components"
$filesFixed = 0
$totalIssuesFixed = 0

# Get all CSS files with theme overrides
$cssFiles = Get-ChildItem -Path $componentsPath -Filter "*.css" | Where-Object {
    $content = Get-Content $_.FullName -Raw
    $content -match '\[data-theme="dark"\]' -or $content -match 'body\.dark-mode' -or $content -match '\[data-quiet-mode="true"\]'
}

Write-Host "Found $($cssFiles.Count) files with theme overrides to fix..." -ForegroundColor Yellow

foreach ($file in $cssFiles) {
    Write-Host "`nProcessing: $($file.Name)" -ForegroundColor Cyan
    
    $content = Get-Content $file.FullName -Raw
    $originalLength = $content.Length
    $issuesInFile = 0
    
    # Count issues before fixing
    $darkThemeMatches = ([regex]::Matches($content, '\[data-theme="dark"\]')).Count
    $quietModeMatches = ([regex]::Matches($content, '\[data-quiet-mode="true"\]')).Count
    $bodyDarkMatches = ([regex]::Matches($content, 'body\.dark-mode')).Count
    $issuesInFile = $darkThemeMatches + $quietModeMatches + $bodyDarkMatches
    
    # Remove all [data-theme="dark"] blocks
    $content = $content -replace '(?s)/\*\s*=+\s*DARK MODE SUPPORT.*?\*/\s*\[data-theme="dark"\].*?(?=(/\*\s*=+|$))', ''
    $content = $content -replace '(?s)\[data-theme="dark"\][^\{]*\{[^\}]*\}\s*', ''
    
    # Remove all body.dark-mode blocks
    $content = $content -replace '(?s)/\*.*?Legacy dark mode.*?\*/\s*body\.dark-mode.*?(?=(/\*\s*=+|$))', ''
    $content = $content -replace '(?s)body\.dark-mode[^\{]*\{[^\}]*\}\s*', ''
    
    # Remove all [data-quiet-mode="true"] blocks
    $content = $content -replace '(?s)/\*\s*=+\s*QUIET MODE SUPPORT.*?\*/\s*\[data-quiet-mode="true"\].*?(?=(/\*\s*=+|$))', ''
    $content = $content -replace '(?s)\[data-quiet-mode="true"\][^\{]*\{[^\}]*\}\s*', ''
    
    # Remove body.quiet-mode blocks
    $content = $content -replace '(?s)body\.quiet-mode[^\{]*\{[^\}]*\}\s*', ''
    
    # Add theme support comment if not present
    if ($content -notmatch 'THEME SUPPORT') {
        $content = $content -replace '(?s)(/\*\s*=+\s*REDUCED MOTION)', "/* ========================================`n   THEME SUPPORT`n   All theming handled by CSS variables in variables.css`n   ======================================== */`n`n`$1"
    }
    
    # Clean up multiple blank lines
    $content = $content -replace '(\r?\n){3,}', "`n`n"
    
    # Save the fixed content
    Set-Content -Path $file.FullName -Value $content -NoNewline
    
    $newLength = $content.Length
    $reduction = $originalLength - $newLength
    
    Write-Host "  Fixed $issuesInFile theme overrides" -ForegroundColor Green
    Write-Host "  Reduced file size by $reduction characters" -ForegroundColor Green
    
    $filesFixed++
    $totalIssuesFixed += $issuesInFile
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "BATCH FIX COMPLETE!" -ForegroundColor Green
Write-Host "Files fixed: $filesFixed" -ForegroundColor Green
Write-Host "Total theme overrides removed: $totalIssuesFixed" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

