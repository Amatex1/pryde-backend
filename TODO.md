# Inbound Email Admin Access Plan Progress

## Approved Plan Steps (User confirmed)

✅ **Step 1:** Create `server/models/InboundEmail.js` - MongoDB model for emails *(Completed)*

✅ **Step 2:** Create `server/routes/adminEmails.js` - Admin routes: GET /api/admin/emails, GET /api/admin/emails/:id, PATCH /api/admin/emails/:id *(Completed)*

✅ **Step 3:** Create `server/routes/webhooks.js` - POST /api/webhooks/resend/inbound *(Completed)*

✅ **Step 4-6:** Routes mounted & docs updated

**Remaining:**

- [ ] **Step 7:** Test webhook: Configure Resend dashboard > Domains > Inbound > Webhook URL `https://yourdomain.com/api/webhooks/resend/inbound` for both addresses

- [ ] **Step 8:** Frontend admin UI for `/admin/emails` tab

**Commands to test:**
```bash
npm run dev
# Test webhook:
curl -X POST http://localhost:9000/api/webhooks/resend/inbound \\
  -H 'resend-signature: test' \\
  -H 'Content-Type: application/json' \\
  -d '{"from":"test@example.com","to":["support@prydeapp.com"],"subject":"Test","text":"Test email"}'

# Test admin API:
curl -H 'Authorization: Bearer YOUR_JWT' http://localhost:9000/api/admin/emails?mailbox=support
```

**Post-Implementation:**
- Monitor logs for webhook deliveries
- Test admin access: `GET /api/admin/emails?mailbox=support`
- Scale: Add attachment processing/upload to R2 if needed
