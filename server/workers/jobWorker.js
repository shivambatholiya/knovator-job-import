// server/workers/jobWorker.js
require('dotenv').config();
const mongoose = require('mongoose');
const { Worker } = require('bullmq');
const util = require('util');

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

function buildFilter(jobData) {
  if (!jobData) return null;
  if (jobData.externalId) return { externalId: String(jobData.externalId) };
  if (jobData.url) return { url: jobData.url };
  if (jobData.title && jobData.company) return { title: jobData.title, company: jobData.company };
  return null;
}

const safe = (v, def = null) => (v === undefined || v === null ? def : v);

const worker = new Worker(QUEUE_NAME, async (bullJob) => {
  const { jobData, importLogId } = bullJob.data || {};
  console.log(`Worker: processing bullJob.id=${bullJob.id} importLogId=${importLogId}`);

  // preview
  console.log('Worker: jobData preview:', util.inspect({
    title: jobData?.title,
    url: jobData?.url,
    externalId: jobData?.externalId
  }, { depth: 2 }));

  // prepare doc fields
  const docFields = {
    title: safe(jobData?.title, 'Untitled'),
    company: safe(jobData?.company, null),
    location: safe(jobData?.location, null),
    url: safe(jobData?.url, null),
    description: safe(jobData?.description, null),
    datePosted: jobData?.datePosted ? new Date(jobData.datePosted) : undefined,
    externalId: jobData?.externalId ? String(jobData.externalId) : undefined,
    raw: jobData?.raw ?? jobData ?? {}
  };

  const filter = buildFilter(jobData);
  console.log('Worker: computed filter =>', filter ? JSON.stringify(filter) : 'null (will create new doc)');

  try {
    if (filter) {
      const res = await JobModel.findOneAndUpdate(
        filter,
        { $set: docFields, $setOnInsert: { createdFromFeed: true } },
        { upsert: true, new: true, rawResult: true }
      );

      // Minimal upsert log
      const resultingDoc = res?.value ?? res?.ops?.[0] ?? null;
      const insertedFlag = res?.lastErrorObject ? (res.lastErrorObject.updatedExisting === false) : false;
      const printed = {
        isNew: !!insertedFlag,
        _id: resultingDoc?._id ?? (res?.lastErrorObject?.upserted ?? null),
        title: (resultingDoc && resultingDoc.title) ? String(resultingDoc.title).substring(0, 80) : null,
        url: resultingDoc?.url ?? null,
        externalId: resultingDoc?.externalId ?? null
      };
      console.log('Worker: upsert =>', printed);

      if (insertedFlag) {
        await ImportLog.findByIdAndUpdate(importLogId, { $inc: { totalImported: 1, newJobs: 1 } });
      } else {
        await ImportLog.findByIdAndUpdate(importLogId, { $inc: { totalImported: 1, updatedJobs: 1 } });
      }
    } else {
      const created = await JobModel.create(docFields);
      console.log('Worker: created job _id=', created._id, ' title=', String(created.title).substring(0,80));
      await ImportLog.findByIdAndUpdate(importLogId, { $inc: { totalImported: 1, newJobs: 1 } });
    }
    return Promise.resolve();
  } catch (err) {
    console.error('Worker: job processing error:', err?.message || err);
    const identifier = (jobData?.externalId || jobData?.url || jobData?.title) ?? 'unknown';
    await ImportLog.findByIdAndUpdate(importLogId, {
      $inc: { failedJobsCount: 1 },
      $push: { failedJobs: { identifier: String(identifier), reason: err.message } }
    });
    throw err;
  }
}, {
  connection,
  concurrency: CONCURRENCY
});

worker.on('completed', (job) => {
  console.log(`Worker: job ${job.id} completed`);
});
worker.on('failed', (job, err) => {
  console.error(`Worker: job ${job ? job.id : 'unknown'} failed:`, err?.message || err);
});
worker.on('error', (err) => {
  console.error('Worker error', err);
});
