const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 128,
    },
    dateSubmitted: { type: String, default: '', trim: true, maxlength: 40 },
    timeSubmitted: { type: String, default: '', trim: true, maxlength: 40 },
    submittedAt: { type: Date, default: null },
    ipAddress: { type: String, default: '', trim: true, maxlength: 64 },
    variant: { type: String, default: '', trim: true, maxlength: 32 },
    pageUuid: { type: String, default: '', trim: true, maxlength: 80 },
    pageUrl: { type: String, default: '', trim: true, maxlength: 500 },
    pageName: { type: String, default: '', trim: true, maxlength: 200 },
    firstName: { type: String, default: '', trim: true, maxlength: 200 },
    middleInitial: { type: String, default: '', trim: true, maxlength: 8 },
    lastName: { type: String, default: '', trim: true, maxlength: 200 },
    email: { type: String, default: '', trim: true, maxlength: 320 },
    phone: { type: String, default: '', trim: true, maxlength: 40 },
    amountOwed: { type: String, default: '', trim: true, maxlength: 80 },
    debtAmount: { type: String, default: '', trim: true, maxlength: 80 },
    taxType: { type: String, default: '', trim: true, maxlength: 40 },
    stateName: { type: String, default: '', trim: true, maxlength: 80 },
    filingType: { type: String, default: '', trim: true, maxlength: 40 },
    situationDetails: { type: String, default: '', trim: true, maxlength: 4000 },
    runInvestigation: { type: String, default: '', trim: true, maxlength: 300 },
    ssn: { type: String, default: '', trim: true, maxlength: 20 },
    dob: { type: String, default: '', trim: true, maxlength: 40 },
    address: { type: String, default: '', trim: true, maxlength: 500 },
    isJoint: { type: String, default: '', trim: true, maxlength: 80 },
    spouseInfo: { type: String, default: '', trim: true, maxlength: 300 },
    businessEin: { type: String, default: '', trim: true, maxlength: 200 },
    noticeFileUrl: { type: String, default: '', trim: true, maxlength: 2000 },
    created_at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

customerSchema.index({ submittedAt: -1, created_at: -1 });

module.exports = mongoose.model('Customer', customerSchema);
