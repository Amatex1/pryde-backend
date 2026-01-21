# MongoDB Atlas Configuration Guide - Performance & Security Optimization

**Date:** 2026-01-11  
**Purpose:** Optimize MongoDB Atlas for Pryde Social production deployment

---

## 📋 Table of Contents

1. [Network Access & Security](#1-network-access--security)
2. [Database Users & Permissions](#2-database-users--permissions)
3. [Backup Configuration](#3-backup-configuration)
4. [Security Settings](#4-security-settings)
5. [Performance Optimization](#5-performance-optimization)
6. [Connection String Optimization](#6-connection-string-optimization)
7. [Monitoring & Alerts](#7-monitoring--alerts)

---

## 1. Network Access & Security

### 🔒 IP Whitelist Configuration

**Location:** MongoDB Atlas → Security → Network Access

#### Option A: Production (Recommended)
Add specific IP addresses for your deployment:

```
Render.com IPs (if using Render):
- Go to your Render dashboard
- Find "Outbound IP Addresses" in your service settings
- Add each IP to MongoDB Atlas whitelist

Cloudflare Pages (if using serverless functions):
- Not applicable - Cloudflare uses dynamic IPs
- Use Option B for development, Option C for production
```

#### Option B: Development (Temporary)
```
IP Address: 0.0.0.0/0
Description: Allow from anywhere (DEVELOPMENT ONLY)
⚠️ WARNING: Remove this in production!
```

#### Option C: Production Best Practice
```
1. Use MongoDB Atlas Private Endpoints (requires paid tier)
2. Or use VPC Peering with your cloud provider
3. Or use specific IP ranges from your hosting provider
```

### 🛡️ Recommended Settings:
- ✅ Enable "Require TLS/SSL" for all connections
- ✅ Use IP Access List (whitelist)
- ✅ Disable "Allow access from anywhere" in production
- ✅ Enable audit logs (M10+ clusters)

---

## 2. Database Users & Permissions

**Location:** MongoDB Atlas → Security → Database Access

### 👤 Create Production User

**Recommended Setup:**

```yaml
Username: pryde-app-user
Password: [Generate strong password - 32+ characters]
Database User Privileges:
  - Built-in Role: readWrite
  - Database: pryde-social (or your database name)
  
Additional Settings:
  - Authentication Method: SCRAM (default)
  - Temporary User: No
  - Delete user after: Never
```

### 🔐 Password Generation:
```bash
# Generate a strong password (run in terminal)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 👥 User Roles Best Practices:

**Production App User:**
```yaml
Role: readWrite
Database: pryde-social
Scope: Specific database only
```

**Admin User (for maintenance):**
```yaml
Role: atlasAdmin
Scope: All databases
⚠️ Use only for manual operations, NOT in app connection string
```

**Backup/Analytics User (optional):**
```yaml
Role: read
Database: pryde-social
Scope: Read-only access for analytics
```

---

## 3. Backup Configuration

**Location:** MongoDB Atlas → Backup

### 📦 Recommended Backup Settings:

#### Continuous Backup (M10+ clusters):
```yaml
Backup Method: Continuous Cloud Backup
Retention Policy:
  - Snapshot Frequency: Every 6 hours
  - Daily Snapshots: Keep for 7 days
  - Weekly Snapshots: Keep for 4 weeks
  - Monthly Snapshots: Keep for 12 months
  
Point-in-Time Restore:
  - Enable: Yes
  - Window: Last 7 days
```

#### Basic Backup (M0/M2/M5 free tier):
```yaml
⚠️ Free tier does NOT include automated backups
Recommendation:
  1. Upgrade to M10 for production
  2. Or use mongodump for manual backups
  3. Or export critical data regularly
```

### 🔄 Manual Backup Script (for free tier):
```bash
# Add to your backend repository
# File: scripts/backup-database.sh

#!/bin/bash
DATE=$(date +%Y-%m-%d-%H%M%S)
mongodump --uri="$MONGODB_URI" --out="./backups/backup-$DATE"
echo "Backup completed: backup-$DATE"
```

---

## 4. Security Settings

**Location:** MongoDB Atlas → Security

### 🔐 Security Checklist:

#### A. Encryption
```yaml
Encryption at Rest:
  - Status: Enabled (automatic on Atlas)
  - Provider: MongoDB Cloud Provider
  
Encryption in Transit:
  - TLS/SSL: Required (enforce in connection string)
  - Minimum TLS Version: TLS 1.2
```

#### B. Authentication
```yaml
Authentication Method: SCRAM-SHA-256 (default)
LDAP/X.509: Not required for most apps
```

#### C. Audit Logs (M10+ only)
```yaml
Enable Audit Logs: Yes
Audit Events:
  - Authentication events
  - Authorization failures
  - DDL operations (create/drop collections)
  - DML operations (optional - can be verbose)
  
Retention: 30 days minimum
```

#### D. Project Settings
```yaml
Require 2FA for Project Access: Yes (highly recommended)
IP Access List: Enabled
Allowed Roles: Limit to necessary roles only
```

---

## 5. Performance Optimization

**Location:** MongoDB Atlas → Clusters → Configuration

### ⚡ Cluster Configuration:

#### Cluster Tier (Production):
```yaml
Recommended Minimum: M10
  - RAM: 2 GB
  - Storage: 10 GB
  - vCPUs: 2
  - Connections: 1,500
  
For Pryde Social (estimated):
  - Users: < 1,000 → M10
  - Users: 1,000 - 10,000 → M20
  - Users: 10,000+ → M30+
```

#### Auto-Scaling:
```yaml
Enable Auto-Scaling: Yes
  - Cluster Tier: Auto-scale between M10 - M30
  - Storage: Auto-scale enabled
  - Minimum: M10
  - Maximum: M30 (adjust based on budget)
```

#### Replication:
```yaml
Replication Factor: 3 (default - recommended)
  - 1 Primary
  - 2 Secondaries
  
Read Preference: primaryPreferred
  - Reads from primary when available
  - Falls back to secondary if primary unavailable
```

---

## 6. Connection String Optimization

### 🔗 Optimized Connection String:

**Current Basic String:**
```
mongodb+srv://username:password@cluster.mongodb.net/pryde-social
```

**Optimized Production String:**
```
mongodb+srv://username:password@cluster.mongodb.net/pryde-social?retryWrites=true&w=majority&readPreference=primaryPreferred&maxPoolSize=50&minPoolSize=10&maxIdleTimeMS=60000&serverSelectionTimeoutMS=5000&socketTimeoutMS=45000&connectTimeoutMS=10000&authSource=admin
```

### 📝 Connection String Parameters Explained:

```yaml
retryWrites=true
  # Automatically retry failed write operations
  # Essential for production reliability

w=majority
  # Write concern - wait for majority of replicas to acknowledge
  # Ensures data durability

readPreference=primaryPreferred
  # Read from primary, fallback to secondary
  # Good balance of consistency and availability

maxPoolSize=50
  # Maximum number of connections in pool
  # Adjust based on your traffic (default: 100)

minPoolSize=10
  # Minimum connections to keep open
  # Reduces connection overhead for frequent requests

maxIdleTimeMS=60000
  # Close idle connections after 60 seconds
  # Prevents connection leaks

serverSelectionTimeoutMS=5000
  # Timeout for selecting a server (5 seconds)
  # Faster failure detection

socketTimeoutMS=45000
  # Socket timeout (45 seconds)
  # Prevents hanging connections

connectTimeoutMS=10000
  # Initial connection timeout (10 seconds)
  # Faster startup failure detection

authSource=admin
  # Authentication database
  # Required for Atlas users
```

### 🔧 Update Backend Connection:

**File:** `server/dbConn.js`

Current connection options are minimal. We'll enhance them in the next step.

---

## 7. Monitoring & Alerts

**Location:** MongoDB Atlas → Alerts

### 📊 Recommended Alerts:

#### Critical Alerts:
```yaml
1. Cluster Availability
   - Trigger: Cluster becomes unavailable
   - Action: Email + SMS
   - Threshold: Immediate

2. Replication Lag
   - Trigger: Lag > 60 seconds
   - Action: Email
   - Threshold: 60 seconds

3. Connections
   - Trigger: Connections > 80% of max
   - Action: Email
   - Threshold: 1,200 connections (for M10)

4. Disk Space
   - Trigger: Disk usage > 80%
   - Action: Email
   - Threshold: 80%
```

#### Warning Alerts:
```yaml
5. CPU Usage
   - Trigger: CPU > 75% for 5 minutes
   - Action: Email
   - Threshold: 75%

6. Memory Usage
   - Trigger: Memory > 80%
   - Action: Email
   - Threshold: 80%

7. Query Performance
   - Trigger: Slow queries > 100ms
   - Action: Email (daily digest)
   - Threshold: 100ms
```

---

## 📋 Quick Setup Checklist

Use this checklist to configure your MongoDB Atlas:

### Security (Priority 1):
- [ ] Add Render.com IP addresses to whitelist
- [ ] Create production database user with strong password
- [ ] Enable "Require TLS/SSL"
- [ ] Update connection string in Render environment variables
- [ ] Test connection from Render

### Backup (Priority 2):
- [ ] Enable continuous backup (if M10+)
- [ ] Configure retention policy
- [ ] Test restore process
- [ ] Set up manual backup script (if free tier)

### Performance (Priority 3):
- [ ] Enable auto-scaling
- [ ] Configure connection pool settings
- [ ] Update connection string with optimized parameters
- [ ] Create database indexes (see next section)

### Monitoring (Priority 4):
- [ ] Set up critical alerts
- [ ] Configure email notifications
- [ ] Enable performance advisor
- [ ] Review slow query logs weekly

---

**Next Steps:**
1. Complete the security checklist above
2. Update your connection string in Render
3. Review the database indexes guide (next document)
4. Set up monitoring alerts

**Need Help?**
- MongoDB Atlas Documentation: https://docs.atlas.mongodb.com/
- Render Documentation: https://render.com/docs

