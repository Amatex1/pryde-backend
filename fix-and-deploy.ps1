# PowerShell Script to Fix Folder Structure and Push to GitHub
# This copies the server folder from pryde-frontend to pryde-backend

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Fix Pryde Social for Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📁 Folder Identification:" -ForegroundColor Cyan
Write-Host "  pryde-backend  = Frontend code + Git repo" -ForegroundColor Yellow
Write-Host "  pryde-frontend = Backend code (server folder)" -ForegroundColor Yellow
Write-Host ""

# Check if pryde-frontend exists
if (-Not (Test-Path "F:\Desktop\pryde-frontend")) {
    Write-Host "❌ Error: F:\Desktop\pryde-frontend not found!" -ForegroundColor Red
    exit 1
}

# Check if server folder exists in pryde-frontend
if (-Not (Test-Path "F:\Desktop\pryde-frontend\server")) {
    Write-Host "❌ Error: server folder not found in pryde-frontend!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found pryde-frontend with server folder" -ForegroundColor Green

# Check if pryde-backend exists
if (-Not (Test-Path "F:\Desktop\pryde-backend")) {
    Write-Host "❌ Error: F:\Desktop\pryde-backend not found!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found pryde-backend (git repository)" -ForegroundColor Green
Write-Host ""

# Confirm before proceeding
Write-Host "This will:" -ForegroundColor Cyan
Write-Host "1. Copy server/ folder from pryde-frontend to pryde-backend" -ForegroundColor White
Write-Host "2. Add server/ to git" -ForegroundColor White
Write-Host "3. Commit the changes" -ForegroundColor White
Write-Host "4. Push to GitHub" -ForegroundColor White
Write-Host ""
$confirm = Read-Host "Continue? (y/n)"

if ($confirm -ne "y") {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "🔄 Copying server folder..." -ForegroundColor Cyan

# Copy server folder
try {
    Copy-Item -Path "F:\Desktop\pryde-frontend\server" -Destination "F:\Desktop\pryde-backend\server" -Recurse -Force
    Write-Host "✅ Server folder copied successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Error copying server folder: $_" -ForegroundColor Red
    exit 1
}

# Navigate to git repository
cd F:\Desktop\pryde-backend

Write-Host ""
Write-Host "📝 Creating .gitignore..." -ForegroundColor Cyan

# Create/update .gitignore
$gitignoreContent = @"
# Dependencies
node_modules/
server/node_modules/

# Environment variables
.env
.env.local
server/.env

# Build output
dist/
build/

# Logs
*.log
npm-debug.log*
yarn-debug.log*

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
"@

$gitignoreContent | Out-File -FilePath ".gitignore" -Encoding utf8 -Force
Write-Host "✅ .gitignore created" -ForegroundColor Green

Write-Host ""
Write-Host "📦 Adding files to git..." -ForegroundColor Cyan

# Add server folder to git
git add server/
git add .gitignore

# Show what will be committed
Write-Host ""
Write-Host "Files to be committed:" -ForegroundColor Cyan
git status --short

Write-Host ""
$confirmCommit = Read-Host "Commit these changes? (y/n)"

if ($confirmCommit -ne "y") {
    Write-Host "Cancelled. Files are staged but not committed." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "📝 Committing changes..." -ForegroundColor Cyan

# Commit
git commit -m "Add backend server folder for Render deployment"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Commit failed!" -ForegroundColor Red
    Write-Host "This might mean there are no changes to commit." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Changes committed" -ForegroundColor Green

Write-Host ""
Write-Host "🚀 Pushing to GitHub..." -ForegroundColor Cyan

# Push to GitHub
git push origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Push failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try these solutions:" -ForegroundColor Yellow
    Write-Host "1. Check your internet connection" -ForegroundColor White
    Write-Host "2. Verify GitHub credentials" -ForegroundColor White
    Write-Host "3. Try force push: git push -f origin main" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ Success!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "✅ Server folder copied to pryde-backend" -ForegroundColor Green
Write-Host "✅ Changes committed to git" -ForegroundColor Green
Write-Host "✅ Pushed to GitHub" -ForegroundColor Green
Write-Host ""
Write-Host "🎯 Next Steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Verify on GitHub:" -ForegroundColor White
Write-Host "   https://github.com/Amatex1/pryde-frontend---backend" -ForegroundColor Gray
Write-Host "   (You should see a 'server' folder)" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Deploy Backend to Render:" -ForegroundColor White
Write-Host "   - Go to: https://dashboard.render.com" -ForegroundColor Gray
Write-Host "   - Create New Web Service" -ForegroundColor Gray
Write-Host "   - Connect: pryde-frontend---backend" -ForegroundColor Gray
Write-Host "   - Root Directory: server" -ForegroundColor Gray
Write-Host "   - Build Command: npm install" -ForegroundColor Gray
Write-Host "   - Start Command: npm start" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Follow the guide:" -ForegroundColor White
Write-Host "   Open: RENDER_MANUAL_SETUP.md" -ForegroundColor Gray
Write-Host ""

