@echo off
echo ========================================
echo Git History Cleanup - Remove .env Files
echo ========================================
echo.
echo WARNING: This will rewrite Git history!
echo.
echo This script will:
echo   1. Remove .env and server/.env from all commits
echo   2. Clean up Git references
echo   3. Prepare for force push
echo.
echo After completion, you MUST:
echo   1. Update .env files with NEW credentials
echo   2. Force push: git push origin --force --all
echo   3. All team members must re-clone
echo.
pause
echo.
echo Starting cleanup...
echo.

echo Step 1: Removing .env files from Git history...
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env server/.env" --prune-empty --tag-name-filter cat -- --all

echo.
echo Step 2: Cleaning up references...
rmdir /s /q .git\refs\original 2>nul
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo.
echo Step 3: Verifying removal...
git log --all --full-history -- ".env" "server/.env"

echo.
echo ========================================
echo CLEANUP COMPLETE!
echo ========================================
echo.
echo NEXT STEPS:
echo 1. Update .env files with NEW credentials
echo 2. Run: git push origin --force --all
echo 3. Run: git push origin --force --tags
echo 4. Notify team to re-clone repository
echo.
pause

