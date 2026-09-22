const Notification = require('../models/Notification');

// Notifications must never break the operation that triggered them, so every
// failure here is swallowed and logged rather than bubbled up to the caller.
const notify = async ({ user, type, title, message = '', resource = null }) => {
  try {
    return await Notification.create({
      user,
      type,
      title,
      message,
      resource: resource || { kind: null, id: null },
    });
  } catch (error) {
    console.error(`Failed to create notification (${type}): ${error.message}`);
    return null;
  }
};

module.exports = { notify };
