# PowerShell Script to remove .env files from Git history
# WARNING: This rewrites Git history - coordinate with team before running!

Write-Host "🚨 WARNING: This will rewrite Git history!" -ForegroundColor Red
Write-Host ""
Write-Host "📋 This script will:" -ForegroundColor Yellow
Write-Host "   1. Remove .env and server/.env from all commits"
Write-Host "   2. Force push to remote (if you confirm)"
Write-Host ""

$confirm = Read-Host "Have you coordinated with your team? (yes/no)"

if ($confirm -ne "yes") {
    Write-Host "❌ Aborted. Please coordinate with team first." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔍 Step 1: Checking current Git status..." -ForegroundColor Cyan
git status

Write-Host ""
Write-Host "🗑️ Step 2: Removing .env files from Git history..." -ForegroundColor Cyan
Write-Host "This may take a few minutes..."

# Remove .env files from all commits using git filter-repo (recommended) or filter-branch
# First, check if git-filter-repo is installed
$filterRepoInstalled = Get-Command git-filter-repo -ErrorAction SilentlyContinue

if ($filterRepoInstalled) {
    Write-Host "Using git-filter-repo (recommended method)..." -ForegroundColor Green
    git filter-repo --path .env --path server/.env --invert-paths --force
} else {
    Write-Host "git-filter-repo not found. Using git filter-branch (slower)..." -ForegroundColor Yellow
    Write-Host "To install git-filter-repo: pip install git-filter-repo" -ForegroundColor Yellow
    
    git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env server/.env" --prune-empty --tag-name-filter cat -- --all
    
    Write-Host ""
    Write-Host "✅ Step 3: Cleanup..." -ForegroundColor Cyan
    Remove-Item -Path .git/refs/original/ -Recurse -Force -ErrorAction SilentlyContinue
    git reflog expire --expire=now --all
    git gc --prune=now --aggressive
}

Write-Host ""
Write-Host "📊 Step 4: Verifying removal..." -ForegroundColor Cyan
Write-Host "Checking if .env files still exist in history..."
git log --all --full-history -- ".env" "server/.env" | Select-Object -First 20

Write-Host ""
Write-Host "✅ DONE! .env files removed from Git history." -ForegroundColor Green
Write-Host ""
Write-Host "⚠️ NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. Verify .env files are in .gitignore (already done)"
Write-Host "2. Update .env files with new credentials"
Write-Host "3. Force push to remote:"
Write-Host "   git push origin --force --all"
Write-Host "   git push origin --force --tags"
Write-Host ""
Write-Host "⚠️ WARNING: Force push will rewrite history on remote!" -ForegroundColor Red
Write-Host "All team members will need to re-clone the repository."

