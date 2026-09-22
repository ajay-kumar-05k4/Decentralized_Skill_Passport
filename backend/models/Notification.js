const mongoose = require('mongoose');

// In-app notifications ("Notifications and Alerts" in the SRS).
// Email delivery via Nodemailer can be layered on top of the same records
// later without changing any call site.
const NOTIFICATION_TYPES = [
  'credential_submitted',
  'verification_requested',
  'verification_claimed',
  'verification_approved',
  'verification_rejected',
  'skill_endorsed',
  'passport_shared',
  'account_updated',
];

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    message: { type: String, default: '' },
    // Optional pointer back to whatever the notification is about
    resource: {
      kind: { type: String, enum: ['credential', 'verification', 'profile', 'user'], default: null },
      id: { type: mongoose.Schema.Types.ObjectId, default: null },
    },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
