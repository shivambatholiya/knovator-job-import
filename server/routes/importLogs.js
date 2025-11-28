const express = require('express');
const router = express.Router();
const ImportLog = require('../models/ImportLog');
const { queue } = require('../queues/jobQueue');
const feeds = require('../config/jobList.json');

/**
 * GET /import-logs
 * Query: page, limit, feedUrl
 */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || '10', 10)));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.feedUrl) filter.feedUrl = req.query.feedUrl;

    const [items, total] = await Promise.all([
      ImportLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ImportLog.countDocuments(filter)
    ]);

    res.json({
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      items
    });
  } catch (err) {
    console.error('GET /import-logs error', err);
    res.status(500).json({ error: 'failed to fetch import logs' });
  }
});

/**
 * GET /import-logs/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const doc = await ImportLog.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  } catch (err) {
    console.error('GET /import-logs/:id error', err);
    res.status(500).json({ error: 'failed to fetch import log' });
  }
});

// POST /import-all
router.post('/import-all', async (req, res) => {
  try {
    for (const feedUrl of feeds) {
      await queue.add(
        "process-feed",
        { feedUrl },
        { removeOnComplete: true, attempts: 3 }
      );
    }
    res.json({ message: "All feeds enqueued", totalFeeds: feeds.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to enqueue all feeds', detail: err.message });
  }
});

// POST /import-logs/:id/requeue
router.post('/:id/requeue', async (req, res) => {
  const { id } = req.params;

  const log = await ImportLog.findById(id).lean();
  if (!log) return res.status(404).json({ error: 'Import log not found' });

  const failed = log.failedJobs || [];
  let enqueued = 0;

  for (const f of failed) {
    if (f.raw) {
      await queue.add(
        "process-job",
        { jobData: f.raw, importLogId: id },
        { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
      );
      enqueued++;
    }
  }

  res.json({ ok: true, enqueued });
});

module.exports = router;
