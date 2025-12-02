import { useEffect, useMemo, useState } from "react";
import { getImportLogs, importNow, importAll } from "../../utils/api";
import Link from "next/link";
import toast from "react-hot-toast";

/**
 * Improved ImportsPage with:
 * - Tailwind-based styling
 * - Search + date filters + "only failures" filter (client-side on current page)
 * - CSV export for visible rows
 * - Back to Admin link
 *
 * If you have server-side filtering, replace the client-side filter step
 * with passing filters into getImportLogs(page, pageSize, filters).
 */

function formatDateISO(d) {
  if (!d) return "";
  const dt = new Date(d);
  // yyyy-mm-dd
  return dt.toISOString().slice(0, 10);
}

function downloadCSV(filename, rows) {
  if (!rows || rows.length === 0) return;
  const cols = [
    "feedUrl",
    "createdAt",
    "totalFetched",
    "totalImported",
    "newJobs",
    "updatedJobs",
    "failedJobsCount",
    "_id",
  ];
  const csv = [
    cols.join(","),
    ...rows.map((r) =>
      cols
        .map((c) => {
          let v = r[c];
          if (v === undefined || v === null) v = "";
          // format date nicely
          if (c === "createdAt" && v) v = new Date(v).toLocaleString();
          // escape quotes
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

export default function ImportsPage() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // UI filters (client-side)
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [onlyFailures, setOnlyFailures] = useState(false);

  // Import form
  const [feedUrl, setFeedUrl] = useState("");

  // load function (pageSize 10 kept as before)
  async function load(p = 1) {
    setLoading(true);
    try {
      const res = await getImportLogs(p, 10);
      setLogs(res.items || []);
      setPage(res.page || 1);
      setPages(res.pages || 1);
    } catch (e) {
      console.error(e);
      toast.error("Failed to fetch import logs: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
  }, []);

  async function handleImportNow() {
    if (!feedUrl) return alert("Enter feed URL");
    setLoading(true);
    try {
      const r = await importNow(feedUrl);
      toast.success("Enqueued: " + (r.totalFetched ?? 0));
      await load(page);
      setFeedUrl("");
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Import failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleImportAll() {
    if (!confirm("Import all feeds now?")) return;
    setLoading(true);
    try {
      await importAll();
      toast.success("Import-all enqueued");
      await load(1);
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Import-all failed");
    } finally {
      setLoading(false);
    }
  }

  // client-side filtering over the currently loaded page
  const filtered = useMemo(() => {
    return logs.filter((l) => {
      // search by feedUrl
      if (q && !String(l.feedUrl || "").toLowerCase().includes(q.toLowerCase()))
        return false;

      // date filters (compare only date portions)
      if (dateFrom) {
        const from = new Date(dateFrom);
        const created = new Date(l.createdAt);
        if (created < from) return false;
      }
      if (dateTo) {
        // include the dateTo full day:
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        const created = new Date(l.createdAt);
        if (created > to) return false;
      }

      // only failures
      if (onlyFailures && (l.failedJobsCount == null || l.failedJobsCount <= 0))
        return false;

      return true;
    });
  }, [logs, q, dateFrom, dateTo, onlyFailures]);

  return (
    <div className="min-h-[70vh] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Import runs</h1>
          <p className="text-sm text-gray-500">
            Inspect feed imports, failures and details.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3 py-2 border rounded-md text-sm hover:bg-gray-50"
            legacyBehavior={false}
          >
            ← Back to Admin
          </Link>

          <button
            onClick={handleImportAll}
            disabled={loading}
            className="px-3 py-2 bg-amber-500 text-white rounded-md text-sm hover:bg-amber-600 disabled:opacity-60"
          >
            Import All
          </button>

          <button
            onClick={() => downloadCSV("imports-page.csv", filtered)}
            className="px-3 py-2 bg-sky-600 text-white rounded-md text-sm hover:bg-sky-700 disabled:opacity-60"
            disabled={filtered.length === 0}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white border rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="col-span-2 flex gap-2">
            <input
              className="flex-1 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300"
              placeholder="Feed URL (example: https://jobicy.com/?feed=job_feed)"
              value={feedUrl}
              onChange={(e) => setFeedUrl(e.target.value)}
            />
            <button
              onClick={handleImportNow}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-60"
            >
              Import Now
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              className="flex-1 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300"
              placeholder="Search feed URL on this page..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              onClick={() => {
                setQ("");
                setDateFrom("");
                setDateTo("");
                setOnlyFailures(false);
              }}
              className="px-3 py-2 bg-gray-100 border rounded-md hover:bg-gray-50 text-sm"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-col md:flex-row md:items-center gap-3 md:gap-4 text-sm">
          <div className="flex items-center gap-2">
            <label className="text-gray-600">From:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border rounded-md px-2 py-1 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-gray-600">To:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border rounded-md px-2 py-1 text-sm"
            />
          </div>

          <label className="inline-flex items-center gap-2 ml-auto">
            <input
              type="checkbox"
              checked={onlyFailures}
              onChange={(e) => setOnlyFailures(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm text-gray-700">Only failures</span>
          </label>
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
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <div className="text-sm text-gray-600">Loading…</div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="text-left text-sm text-gray-600 border-b">
                <th className="py-2 px-3">Feed URL</th>
                <th className="py-2 px-3">Imported At</th>
                <th className="py-2 px-3">Fetched</th>
                <th className="py-2 px-3">Imported</th>
                <th className="py-2 px-3">New</th>
                <th className="py-2 px-3">Updated</th>
                <th className="py-2 px-3">Failed</th>
                <th className="py-2 px-3">Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr
                  key={l._id}
                  className="border-b last:border-b-0 hover:bg-gray-50"
                >
                  <td className="py-3 px-3 max-w-[420px] truncate">
                    <div className="text-sm text-gray-800">{l.feedUrl}</div>
                    <div className="text-xs text-gray-400 truncate">
                      {l.fileName ? `file: ${l.fileName}` : ""}
                    </div>
                  </td>

                  <td className="py-3 px-3 text-sm text-gray-600">
                    {l.createdAt ? new Date(l.createdAt).toLocaleString() : "-"}
                  </td>

                  <td className="py-3 px-3">
                    <div className="text-sm font-medium text-gray-800">
                      {l.totalFetched ?? 0}
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    <div className="text-sm text-gray-800">
                      {l.totalImported ?? 0}
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                      {l.newJobs ?? 0}
                    </span>
                  </td>

                  <td className="py-3 px-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800">
                      {l.updatedJobs ?? 0}
                    </span>
                  </td>

                  <td className="py-3 px-3">
                    {l.failedJobsCount && l.failedJobsCount > 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {l.failedJobsCount}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">0</span>
                    )}
                  </td>

                  <td className="py-3 px-3">
                    <Link
                      href={`/imports/${l._id}`}
                      className="inline-block px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-sm text-gray-500">
                    No imports found on this page (try clearing filters or go to another page).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Page <span className="font-medium">{page}</span> /{" "}
            <span className="font-medium">{pages}</span>
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
