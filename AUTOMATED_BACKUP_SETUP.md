# 🚀 Automated Weekly Backup to Your PC - Setup Guide

This guide will help you set up **automated weekly backups** that download from Render to your Windows PC.

---

## 📋 **What You'll Get**

✅ **Automatic downloads** every Sunday at 9 PM  
✅ **No manual intervention** needed  
✅ **Keeps last 4 backups** (auto-cleanup)  
✅ **Saved to your PC** in `Documents\PrydeBackups`  
✅ **Secure** with API key authentication  

---

## 🔧 **Step 1: Set Up Backup API Key**

### **1.1 Generate a Secure API Key**

Open PowerShell and run:

```powershell
# Generate a random secure API key
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

**Copy the output** - this is your `BACKUP_API_KEY`

Example output: `aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW`

---

### **1.2 Add API Key to Render**

1. Go to **Render Dashboard**: https://dashboard.render.com
2. Select your **Pryde Backend** service
3. Click **Environment** tab
4. Click **Add Environment Variable**
5. Add:
   - **Key**: `BACKUP_API_KEY`
   - **Value**: `<paste your generated API key>`
6. Click **Save Changes**
7. **Redeploy** your service (Render will auto-redeploy)

---

## 🔧 **Step 2: Configure PowerShell Script**

### **2.1 Edit the PowerShell Script**

1. Open `Download-PrydeBackup.ps1` in Notepad or VS Code
2. Update these lines at the top:

```powershell
# Configuration
$RENDER_API_URL = "https://YOUR-APP-NAME.onrender.com/api/backup/download"
$BACKUP_API_KEY = "paste-your-api-key-here"
$BACKUP_FOLDER = "$env:USERPROFILE\Documents\PrydeBackups"
$MAX_BACKUPS = 4  # Keep last 4 backups
```

**Replace**:
- `YOUR-APP-NAME` with your actual Render app name
- `paste-your-api-key-here` with the API key you generated

3. **Save the file**

---

### **2.2 Test the Script**

Open PowerShell and run:

```powershell
# Navigate to the script location
cd F:\Desktop\pryde-backend

# Run the script
.\Download-PrydeBackup.ps1
```

You should see:
```
🔄 Downloading Pryde Social Backup...
📅 Date: 2025-12-16 21:00:00
📁 Saving to: C:\Users\YourName\Documents\PrydeBackups\pryde-backup-2025-12-16_21-00-00.json

✅ Backup downloaded successfully! (45.23 KB)
📁 Saved to: C:\Users\YourName\Documents\PrydeBackups\pryde-backup-2025-12-16_21-00-00.json

✅ Backup process completed successfully!
```

---

## 🔧 **Step 3: Set Up Windows Task Scheduler**

### **3.1 Open Task Scheduler**

1. Press `Win + R`
2. Type `taskschd.msc`
3. Press Enter

---

### **3.2 Create New Task**

1. Click **Create Task** (not "Create Basic Task")
2. **General Tab**:
   - Name: `Pryde Backup Download`
   - Description: `Automatically downloads Pryde Social backups every Sunday`
   - ✅ Check **Run whether user is logged on or not**
   - ✅ Check **Run with highest privileges**
   - Configure for: **Windows 10**

---

### **3.3 Configure Trigger**

1. Go to **Triggers** tab
2. Click **New**
3. Settings:
   - Begin the task: **On a schedule**
   - Settings: **Weekly**
   - ✅ Check **Sunday**
   - Start: **9:00:00 PM**
   - Recur every: **1 weeks**
   - ✅ Check **Enabled**
4. Click **OK**

---

### **3.4 Configure Action**

1. Go to **Actions** tab
2. Click **New**
3. Settings:
   - Action: **Start a program**
   - Program/script: `powershell.exe`
   - Add arguments:
     ```
     -ExecutionPolicy Bypass -File "F:\Desktop\pryde-backend\Download-PrydeBackup.ps1"
     ```
   - Start in: `F:\Desktop\pryde-backend`
4. Click **OK**

---

### **3.5 Configure Conditions**

1. Go to **Conditions** tab
2. Settings:
   - ❌ Uncheck **Start the task only if the computer is on AC power**
   - ✅ Check **Wake the computer to run this task** (optional)
3. Click **OK**

---

### **3.6 Configure Settings**

1. Go to **Settings** tab
2. Settings:
   - ✅ Check **Allow task to be run on demand**
   - ✅ Check **Run task as soon as possible after a scheduled start is missed**
   - If the task fails, restart every: **1 hour**
   - Attempt to restart up to: **3 times**
3. Click **OK**

---

### **3.7 Save the Task**

1. Click **OK** to save
2. Enter your **Windows password** when prompted
3. Task is now created!

---

## ✅ **Step 4: Test the Scheduled Task**

### **4.1 Run Task Manually**

1. In Task Scheduler, find **Pryde Backup Download**
2. Right-click → **Run**
3. Check `Documents\PrydeBackups` folder
4. You should see a new backup file!

---

### **4.2 Verify Task History**

1. Right-click task → **Properties**
2. Go to **History** tab
3. Check for successful execution

---

## 📊 **What Happens Now**

### **Every Sunday at 9 PM**:
1. ✅ Windows wakes up (if sleeping)
2. ✅ PowerShell script runs automatically
3. ✅ Downloads latest backup from Render
4. ✅ Saves to `Documents\PrydeBackups`
5. ✅ Deletes old backups (keeps last 4)
6. ✅ Logs success/failure

---

## 📁 **Backup Location**

Your backups are saved to:
```
C:\Users\YourName\Documents\PrydeBackups\
```

Files are named:
```
pryde-backup-2025-12-16_21-00-00.json
pryde-backup-2025-12-23_21-00-00.json
pryde-backup-2025-12-30_21-00-00.json
pryde-backup-2026-01-06_21-00-00.json
```

---

## 🔍 **Troubleshooting**

### **Issue: Script fails to download**

**Check**:
1. ✅ Render app is running
2. ✅ API key matches in script and Render
3. ✅ URL is correct
4. ✅ Internet connection is active

**Test manually**:
```powershell
.\Download-PrydeBackup.ps1
```

---

### **Issue: Task doesn't run**

**Check**:
1. ✅ Task is **Enabled** in Task Scheduler
2. ✅ Trigger is set correctly (Sunday 9 PM)
3. ✅ PC is on at scheduled time
4. ✅ "Wake computer" is enabled (if PC sleeps)

---

### **Issue: Permission denied**

**Fix**:
1. Right-click PowerShell → **Run as Administrator**
2. Run:
   ```powershell
   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
3. Try again

---

## 📋 **Summary**

✅ **Backup API endpoint**: Created (`/api/backup/download`)  
✅ **PowerShell script**: Configured  
✅ **Task Scheduler**: Set up for Sunday 9 PM  
✅ **Auto-cleanup**: Keeps last 4 backups  
✅ **Total cost**: $0 (free!)  

---

## 🎯 **Next Steps**

1. ✅ Deploy the updated code to Render
2. ✅ Add `BACKUP_API_KEY` to Render environment
3. ✅ Configure PowerShell script
4. ✅ Test script manually
5. ✅ Set up Task Scheduler
6. ✅ Test scheduled task
7. ✅ Wait for Sunday 9 PM!

---

**Your backups will now download automatically every week!** 🎉

