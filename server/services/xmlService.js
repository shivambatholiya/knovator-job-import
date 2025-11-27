// server/services/xmlService.js
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

/**
 * fetchFeed(url)
 * - fetches an XML feed
 * - parses XML -> JS object
 * - normalizes common RSS/Atom shapes to an array of items
 * - returns { items: Array, raw: Object }
 */
async function fetchFeed(url, timeout = 15000) {
  const res = await axios.get(url, { timeout });
  const xml = res.data;

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });

  const parsed = parser.parse(xml);

  let items = [];

  // RSS style
  if (parsed?.rss?.channel) {
    const channel = parsed.rss.channel;
    items = channel.item ? (Array.isArray(channel.item) ? channel.item : [channel.item]) : [];
  }
  // Atom style
  else if (parsed?.feed?.entry) {
    items = Array.isArray(parsed.feed.entry) ? parsed.feed.entry : [parsed.feed.entry];
  }
  // Some feeds might have top-level 'item' or 'items'
  else if (parsed?.item) {
    items = Array.isArray(parsed.item) ? parsed.item : [parsed.item];
  }
  else if (parsed?.items) {
    items = Array.isArray(parsed.items) ? parsed.items : [parsed.items];
  }
  else {
    // try to find first array value in parsed
    const firstArray = Object.values(parsed).find(v => Array.isArray(v));
    if (firstArray) items = firstArray;
  }

  const normalized = items.map(it => {
    // many feeds use different names; try common ones carefully
    const title = it.title?.['#text'] ?? it.title ?? it.job_title ?? it.position ?? null;
    const link = it.link?.['@_href'] ?? it.link ?? it.link?.['#text'] ?? it.url ?? it.guid ?? null;
    const description = it.description ?? it.summary ?? it.content ?? null;
    const pubDate = it.pubDate ?? it.published ?? it['dc:date'] ?? null;
    const guid = it.guid ?? it.id ?? it['@_id'] ?? null;

    // company/location sometimes nested; try common keys
    const company = it.company ?? it['company:name'] ?? it['hiringOrganization'] ?? null;
    const location = it.location ?? it['jobLocation'] ?? null;

    return {
      title,
      url: link,
      description,
      datePosted: pubDate ? new Date(pubDate) : undefined,
      externalId: guid ? String(guid) : undefined,
      company,
      location,
      raw: it
    };
  });

  return { items: normalized, raw: parsed };
}

module.exports = { fetchFeed };