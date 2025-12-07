#!/bin/bash
# Script to remove .env files from Git history
# WARNING: This rewrites Git history - coordinate with team before running!

echo "🚨 WARNING: This will rewrite Git history!"
echo "📋 This script will:"
echo "   1. Remove .env and server/.env from all commits"
echo "   2. Force push to remote (if you confirm)"
echo ""
read -p "Have you coordinated with your team? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Aborted. Please coordinate with team first."
    exit 1
fi

echo ""
echo "🔍 Step 1: Checking current Git status..."
git status

echo ""
echo "🗑️ Step 2: Removing .env files from Git history..."
echo "This may take a few minutes..."

# Remove .env files from all commits
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env server/.env" \
  --prune-empty --tag-name-filter cat -- --all

echo ""
echo "✅ Step 3: Cleanup..."
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo "📊 Step 4: Verifying removal..."
echo "Checking if .env files still exist in history..."
git log --all --full-history -- ".env" "server/.env" | head -20

echo ""
echo "✅ DONE! .env files removed from Git history."
echo ""
echo "⚠️ NEXT STEPS:"
echo "1. Verify .env files are in .gitignore (already done)"
echo "2. Update .env files with new credentials"
echo "3. Force push to remote:"
echo "   git push origin --force --all"
echo "   git push origin --force --tags"
echo ""
echo "⚠️ WARNING: Force push will rewrite history on remote!"
echo "All team members will need to re-clone the repository."

