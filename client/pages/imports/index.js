import { useEffect, useState } from 'react';
import { getImportLogs, importNow, importAll } from '../../utils/api';
import Link from "next/link";

export default function ImportsPage() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [feedUrl, setFeedUrl] = useState('');

  async function load(p = 1) {
    setLoading(true);
    try {
      const res = await getImportLogs(p, 10);
      setLogs(res.items || []);
      setPage(res.page || 1);
      setPages(res.pages || 1);
    } catch (e) {
      alert('Failed to fetch import logs: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(1); }, []);

  async function handleImportNow() {
    if (!feedUrl) return alert('Enter feedUrl');
    setLoading(true);
    try {
      const r = await importNow(feedUrl);
      alert('Enqueued: ' + (r.totalFetched || 0));
      load(page);
      setFeedUrl('');
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleImportAll() {
    if (!confirm('Import all feeds now?')) return;
    setLoading(true);
    try {
      const r = await importAll();
      alert('Import-all enqueued');
      load(1);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h2>Import runs</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {/* <Link
            href="/jobs"
            className="button inline-block bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition"
          >
            Jobs →
          </Link> */}

          {/* <button
            className="button"
            onClick={handleImportAll}
            disabled={loading}
          >
            Import All
          </button> */}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ flex: 1, padding: 8 }}
            placeholder="Feed URL (example: https://jobicy.com/?feed=job_feed)"
            value={feedUrl}
            onChange={(e) => setFeedUrl(e.target.value)}
          />
          <button
            className="button"
            onClick={handleImportNow}
            disabled={loading}
          >
            Import Now
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="small">Loading…</div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>fileName</th>
                  <th>importDateTime</th>
                  <th>Fetched</th>
                  <th>totalImported</th>
                  <th>New</th>
                  <th>Updated</th>
                  <th>Failed</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l._id}>
                    <td
                      style={{
                        maxWidth: 400,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {l.feedUrl}
                    </td>
                    <td className="small">
                      {new Date(l.createdAt).toLocaleString()}
                    </td>
                    <td>{l.totalFetched ?? 0}</td>
                    <td>{l.totalImported ?? 0}</td>
                    <td>{l.newJobs ?? 0}</td>
                    <td>{l.updatedJobs ?? 0}</td>
                    <td>{l.failedJobsCount ?? 0}</td>
                    {/* <td> <button
                      className="button"
                      onClick={handleImportNow}
                      disabled={loading}
                    >
                      <a
                        href={`/imports/${l._id}`}
                        className="inline-block px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
                      >
                        View
                      </a>
                    </button></td>                     */}

                    <Link
                      href={`/imports/${l._id}`}
                      className="inline-block px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
                    >
                      View
                    </Link>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="small">
                      No imports yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 12,
              }}
            >
              <div className="small">
                Page {page} / {pages}
              </div>
              <div>
                <button
                  className="button"
                  onClick={() => load(Math.max(1, page - 1))}
                  disabled={page <= 1}
                >
                  Prev
                </button>
                <button
                  className="button"
                  style={{ marginLeft: 8 }}
                  onClick={() => load(Math.min(pages, page + 1))}
                  disabled={page >= pages}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
  
}

