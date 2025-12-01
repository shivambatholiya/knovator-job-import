// server/index.js
require('dotenv').config();

console.log('DEBUG ENV: REDIS_URL=', process.env.REDIS_URL ? '[SET]' : '[NOT SET]', process.env.REDIS_URL ? process.env.REDIS_URL.replace(/:.*@/, ':*****@') : '');



const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const importLogsRouter = require('./routes/importLogs');
const { fetchFeed } = require('./services/xmlService');
const { queue } = require('./queues/jobQueue');
const ImportLog = require('./models/ImportLog');
const jobsRouter = require('./routes/jobs');

const app = express();
app.use(express.json());
app.use(cors());
app.use('/import-logs', importLogsRouter);
app.use('/jobs', jobsRouter);

// quick test route — paste into server/index.js
app.post('/enqueue-test', async (req, res) => {
  try {
    console.log('ENQUEUE-TEST: request received');
    const importLog = await ImportLog.create({ feedUrl: 'enqueue-test', notes: 'manual test' });
    await queue.add('process-job', { jobData: { title: 'test-job', url: 'http://example.test' }, importLogId: importLog._id.toString() }, { removeOnComplete: true });
    console.log('ENQUEUE-TEST: job added to queue, importLogId=', importLog._id.toString());
    return res.json({ ok: true, importLogId: importLog._id });
  } catch (err) {
    console.error('ENQUEUE-TEST error', err);
    return res.status(500).json({ error: err.message });
  }
});


const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/knovator_jobs';

// simple health route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

/**
 * POST /import-now
 * Body: { feedUrl: string }
 * - creates an ImportLog
 * - fetches feed
 * - enqueues each item into the queue with importLogId
 */
app.post('/import-now', async (req, res) => {
  const { feedUrl } = req.body;
  if (!feedUrl) return res.status(400).json({ error: 'feedUrl required in body' });

  // create initial import log
  let importLog = await ImportLog.create({ feedUrl, notes: 'started via /import-now' });

  try {
    const { items } = await fetchFeed(feedUrl);
    const total = items.length;

    // update totalFetched jobs
    await ImportLog.findByIdAndUpdate(importLog._id, { totalFetched: total });

    // add each item to queue with retry & backoff options
    for (const it of items) {
      await queue.add(
        "process-job",
        { jobData: it, importLogId: importLog._id.toString() },
        {
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
        }
      );
    }

    return res.json({ message: 'enqueued', totalFetched: total, importLogId: importLog._id });
  } catch (err) {
    // record failure reason
    await ImportLog.findByIdAndUpdate(importLog._id, {
      $set: { notes: `fetch error: ${err.message}` },
      $inc: { failedJobsCount: 0 }
    });
    return res.status(500).json({ error: 'failed to fetch or enqueue', detail: err.message });
  }
});

// connect to mongo and start server
mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('Mongo connected');
    const serverInstance = app.listen(PORT, () => console.log(`Server listening on ${PORT}`));

    // Conditionally start inline worker
    if (process.env.START_INLINE_WORKER === "true") {
      try {
        // require here to avoid loading worker if not needed
        const { startWorker } = require('./workers/jobWorker');
        const { close } = await startWorker();
        console.log('Inline worker started (START_INLINE_WORKER=true)');

        // ensure graceful shutdown closes both server and worker
        const shutdown = async () => {
          console.log('Shutting down server + inline worker...');
          try { await close(); } catch(e) { console.error('Error closing worker', e); }
          serverInstance.close(() => {
            mongoose.disconnect().then(()=>process.exit(0)).catch(()=>process.exit(0));
          });
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
      } catch (err) {
        console.error('Failed to start inline worker:', err);
        // do not crash the web server — worker is optional
      }
    } else {
      console.log('Inline worker disabled (START_INLINE_WORKER not set to "true")');
    }

  })
  .catch(err => {
    console.error('Mongo connection error', err);
    process.exit(1);
  });


if (process.env.ENABLE_CRON === "true") {
  try {
    require("./cron/importCron");
    console.log("Cron module loaded (ENABLE_CRON=true)");
  } catch (err) {
    console.error("Failed to load cron module:", err);
  }
} else {
  console.log("Cron disabled (ENABLE_CRON not set to true)");
}