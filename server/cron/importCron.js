// server/cron/importCron.js
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { queue } = require('../queues/jobQueue');
const { fetchFeed } = require('../services/xmlService');
const ImportLog = require('../models/ImportLog');

const FEEDS_PATH = path.join(__dirname, '../config/jobList.json');

// helper to read feeds
function loadFeeds() {
  try {
    const raw = fs.readFileSync(FEEDS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load feeds.json', err);
    return [];
  }
}

/**
 * schedule: run hourly at minute 5
 */
const CRON_EXPR = process.env.IMPORT_CRON_EXPR || '5 * * * *';
console.log('Cron: ENABLED - will run with expr:', CRON_EXPR);

cron.schedule(CRON_EXPR, async () => {
  console.log('Cron: starting scheduled import run at', new Date().toISOString());
  const feeds = loadFeeds();

  for (const feedUrl of feeds) {
    let importLog;
    try {
      importLog = await ImportLog.create({ feedUrl, notes: 'scheduled import' });

      const { items } = await fetchFeed(feedUrl);
      const total = Array.isArray(items) ? items.length : 0;

      await ImportLog.findByIdAndUpdate(importLog._id, { totalFetched: total });

      for (const it of items) {
        // add with retry & backoff options
        await queue.add('process-job', { jobData: it, importLogId: importLog._id.toString() }, {
          removeOnComplete: true,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 }
        });
      }

      console.log(`Cron: enqueued ${total} items from ${feedUrl}`);
    } catch (err) {
      console.error('Cron: failed for feed', feedUrl, err?.message || err);
      if (importLog && importLog._id) {
        await ImportLog.findByIdAndUpdate(importLog._id, {
          $set: { notes: `cron fetch error: ${err.message || err}` }
        });
      }
    }
  }
});
