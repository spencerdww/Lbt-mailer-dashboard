const mongoose = require('mongoose');

const importHistorySchema = new mongoose.Schema(
  {
    filename: { type: String, default: 'upload.csv', trim: true, maxlength: 240 },
    username: { type: String, default: '', trim: true, maxlength: 32 },
    totalRows: { type: Number, default: 0 },
    processed: { type: Number, default: 0 },
    inserted: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    unchanged: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    generatedCodes: { type: Number, default: 0 },
    duplicateRows: { type: Number, default: 0 },
    codes: { type: [String], default: [] },
    created_at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

importHistorySchema.index({ created_at: -1 });

module.exports = mongoose.model('ImportHistory', importHistorySchema);
