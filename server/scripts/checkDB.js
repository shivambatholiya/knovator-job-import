// server/scripts/checkDb.js
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/knovator_jobs';

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to', MONGO_URI);

  const Job = mongoose.model('Job', new mongoose.Schema({}, { strict: false }), 'jobs');
  const ImportLog = mongoose.model('ImportLog', new mongoose.Schema({}, { strict: false }), 'importlogs');

  const jobCount = await Job.countDocuments();
  const logCount = await ImportLog.countDocuments();

  console.log('jobs count =', jobCount);
  console.log('import_logs count =', logCount);

  const recentJobs = await Job.find({}).sort({ createdAt: -1 }).limit(5).lean();
  const recentLogs = await ImportLog.find({}).sort({ createdAt: -1 }).limit(3).lean();

//   console.log('recent jobs sample:', JSON.stringify(recentJobs, null, 2));
//   console.log('recent import_logs sample:', JSON.stringify(recentLogs, null, 2));

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('Error', err);
  process.exit(1);
});
