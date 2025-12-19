# Find Hard-Coded Colors in CSS Files
# This script scans all CSS files and reports hard-coded color values

Write-Host "SCANNING FOR HARD-CODED COLORS..." -ForegroundColor Cyan
Write-Host ""

$cssFiles = Get-ChildItem -Path "src" -Filter "*.css" -Recurse
$totalFiles = $cssFiles.Count
$filesWithIssues = 0
$totalIssues = 0

$colorPatterns = @(
    @{
        Name = "Hex Colors"
        Pattern = "#[0-9a-fA-F]{3,8}"
        Severity = "HIGH"
    },
    @{
        Name = "RGBA Colors"
        Pattern = "rgba\("
        Severity = "HIGH"
    },
    @{
        Name = "RGB Colors"
        Pattern = "rgb\("
        Severity = "HIGH"
    },
    @{
        Name = "!important Overuse"
        Pattern = "!important"
        Severity = "MEDIUM"
    }
)

foreach ($file in $cssFiles) {
    $fileHasIssues = $false
    $fileIssueCount = 0
    
    foreach ($pattern in $colorPatterns) {
        $matches = Select-String -Path $file.FullName -Pattern $pattern.Pattern -AllMatches
        
        if ($matches) {
            if (-not $fileHasIssues) {
                Write-Host "📄 $($file.FullName.Replace((Get-Location).Path, '.'))" -ForegroundColor Yellow
                $fileHasIssues = $true
                $filesWithIssues++
            }
            
            $matchCount = ($matches | Measure-Object).Count
            $fileIssueCount += $matchCount
            $totalIssues += $matchCount
            
            Write-Host "   [$($pattern.Severity)] $($pattern.Name): $matchCount occurrences" -ForegroundColor $(
                if ($pattern.Severity -eq "HIGH") { "Red" } else { "Yellow" }
            )
            
            # Show first 3 examples
            $examples = $matches | Select-Object -First 3
            foreach ($example in $examples) {
                Write-Host "      Line $($example.LineNumber): $($example.Line.Trim())" -ForegroundColor Gray
            }
        }
    }
    
    if ($fileHasIssues) {
        Write-Host "   Total issues in file: $fileIssueCount" -ForegroundColor Magenta
        Write-Host ""
    }
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "SUMMARY" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Total CSS files scanned: $totalFiles" -ForegroundColor White
Write-Host "Files with issues: $filesWithIssues" -ForegroundColor Yellow
Write-Host "Total issues found: $totalIssues" -ForegroundColor Red
Write-Host ""

if ($totalIssues -gt 0) {
    Write-Host "ACTION REQUIRED:" -ForegroundColor Red
    Write-Host "   Replace hard-coded colors with CSS variables from variables.css" -ForegroundColor White
    Write-Host ""
    Write-Host "   Example replacements:" -ForegroundColor White
    Write-Host "   color: #1E1E26           → color: var(--text-primary)" -ForegroundColor Gray
    Write-Host "   background: #FFFFFF      → background: var(--bg-surface)" -ForegroundColor Gray
    Write-Host "   border-color: #E2E4EC    → border-color: var(--border-subtle)" -ForegroundColor Gray
    Write-Host "   box-shadow: 0 2px 8px... → box-shadow: var(--shadow-soft)" -ForegroundColor Gray
} else {
    Write-Host "No hard-coded colors found! Theme system is clean." -ForegroundColor Green
}

Write-Host ""

