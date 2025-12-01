// server/queues/jobQueue.js
require('dotenv').config();
const { Queue, QueueScheduler } = require('bullmq');

const QUEUE_NAME = 'job-import-queue';

const getConnection = () => {
  const raw = process.env.REDIS_URL && process.env.REDIS_URL.trim().length ? process.env.REDIS_URL.trim() : null;

  if (raw) {
    // Ensure scheme is rediss:// for TLS
    const url = raw.replace(/^redis:\/\//, 'rediss://');
    // Provide socket options so node-redis / bullmq uses TLS
    // rejectUnauthorized: false is OK for local dev if necessary; remove for production.
    return { url, socket: { tls: true, rejectUnauthorized: false } };
  }

  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
    password: process.env.REDIS_PASSWORD || undefined
  };
};

const connection = getConnection();
console.log('Queue: using Redis connection ->', connection.url ? '[url with TLS]' : JSON.stringify(connection).slice(0,120));

let queueScheduler;
try {
  queueScheduler = new QueueScheduler(QUEUE_NAME, { connection });
} catch (err) {
  console.warn('QueueScheduler creation warning:', err?.message || err);
}

const queue = new Queue(QUEUE_NAME, { connection });

queue.on('error', (err) => {
  console.error('Queue error', err);
});

module.exports = { queue, queueScheduler, QUEUE_NAME, connection };
