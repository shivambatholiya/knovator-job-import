// server/testFetch.js
const { fetchFeed } = require('./services/xmlService');

(async () => {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node testFetch.js <feed-url>');
    process.exit(1);
  }
  try {
    const { items } = await fetchFeed(url);
    console.log('Total items parsed:', items.length);
    console.log('First item sample:', items[0]);
  } catch (err) {
    console.error('Fetch error', err.message);
  }
})();
