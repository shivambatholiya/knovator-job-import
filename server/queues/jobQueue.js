// server/queues/jobQueue.js
require('dotenv').config();
const { Queue } = require('bullmq');

let QueueScheduler;
try {
  QueueScheduler = require('bullmq').QueueScheduler;
} catch (e) {
  QueueScheduler = undefined;
}

let connection;
if (process.env.REDIS_URL) {
  connection = process.env.REDIS_URL;
} else {
  connection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
    password: process.env.REDIS_PASSWORD || undefined
  };
}

const QUEUE_NAME = 'job-import-queue';

let scheduler;
if (typeof QueueScheduler === 'function') {
  try {
    scheduler = new QueueScheduler(QUEUE_NAME, { connection });
    scheduler.on('failed', (err) => {
      console.error('QueueScheduler error', err);
    });
  } catch (err) {
    console.warn('Unable to start QueueScheduler, continuing without it:', err.message || err);
  }
} else {
  console.warn('QueueScheduler not available in this bullmq version — continuing without scheduler.');
}

const queue = new Queue(QUEUE_NAME, { connection });

queue.on('error', (err) => {
  console.error('Queue error', err);
});

module.exports = { queue, scheduler, QUEUE_NAME };
