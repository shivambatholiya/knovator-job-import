import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { getImportLog } from '../../utils/api';

export default function ImportDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [requeueLoading, setRequeueLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const res = await getImportLog(id);
        setLog(res);
      } catch (e) {
        alert('Failed to load import log: ' + e.message);
      } finally { setLoading(false); }
    })();
  }, [id]);

  async function requeueFailed() {
    if (!confirm('Requeue all failed items from this import?')) return;
    setRequeueLoading(true);
    try {
      // call backend requeue endpoint: POST /import-logs/:id/requeue
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/import-logs/${id}/requeue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(await res.text());
      alert('Requeue request accepted.');
    } catch (e) {
      alert('Failed to requeue: ' + e.message);
    } finally { setRequeueLoading(false); }
  }

  if (loading || !log) return <div className="container"><div className="small">Loading…</div></div>;

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3>Import Detail</h3>
        <div>
          <button className="button" onClick={() => router.push('/imports')}>Back</button>
        </div>
      </div>

      <div className="card">
        <div><strong>Feed:</strong> <span style={{wordBreak:'break-all'}}>{log.feedUrl}</span></div>
        <div className="small">Started: {new Date(log.createdAt).toLocaleString()}</div>
        <div style={{ marginTop: 8 }}>
          <strong>Fetched:</strong> {log.totalFetched ?? 0} &nbsp;
          <strong>Imported:</strong> {log.totalImported ?? 0} &nbsp;
          <strong>New:</strong> {log.newJobs ?? 0} &nbsp;
          <strong>Updated:</strong> {log.updatedJobs ?? 0} &nbsp;
          <strong>Failed:</strong> {log.failedJobsCount ?? 0}
        </div>

        <div style={{ marginTop: 12 }}>
          <button className="button" onClick={requeueFailed} disabled={requeueLoading || !(log.failedJobsCount > 0)}>
            {requeueLoading ? 'Requeuing…' : 'Requeue Failed Jobs'}
          </button>
        </div>
      </div>

      <div className="card">
        <h4>Failed Jobs (most recent)</h4>
        {Array.isArray(log.failedJobs) && log.failedJobs.length ? (
          <ul>
            {log.failedJobs.slice(-50).reverse().map((f, i) => (
              <li key={i} style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 600 }}>{f.identifier}</div>
                <div className="small">{f.reason}</div>
              </li>
            ))}
          </ul>
        ) : <div className="small">No failures recorded.</div>}
      </div>
    </div>
  );
}
