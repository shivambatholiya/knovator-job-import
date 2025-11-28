import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { getJob } from '../../utils/api';
import Link from 'next/link';

export default function JobDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async ()=> {
      setLoading(true);
      try {
        const res = await getJob(id);
        setJob(res);
      } catch (e) {
        alert('Failed to load job: ' + e.message);
      } finally { setLoading(false); }
    })();
  }, [id]);

  if (loading || !job) return <div className="container"><div className="small">Loading…</div></div>;

  return (
    <div className="container">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <h3>{job.title}</h3>
        <div>
          <button className="button" onClick={()=>router.push('/jobs')}>Back</button>
        </div>
      </div>

      <div className="card">
        <div><strong>Company:</strong> {job.company ?? '-'}</div>
        <div className="small">Posted: {job.datePosted ? new Date(job.datePosted).toLocaleString() : '-'}</div>
        <div style={{ marginTop: 12 }}>
          <strong>Location:</strong> {job.location ?? '-'}
        </div>
        <div style={{ marginTop: 12 }}>
          <a href={job.url} target="_blank" rel="noreferrer">Original Link</a>
        </div>
      </div>

      <div className="card" style={{ marginTop:12 }}>
        <h4>Description</h4>
        <div dangerouslySetInnerHTML={{ __html: job.description ?? (job.raw?.description ?? '') }} />
      </div>
    </div>
  );
}
