// server/models/Job.js
const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
  externalId: { type: String, index: true },
  title: { type: String, required: true },
  company: { type: String },
  location: { type: String },
  url: { type: String, index: true },
  description: { type: String },
  datePosted: { type: Date },
  raw: { type: mongoose.Schema.Types.Mixed }, // parsed XML object
}, {
  timestamps: true
});

// create a composite unique-like index to avoid close duplicates
JobSchema.index({ externalId: 1 }, { sparse: true });

module.exports = mongoose.model('Job', JobSchema);