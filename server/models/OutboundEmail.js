import mongoose from 'mongoose';

const OutboundEmailSchema = new mongoose.Schema({
  resendId: { type: String, default: null },
  to: { type: String, required: true },
  subject: { type: String, required: true },
  type: {
    type: String,
    enum: ['password_reset', 'login_alert', 'suspicious_login', 'verification', 'password_changed', 'recovery_contact', 'account_deletion', 'other'],
    required: true
  },
  success: { type: Boolean, required: true },
  errorMessage: { type: String, default: null }
}, { timestamps: true });

OutboundEmailSchema.index({ createdAt: -1 });
OutboundEmailSchema.index({ to: 1 });
OutboundEmailSchema.index({ type: 1 });

const OutboundEmail = mongoose.model('OutboundEmail', OutboundEmailSchema);
export default OutboundEmail;
