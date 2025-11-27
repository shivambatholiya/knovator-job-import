// server/models/ImportLog.js
const mongoose = require('mongoose');

const FailedJobSchema = new mongoose.Schema({
  identifier: String, // externalId or url
  reason: String,
}, { _id: false });

const ImportLogSchema = new mongoose.Schema({
  feedUrl: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  totalFetched: { type: Number, default: 0 },
  totalImported: { type: Number, default: 0 },
  newJobs: { type: Number, default: 0 },
  updatedJobs: { type: Number, default: 0 },
  failedJobsCount: { type: Number, default: 0 },
  failedJobs: { type: [FailedJobSchema], default: [] },
  notes: String
}, {
  timestamps: true
});

module.exports = mongoose.model('ImportLog', ImportLogSchema);