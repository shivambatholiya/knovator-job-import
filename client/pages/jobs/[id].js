import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getJob } from "../../utils/api";
import toast from "react-hot-toast";

export default function JobDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const res = await getJob(id);
        setJob(res);
      } catch (e) {
        console.error(e);
        toast.error("Failed to fetch import logs");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading || !job)
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-sm text-gray-600">Loading…</div>
      </div>
    );

  const jobUrl = typeof window !== "undefined"
    ? `${window.location.origin}/jobs/${id}`
    : "";

  function downloadJSON() {
    const blob = new Blob([JSON.stringify(job, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `job-${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyJobURL() {
    if (!jobUrl) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(jobUrl);
      toast.success("Job URL copied!");
    } catch (e) {
      toast.error("Copy failed: " + e.message);
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="min-h-[70vh] p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">
            {job.title}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            View details about this job posting
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50"
          >
            ← Back to Admin
          </Link>
          <Link
            href="/jobs"
            className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50"
          >
            ← Back to Jobs
          </Link>

          <button
            onClick={copyJobURL}
            disabled={copying}
            className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-60"
          >
            {copying ? "Copying…" : "Copy URL"}
          </button>

          <button
            onClick={downloadJSON}
            className="px-3 py-2 bg-sky-600 text-white rounded-md text-sm hover:bg-sky-700"
          >
            Export JSON
          </button>
        </div>
      </div>

      {/* Main Job Card */}
      <div className="bg-white border rounded-lg shadow-sm p-5 mb-6">
        {/* Company + Posted + Location */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Company */}
          <div className="px-4 py-3 bg-sky-50 rounded-lg">
            <div className="text-xs text-gray-500">Company</div>
            <div className="mt-1 text-lg font-semibold text-gray-800">
              {job.company ?? "-"}
            </div>
          </div>

          {/* Posted */}
          <div className="px-4 py-3 bg-emerald-50 rounded-lg">
            <div className="text-xs text-gray-500">Posted</div>
            <div className="mt-1 text-lg font-semibold text-gray-800">
              {job.datePosted
                ? new Date(job.datePosted).toLocaleDateString()
                : "-"}
            </div>
          </div>

          {/* Location */}
          <div className="px-4 py-3 bg-amber-50 rounded-lg">
            <div className="text-xs text-gray-500">Location</div>
            <div className="mt-1 text-lg font-semibold text-gray-800">
              {job.location ?? "-"}
            </div>
          </div>
        </div>

        {/* Original Link */}
        <div className="mt-6">
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700"
          >
            View Original Job Posting ↗
          </a>
        </div>
      </div>

      {/* Description */}
      <div className="bg-white border rounded-lg shadow-sm p-5">
        <h2 className="text-lg font-medium text-gray-800 mb-3">
          Description
        </h2>

        <div className="prose prose-sm max-w-none text-gray-700">
          <div
            dangerouslySetInnerHTML={{
              __html:
                job.description ??
                (job.raw?.description ?? "<p>No description available.</p>"),
            }}
          />
        </div>
      </div>
    </div>
  );
}
