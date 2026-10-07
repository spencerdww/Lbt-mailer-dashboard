const mongoose = require('mongoose');

const noticeFileSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      maxlength: 128,
      index: true,
    },
    originalName: { type: String, default: 'notice', trim: true, maxlength: 200 },
    mimeType: { type: String, required: true, trim: true, maxlength: 100 },
    kind: { type: String, enum: ['pdf', 'image'], required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true },
    created_at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

module.exports = mongoose.model('NoticeFile', noticeFileSchema);
