import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getJobs } from "../../utils/api";
import toast from "react-hot-toast";

/**
 * Improved JobsPage
 * - Tailwind styling
 * - Search with Enter key support
 * - Page size selector
 * - CSV export of current page
 * - "Remote only" client-side filter (works on the current page)
 * - Loading overlay + disabled states
 */

function downloadCSV(filename, rows) {
  if (!rows || rows.length === 0) return;
  const cols = ["title", "company", "location", "datePosted", "_id"];
  const csv = [
    cols.join(","),
    ...rows.map((r) =>
      cols
        .map((c) => {
          let v = r[c];
          if (v === undefined || v === null) v = "";
          if (c === "datePosted" && v) v = new Date(v).toLocaleString();
          return `"${String(v).replace(/"/g, '""')}"`;
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);

  // client-side quick filter
  const [remoteOnly, setRemoteOnly] = useState(false);

  async function load(p = 1) {
    setLoading(true);
    try {
      const res = await getJobs({ page: p, limit: pageSize, q });
      setJobs(res.items || []);
      setPage(res.page || 1);
      setPages(res.pages || 1);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load jobs: " + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  // client-side filtered view for the current page
  const visible = useMemo(() => {
    if (!remoteOnly) return jobs;
    return jobs.filter((j) =>
      String(j.location || "").toLowerCase().includes("remote")
    );
  }, [jobs, remoteOnly]);

  return (
    <div className="min-h-[72vh] p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Jobs</h1>
          <p className="text-sm text-gray-500 mt-1">
            Browse imported jobs — search, filter, and export.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/" className="text-sm px-3 py-2 border rounded-md hover:bg-gray-50">
            ← Back to Admin
          </Link>
          <Link href="/imports" className="text-sm px-3 py-2 border rounded-md hover:bg-gray-50">
            ← Imports
          </Link>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white border rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="col-span-2 flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") load(1);
              }}
              placeholder="Search title or company"
              className="flex-1 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
            <button
              onClick={() => load(1)}
              disabled={loading}
              className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 disabled:opacity-60"
            >
              Search
            </button>

            <button
              onClick={() => {
                setQ("");
                setRemoteOnly(false);
                load(1);
              }}
              className="px-3 py-2 bg-gray-100 border rounded-md hover:bg-gray-50 text-sm"
            >
              Clear
            </button>
          </div>

          <div className="flex items-center justify-end gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={remoteOnly}
                onChange={(e) => setRemoteOnly(e.target.checked)}
                className="h-4 w-4"
              />
              Remote only
            </label>

            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="border rounded-md px-2 py-1 text-sm"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </select>

            <button
              onClick={() => downloadCSV("jobs-page.csv", visible)}
              disabled={visible.length === 0}
              className="px-3 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-60 text-sm"
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white border rounded-lg shadow-sm p-4 relative">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-lg z-10">
            <div className="flex flex-col items-center gap-2">
              <svg
                className="animate-spin h-8 w-8"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <div className="text-sm text-gray-600">Loading…</div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="text-left text-sm text-gray-600 border-b">
                <th className="py-2 px-3">Title</th>
                <th className="py-2 px-3">Company</th>
                <th className="py-2 px-3">Location</th>
                <th className="py-2 px-3">Posted</th>
                <th className="py-2 px-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {visible.map((j) => (
                <tr key={j._id} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="py-3 px-3 max-w-[420px]">
                    <div className="text-sm text-gray-800 truncate">{j.title}</div>
                    <div className="text-xs text-gray-400">{j.summary ?? ""}</div>
                  </td>

                  <td className="py-3 px-3 text-sm text-gray-600">{j.company ?? "-"}</td>

                  <td className="py-3 px-3 text-sm text-gray-600">
                    {j.location ?? "-"}
                    {String(j.location || "").toLowerCase().includes("remote") && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800">
                        Remote
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-3 text-sm text-gray-600">
                    {j.datePosted ? new Date(j.datePosted).toLocaleDateString() : "-"}
                  </td>

                  <td className="py-3 px-3">
                    <div className="flex gap-2">
                      <Link href={`/jobs/${j._id}`} className="px-3 py-1 bg-sky-600 text-white rounded-md text-sm hover:bg-sky-700">
                        View
                      </Link>

                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(window.location.origin + `/jobs/${j._id}`);
                            toast.success("Job URL copied");
                          } catch (e) {
                            toast.error("Copy failed");
                          }
                        }}
                        className="px-2 py-1 border rounded-md text-sm hover:bg-gray-50"
                      >
                        Copy URL
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-gray-500">
                    No jobs found on this page. Try changing search or page size.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Page <span className="font-medium">{page}</span> / <span className="font-medium">{pages}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (page > 1) load(page - 1);
              }}
              disabled={page <= 1 || loading}
              className="px-3 py-1 border rounded-md text-sm hover:bg-gray-50 disabled:opacity-60"
            >
              Prev
            </button>

            <button
              onClick={() => {
                if (page < pages) load(page + 1);
              }}
              disabled={page >= pages || loading}
              className="px-3 py-1 border rounded-md text-sm hover:bg-gray-50 disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
