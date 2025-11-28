const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
  externalId: { type: String },
  title: { type: String, required: true },
  company: { type: String },
  location: { type: String },
  url: { type: String },
  description: { type: String },
  datePosted: { type: Date },
  raw: { type: mongoose.Schema.Types.Mixed }, // parsed XML object
}, {
  timestamps: true
});

// indexes: make them sparse so missing values don't break uniqueness
JobSchema.index({ externalId: 1 }, { sparse: true });
JobSchema.index({ url: 1 }, { sparse: true });

module.exports = mongoose.model('Job', JobSchema);
