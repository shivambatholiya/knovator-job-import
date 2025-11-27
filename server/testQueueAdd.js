// server/testQueueAdd.js
const { queue } = require('./queues/jobQueue');

(async () => {
  try {
    const j = await queue.add('test-job', { hello: 'world' });
    console.log('Added job id=', j.id);
  } catch (err) {
    console.error('Queue add error:', err);
  } finally {
    process.exit(0);
  }
})();
