# 🚀 Pryde Backup System - Quick Reference

## 📊 **Your Complete Backup Setup**

| Backup Type | Frequency | Retention | Location | Cost |
|-------------|-----------|-----------|----------|------|
| **MongoDB Flex** | Daily | 6 days | MongoDB Cloud | $30/mo |
| **Continuous Backups** | Every 30 min | 90 days | Render Disk | Free |
| **Automated PC Downloads** | Weekly (Sunday 9 PM) | Last 4 backups | Your PC | Free |

**Total Cost**: $30/month

---

## 🔗 **Important URLs**

### **Backup Endpoints**:
- **Download**: `https://YOUR-APP.onrender.com/api/backup/download`
- **Info**: `https://YOUR-APP.onrender.com/api/backup/info`
- **Health**: `https://YOUR-APP.onrender.com/api/backup/health`

### **Dashboards**:
- **Render**: https://dashboard.render.com
- **MongoDB**: https://cloud.mongodb.com

---

## 🔑 **API Key Authentication**

All backup endpoints require API key:

**Header**:
```
X-API-Key: your-backup-api-key
```

**Or Query Parameter**:
```
?apiKey=your-backup-api-key
```

---

## 💻 **Manual Commands**

### **Download Backup Manually**:
```powershell
# Windows PowerShell
.\Download-PrydeBackup.ps1
```

### **Check Backup Health**:
```powershell
# No API key needed
Invoke-WebRequest -Uri "https://YOUR-APP.onrender.com/api/backup/health"
```

### **Get Backup Info**:
```powershell
# Requires API key
$headers = @{"X-API-Key" = "your-api-key"}
Invoke-WebRequest -Uri "https://YOUR-APP.onrender.com/api/backup/info" -Headers $headers
```

---

## 📁 **File Locations**

### **On Render Server**:
```
/opt/render/project/src/server/backups/
├── full-backup-latest.json
├── full-backup-2025-12-16T12-00-07.json
└── full-backup-2025-12-16T11-54-01.json
```

### **On Your PC**:
```
C:\Users\YourName\Documents\PrydeBackups\
├── pryde-backup-2025-12-16_21-00-00.json
├── pryde-backup-2025-12-23_21-00-00.json
├── pryde-backup-2025-12-30_21-00-00.json
└── backup-log.txt
```

---

## 🔄 **Backup Schedule**

### **Render (Continuous)**:
- ⏰ **Every 30 minutes** (safety backup)
- ⏰ **Every hour** (main backup)
- 🗑️ **Auto-cleanup** after 90 days

### **Your PC (Automated)**:
- ⏰ **Every Sunday at 9:00 PM**
- 🗑️ **Keeps last 4 backups**

---

## 🛠️ **Common Tasks**

### **Test Backup Download**:
```powershell
cd F:\Desktop\pryde-backend
.\Download-PrydeBackup.ps1
```

### **Run Scheduled Task Manually**:
1. Open Task Scheduler (`Win + R` → `taskschd.msc`)
2. Find "Pryde Backup Download"
3. Right-click → **Run**

### **View Backup Logs**:
```powershell
Get-Content "$env:USERPROFILE\Documents\PrydeBackups\backup-log.txt" -Tail 20
```

### **Check PM2 Status on Render**:
```bash
pm2 list
pm2 logs continuous-backup --lines 50
```

---

## 🔍 **Troubleshooting**

### **Backup download fails**:
```powershell
# Check if server is running
Invoke-WebRequest -Uri "https://YOUR-APP.onrender.com/api/backup/health"

# Verify API key
# Make sure BACKUP_API_KEY in script matches Render environment variable
```

### **Task Scheduler not running**:
1. Check Task Scheduler → Task History
2. Verify trigger is enabled
3. Check "Wake computer" is enabled
4. Ensure PC is on at scheduled time

### **Permission errors**:
```powershell
# Run as Administrator
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 📊 **Monitoring**

### **Check Last Backup**:
```powershell
# On Render Shell
ls -lh /opt/render/project/src/server/backups/

# On Your PC
Get-ChildItem "$env:USERPROFILE\Documents\PrydeBackups" | Sort-Object LastWriteTime -Descending
```

### **View Backup Size**:
```powershell
# On Your PC
Get-ChildItem "$env:USERPROFILE\Documents\PrydeBackups\*.json" | 
  Select-Object Name, @{Name="Size(KB)";Expression={[math]::Round($_.Length/1KB,2)}}, LastWriteTime
```

---

## 🔐 **Security**

### **API Key Best Practices**:
- ✅ Use a strong random key (32+ characters)
- ✅ Never commit to Git
- ✅ Store in Render environment variables
- ✅ Rotate every 90 days

### **Backup File Security**:
- ✅ Backups contain user data (no passwords)
- ✅ Store in secure location
- ✅ Don't share publicly
- ✅ Consider encrypting sensitive backups

---

## 📞 **Support**

### **Check System Health**:
```bash
# Render Shell
pm2 list
pm2 logs continuous-backup --lines 50
ls -lh /opt/render/project/src/server/backups/
```

### **View Logs**:
```powershell
# PC Backup Logs
Get-Content "$env:USERPROFILE\Documents\PrydeBackups\backup-log.txt"
```

---

## ✅ **Quick Health Check**

Run this to verify everything is working:

```powershell
# 1. Check Render backup health
Invoke-WebRequest -Uri "https://YOUR-APP.onrender.com/api/backup/health"

# 2. Check local backups
Get-ChildItem "$env:USERPROFILE\Documents\PrydeBackups\*.json" | Measure-Object

# 3. View last backup log entry
Get-Content "$env:USERPROFILE\Documents\PrydeBackups\backup-log.txt" -Tail 1
```

---

## 🎯 **Summary**

✅ **3 layers of backup protection**  
✅ **Automated weekly downloads to PC**  
✅ **90-day retention on Render**  
✅ **6-day retention on MongoDB**  
✅ **Zero manual work needed**  
✅ **Total cost: $30/month**  

**Your data is safe!** 🛡️

