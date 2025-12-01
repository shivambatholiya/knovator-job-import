// server/workers/jobWorker.js
require('dotenv').config();
const mongoose = require('mongoose');
const { Worker } = require('bullmq');
const util = require('util');

const JobModel = require('../models/Job');
const ImportLog = require('../models/ImportLog');

const QUEUE_NAME = process.env.QUEUE_NAME || 'job-import-queue';
const CONCURRENCY = parseInt(process.env.JOB_WORKER_CONCURRENCY || '2', 10);
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/knovator_jobs';

/**
 * Build a BullMQ-compatible connection object.
 * Prefers REDIS_URL and ensures TLS (rediss://). Adds socket options for local dev tolerance.
 */
function buildRedisConnection() {
  const raw = process.env.REDIS_URL ? process.env.REDIS_URL.trim() : null;
  if (raw && raw.length > 0) {
    // Prefer TLS scheme for Upstash. If user already provided rediss:// it's fine.
    const coercedUrl = raw.replace(/^redis:\/\//, 'rediss://');
    // socket options instruct node-redis to use TLS.
    // rejectUnauthorized:false is tolerated locally; remove for strict production.
    return { url: coercedUrl, socket: { tls: true, rejectUnauthorized: false } };
  }

  // fallback to host/port if no REDIS_URL
  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
    password: process.env.REDIS_PASSWORD || undefined
  };
}

const connection = buildRedisConnection();
console.log('Worker: using Redis connection ->', connection.url ? '[url with TLS]' : JSON.stringify(connection).slice(0,120));

/** Utility functions used by the processor */
function buildFilter(jobData) {
  if (!jobData) return null;
  if (jobData.externalId) return { externalId: String(jobData.externalId) };
  if (jobData.url) return { url: jobData.url };
  if (jobData.title && jobData.company) return { title: jobData.title, company: jobData.company };
  return null;
}
const safe = (v, def = null) => (v === undefined || v === null ? def : v);

/** Ensure Mongoose connected; reuse connection if already open */
async function ensureMongoConnection() {
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    // already connected
    console.log('Worker: using existing mongoose connection');
    return;
  }
  console.log('Worker: connecting to mongo...');
  await mongoose.connect(MONGO_URI);
  console.log('Worker: mongo connected');
}

/**
 * Create and start the worker. Returns { worker, close }.
 * The caller may call close() to gracefully stop the worker.
 */
async function startWorker() {
  await ensureMongoConnection();

  const worker = new Worker(QUEUE_NAME, async (bullJob) => {
    const { jobData, importLogId } = bullJob.data || {};
    console.log(`Worker: processing bullJob.id=${bullJob.id} importLogId=${importLogId}`);

    // preview (short)
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
        // upsert: note we ask rawResult to inspect insertion vs update
        const res = await JobModel.findOneAndUpdate(
          filter,
          { $set: docFields, $setOnInsert: { createdFromFeed: true } },
          { upsert: true, new: true, rawResult: true }
        );

        const resultingDoc = res?.value ?? res?.ops?.[0] ?? null;
        const insertedFlag = res?.lastErrorObject ? (res.lastErrorObject.updatedExisting === false) : false;
        const printed = {
          isNew: !!insertedFlag,
          _id: resultingDoc?._id ?? (res?.lastErrorObject?.upserted ?? null),
          title: resultingDoc?.title ? String(resultingDoc.title).substring(0,80) : null,
          url: resultingDoc?.url ?? null,
          externalId: resultingDoc?.externalId ?? null
        };
        console.log('Worker: upsert =>', printed);

        if (insertedFlag) {
          if (importLogId) await ImportLog.findByIdAndUpdate(importLogId, { $inc: { totalImported: 1, newJobs: 1 } });
        } else {
          if (importLogId) await ImportLog.findByIdAndUpdate(importLogId, { $inc: { totalImported: 1, updatedJobs: 1 } });
        }
      } else {
        const created = await JobModel.create(docFields);
        console.log('Worker: created job _id=', created._id, ' title=', String(created.title).substring(0,80));
        if (importLogId) await ImportLog.findByIdAndUpdate(importLogId, { $inc: { totalImported: 1, newJobs: 1 } });
      }
      return Promise.resolve();
    } catch (err) {
      console.error('Worker: job processing error:', err?.message || err);
      const identifier = (jobData?.externalId || jobData?.url || jobData?.title) ?? 'unknown';
      try {
        if (importLogId) {
          await ImportLog.findByIdAndUpdate(importLogId, {
            $inc: { failedJobsCount: 1 },
            $push: {
              failedJobs: {
                identifier: String(identifier),
                reason: err.message,
                raw: jobData
              }
            }
          });
        }
      } catch (uerr) {
        console.error('Worker: failed to update ImportLog on job error:', uerr);
      }
      // rethrow so BullMQ marks the job as failed / triggers retries
      throw err;
    }
  }, { connection, concurrency: CONCURRENCY });

  worker.on('completed', (job) => {
    console.log(`Worker: job ${job.id} completed`);
  });
  worker.on('failed', (job, err) => {
    console.error(`Worker: job ${job ? job.id : 'unknown'} failed:`, err?.message || err);
  });
  worker.on('error', (err) => {
    console.error('Worker error', err);
  });

  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    try {
      console.log('Worker: closing worker...');
      await worker.close();
      console.log('Worker: worker closed');
    } catch (e) {
      console.error('Worker: error during worker close', e);
    }
    // don't disconnect mongoose here; caller may want to keep DB for server.
  }

  // graceful shutdown if run standalone
  process.once('SIGTERM', async () => {
    await close();
    if (require.main === module) process.exit(0);
  });
  process.once('SIGINT', async () => {
    await close();
    if (require.main === module) process.exit(0);
  });

  return { worker, close };
}

// If run directly: start worker and keep process alive
if (require.main === module) {
  (async () => {
    try {
      await startWorker();
      console.log('Worker started (standalone mode)');
    } catch (err) {
      console.error('Failed to start worker standalone:', err);
      process.exit(1);
    }
  })();
}

module.exports = { startWorker };
