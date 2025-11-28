import { useEffect, useState } from 'react';
import { getJobs } from '../../utils/api';
import Link from 'next/link';

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

  async function load(p = 1) {
    setLoading(true);
    try {
      const res = await getJobs({ page: p, limit: 20, q });
      setJobs(res.items || []);
      setPage(res.page || 1);
      setPages(res.pages || 1);
    } catch (e) {
      alert('Failed to load jobs: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(1); }, []);

  return (
    <div className="container">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <h2>Jobs</h2>
        <div>
          <Link href="/imports"><a className="small">← Imports</a></Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ flex:1, padding:8 }} placeholder="Search title or company" value={q} onChange={e=>setQ(e.target.value)} />
          <button className="button" onClick={()=>load(1)} disabled={loading}>Search</button>
        </div>
      </div>

      <div className="card">
        {loading ? <div className="small">Loading…</div> : (
          <>
            <table className="table">
              <thead>
                <tr><th>Title</th><th>Company</th><th>Location</th><th>Posted</th><th></th></tr>
              </thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j._id}>
                    <td style={{maxWidth:300,overflow:'hidden',textOverflow:'ellipsis'}}>{j.title}</td>
                    <td className="small">{j.company ?? '-'}</td>
                    <td className="small">{j.location ?? '-'}</td>
                    <td className="small">{j.datePosted ? new Date(j.datePosted).toLocaleDateString() : '-'}</td>
                    <td><Link href={`/jobs/${j._id}`}><a>View</a></Link></td>
                  </tr>
                ))}
                {jobs.length === 0 && <tr><td colSpan={5} className="small">No jobs</td></tr>}
              </tbody>
            </table>

            <div style={{ display:'flex', justifyContent:'space-between', marginTop:12 }}>
              <div className="small">Page {page} / {pages}</div>
              <div>
                <button className="button" onClick={()=>load(Math.max(1,page-1))} disabled={page<=1}>Prev</button>
                <button className="button" style={{marginLeft:8}} onClick={()=>load(Math.min(pages,page+1))} disabled={page>=pages}>Next</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
