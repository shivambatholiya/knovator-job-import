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

  if (parsed?.rss?.channel) {
    const channel = parsed.rss.channel;
    items = channel.item ? (Array.isArray(channel.item) ? channel.item : [channel.item]) : [];
  } else if (parsed?.feed?.entry) {
    items = Array.isArray(parsed.feed.entry) ? parsed.feed.entry : [parsed.feed.entry];
  } else if (parsed?.item) {
    items = Array.isArray(parsed.item) ? parsed.item : [parsed.item];
  } else if (parsed?.items) {
    items = Array.isArray(parsed.items) ? parsed.items : [parsed.items];
  } else {
    const firstArray = Object.values(parsed).find(v => Array.isArray(v));
    if (firstArray) items = firstArray;
  }

  const normalized = items.map(it => {
    // helper to safely read nested values
    const getText = (val) => {
      if (val === undefined || val === null) return undefined;
      if (typeof val === 'string') return val;
      if (typeof val === 'object') {
        // common xml2js shapes: { "#text": "..." } or { "#text": "...", "isPermaLink": "false" }
        return val['#text'] ?? val['#'] ?? val['@_href'] ?? val['@_id'] ?? val['$'] ?? undefined;
      }
      return String(val);
    };

    const title = getText(it.title) ?? it.job_title ?? it.position ?? null;

    // link can be object or string
    const link = getText(it.link) ?? getText(it.url) ?? getText(it.guid) ?? it.guid ?? null;

    const description = getText(it.description) ?? getText(it.summary) ?? getText(it.content) ?? null;
    const pubDate = getText(it.pubDate) ?? getText(it.published) ?? getText(it['dc:date']) ?? null;

    // extract guid cleanly
    let guidVal;
    if (it.guid) guidVal = getText(it.guid);
    else if (it.id) guidVal = getText(it.id);
    else guidVal = undefined;

    // use guidVal, or link, or id as externalId
    const externalId = guidVal ?? link ?? (it.id ? String(it.id) : undefined);

    const company = it.company ?? it['company:name'] ?? it['hiringOrganization'] ?? null;
    const location = it.location ?? it['jobLocation'] ?? null;

    return {
      title,
      url: link,
      description,
      datePosted: pubDate ? new Date(pubDate) : undefined,
      externalId: externalId ? String(externalId) : undefined,
      company,
      location,
      raw: it
    };
  });

  return { items: normalized, raw: parsed };
}

module.exports = { fetchFeed };
