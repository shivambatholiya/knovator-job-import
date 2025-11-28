// server/routes/jobs.js
const express = require('express');
const router = express.Router();
const Job = require('../models/Job');

// GET /jobs?page=1&limit=20&q=react&feedUrl=...
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, parseInt(req.query.limit || '20', 10));
    const q = req.query.q ? String(req.query.q).trim() : null;
    const feedUrl = req.query.feedUrl ? String(req.query.feedUrl).trim() : null;

    const filter = {};
    if (q) {
      // text-like search on title and company
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { company: { $regex: q, $options: 'i' } }
      ];
    }
    if (feedUrl) filter['raw.link'] = feedUrl; // if you store feed link in raw

    const skip = (page - 1) * limit;

    // exclude very large raw.content:encoded field if present to keep payload small
    const projection = { 'raw.content:encoded': 0, 'raw["content:encoded"]': 0 };

    const [items, total] = await Promise.all([
      Job.find(filter, projection).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Job.countDocuments(filter)
    ]);

    const pages = Math.max(1, Math.ceil(total / limit));

    res.json({ items, page, pages, total });
  } catch (err) {
    console.error('GET /jobs error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /jobs/:id
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).lean();
    if (!job) return res.status(404).json({ error: 'not found' });
    res.json(job);
  } catch (err) {
    console.error('GET /jobs/:id error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
