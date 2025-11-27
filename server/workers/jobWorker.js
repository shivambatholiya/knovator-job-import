// server/workers/jobWorker.js
require('dotenv').config();
const mongoose = require('mongoose');
const { Worker } = require('bullmq');

const JobModel = require('../models/Job');
const ImportLog = require('../models/ImportLog');

const REDIS_URL = process.env.REDIS_URL;
const connection = REDIS_URL ? REDIS_URL : {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
  password: process.env.REDIS_PASSWORD || undefined
};

const QUEUE_NAME = 'job-import-queue';
const CONCURRENCY = parseInt(process.env.JOB_WORKER_CONCURRENCY || '5', 10);
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/knovator_jobs';

// connect mongoose
mongoose.connect(MONGO_URI)
  .then(() => console.log('Worker: Mongo connected'))
  .catch(err => {
    console.error('Worker: Mongo connection error', err);
    process.exit(1);
  });

/**
 * Build filter to find existing job:
 */
const { Types } = require('mongoose');

function buildFilter(jobData) {
  if (!jobData) return null;
  if (jobData.externalId) return { externalId: String(jobData.externalId) };
  if (jobData.url) return { url: jobData.url };
  if (jobData.title && jobData.company) return { title: jobData.title, company: jobData.company };
  // return null if no reliable filter
  return null;
}

const filter = buildFilter(jobData);

try {
  if (filter) {
    // upsert based on filter
    const res = await JobModel.findOneAndUpdate(
      filter,
      { $set: docFields, $setOnInsert: { createdFromFeed: true } },
      { upsert: true, new: true, rawResult: true }
    );

    const isNew = res.lastErrorObject && res.lastErrorObject.updatedExisting === false;

    if (isNew) {
      await ImportLog.findByIdAndUpdate(importLogId, { $inc: { totalImported: 1, newJobs: 1 } });
    } else {
      await ImportLog.findByIdAndUpdate(importLogId, { $inc: { totalImported: 1, updatedJobs: 1 } });
    }
  } else {
    // create a NEW document if no filter available
    await JobModel.create(docFields);
    await ImportLog.findByIdAndUpdate(importLogId, { $inc: { totalImported: 1, newJobs: 1 } });
  }

  return Promise.resolve();
} catch (err) {
  const identifier = (jobData?.externalId || jobData?.url || jobData?.title) ?? 'unknown';
  await ImportLog.findByIdAndUpdate(importLogId, {
    $inc: { failedJobsCount: 1 },
    $push: { failedJobs: { identifier: String(identifier), reason: err.message } }
  });
  throw err;
}