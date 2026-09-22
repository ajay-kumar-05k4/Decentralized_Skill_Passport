const asyncHandler = require('express-async-handler');
const Notification = require('../models/Notification');

// @desc    List the caller's notifications
// @route   GET /api/notifications
// @access  Private
const getMyNotifications = asyncHandler(async (req, res) => {
  const { unread, limit = 50 } = req.query;

  const query = { user: req.user._id };
  if (unread === 'true') query.read = false;

  const [notifications, unreadCount] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).limit(Number(limit)),
    Notification.countDocuments({ user: req.user._id, read: false }),
  ]);

  res.status(200).json({
    success: true,
    count: notifications.length,
    unreadCount,
    data: notifications,
  });
});

// @desc    Mark one notification read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) {
    res.status(404);
    throw new Error('Notification not found');
  }
  if (notification.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to modify this notification');
  }

  if (!notification.read) {
    notification.read = true;
    notification.readAt = new Date();
    await notification.save();
  }

  res.status(200).json({ success: true, data: notification });
});

// @desc    Mark every notification read
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { user: req.user._id, read: false },
    { $set: { read: true, readAt: new Date() } }
  );
  res.status(200).json({
    success: true,
    message: 'All notifications marked read',
    updated: result.modifiedCount,
  });
});

// @desc    Delete a notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) {
    res.status(404);
    throw new Error('Notification not found');
  }
  if (notification.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to delete this notification');
  }
  await notification.deleteOne();
  res.status(200).json({ success: true, message: 'Notification deleted' });
});

module.exports = { getMyNotifications, markAsRead, markAllAsRead, deleteNotification };
