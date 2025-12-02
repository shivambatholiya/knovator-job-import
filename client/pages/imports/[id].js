import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getImportLog } from "../../utils/api";
import toast from "react-hot-toast";

function formatDateTime(d) {
  if (!d) return "-";
  return new Date(d).toLocaleString();
}

export default function ImportDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [requeueLoading, setRequeueLoading] = useState(false);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const res = await getImportLog(id);
        setLog(res);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load import log: " + (e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function requeueFailed() {
    if (!log || !(log.failedJobsCount > 0)) return;
    if (!confirm("Requeue all failed items from this import?")) return;

    setRequeueLoading(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${apiBase}/import-logs/${id}/requeue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Requeue failed");
      }
      toast.success("Requeue request accepted.");
    } catch (e) {
      console.error(e);
      toast.error("Failed to requeue: " + (e?.message || e));
    } finally {
      setRequeueLoading(false);
    }
  }

  async function copyFeedUrl() {
    if (!log?.feedUrl) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(log.feedUrl);
      toast.success("Feed URL copied to clipboard");
    } catch (e) {
      toast.error("Copy failed: " + (e?.message || e));
    } finally {
      setCopying(false);
    }
  }

  function downloadJSON() {
    if (!log) return;
    const blob = new Blob([JSON.stringify(log, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import-log-${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadFailedCSV() {
    const items = Array.isArray(log?.failedJobs) ? log.failedJobs : [];
    if (items.length === 0) return alert("No failed jobs to export.");
    const cols = ["identifier", "reason", "metadata"];
    const rows = items.map((r) =>
      cols
        .map((c) => {
          let v = r[c];
          if (v === undefined || v === null) v = "";
          if (typeof v === "object") v = JSON.stringify(v);
          return `"${String(v).replace(/"/g, '""')}"`;
        })
        .join(",")
    );
    const csv = [cols.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `failed-jobs-${id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading)
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-sm text-gray-600">Loading…</div>
      </div>
    );

  if (!log)
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-sm text-gray-600">No import found.</div>
      </div>
    );

  // show up to 100 most recent failures
  const failedList = Array.isArray(log.failedJobs) ? log.failedJobs.slice(-100).reverse() : [];

  return (
    <div className="p-6">
      {/* Top controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Import Detail</h1>
          <p className="text-sm text-gray-500 mt-1">Feed import summary and failures</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50"
          >
            ← Back to Admin
          </Link>

          <Link
            href="/imports"
            className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50"
          >
            ← Back to Imports
          </Link>

          <button
            onClick={downloadJSON}
            className="px-3 py-2 bg-sky-600 text-white text-sm rounded-md hover:bg-sky-700"
          >
            Download JSON
          </button>

          <button
            onClick={downloadFailedCSV}
            disabled={failedList.length === 0}
            className="px-3 py-2 bg-amber-500 text-white text-sm rounded-md hover:bg-amber-600 disabled:opacity-60"
          >
            Export Failures
          </button>
        </div>
      </div>

      {/* Main card */}
      <div className="bg-white border rounded-lg shadow-sm p-5 mb-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3">
              <div className="flex-0">
                <div className="h-12 w-12 rounded-md bg-gradient-to-tr from-sky-400 to-indigo-500 flex items-center justify-center text-white font-bold">
                  I
                </div>
              </div>

              <div className="min-w-0">
                <div className="text-sm text-gray-500">Feed</div>
                <div className="mt-1 text-sm text-gray-800 break-all">{log.feedUrl}</div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={copyFeedUrl}
                    disabled={copying}
                    className="text-sm px-3 py-1 border rounded-md hover:bg-gray-50"
                  >
                    {copying ? "Copying…" : "Copy Feed URL"}
                  </button>
                  <button
                    onClick={() => navigator.clipboard && navigator.clipboard.writeText(log.fileName || "")}
                    className="text-sm px-3 py-1 border rounded-md hover:bg-gray-50"
                  >
                    Copy Filename
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 text-sm text-gray-600">
              <div>Started: <span className="font-medium text-gray-800">{formatDateTime(log.createdAt)}</span></div>
              {log.completedAt && (
                <div>Completed: <span className="font-medium text-gray-800">{formatDateTime(log.completedAt)}</span></div>
              )}
            </div>
          </div>

          <div className="flex-shrink-0 w-full md:w-auto flex items-center gap-3">
            {/* Stats */}
            <div className="flex gap-2">
              <div className="px-3 py-2 bg-emerald-50 rounded-lg text-center min-w-[72px]">
                <div className="text-xs text-gray-500">Fetched</div>
                <div className="text-lg font-semibold text-gray-800">{log.totalFetched ?? 0}</div>
              </div>

              <div className="px-3 py-2 bg-sky-50 rounded-lg text-center min-w-[72px]">
                <div className="text-xs text-gray-500">Imported</div>
                <div className="text-lg font-semibold text-gray-800">{log.totalImported ?? 0}</div>
              </div>

              <div className="px-3 py-2 bg-amber-50 rounded-lg text-center min-w-[72px]">
                <div className="text-xs text-gray-500">New</div>
                <div className="text-lg font-semibold text-gray-800">{log.newJobs ?? 0}</div>
              </div>

              <div className="px-3 py-2 bg-indigo-50 rounded-lg text-center min-w-[72px]">
                <div className="text-xs text-gray-500">Updated</div>
                <div className="text-lg font-semibold text-gray-800">{log.updatedJobs ?? 0}</div>
              </div>

              <div className="px-3 py-2 bg-red-50 rounded-lg text-center min-w-[72px]">
                <div className="text-xs text-gray-500">Failed</div>
                <div className="text-lg font-semibold text-gray-800">{log.failedJobsCount ?? 0}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Requeue */}
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={requeueFailed}
            disabled={requeueLoading || !(log.failedJobsCount > 0)}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-60"
          >
            {requeueLoading ? "Requeuing…" : "Requeue Failed Jobs"}
          </button>

          <div className="text-sm text-gray-500">Only failed jobs will be requeued (server-side).</div>
        </div>
      </div>

      {/* Failed jobs list */}
      <div className="bg-white border rounded-lg shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-800">Failed Jobs ({failedList.length})</h3>
            <p className="text-sm text-gray-500">Most recent failures shown first (up to 100).</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                // simple filter: open search on imports page? For now just scroll to top
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="px-3 py-1 border rounded-md text-sm hover:bg-gray-50"
            >
              Top
            </button>
            <button
              onClick={downloadFailedCSV}
              disabled={failedList.length === 0}
              className="px-3 py-1 bg-amber-500 text-white rounded-md text-sm hover:bg-amber-600 disabled:opacity-60"
            >
              Export CSV
            </button>
          </div>
        </div>

        {failedList.length === 0 ? (
          <div className="text-sm text-gray-500">No failures recorded for this import.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-auto text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 px-3">Identifier</th>
                  <th className="py-2 px-3">Reason</th>
                  <th className="py-2 px-3">Metadata</th>
                  <th className="py-2 px-3">Actions</th>
                </tr>
              </thead>

              <tbody>
                {failedList.map((f, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50 align-top">
                    <td className="py-3 px-3 max-w-[260px]">
                      <div className="font-medium text-gray-800 truncate">{f.identifier}</div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="text-sm text-gray-700">{f.reason}</div>
                    </td>

                    <td className="py-3 px-3 max-w-[420px]">
                      <div className="text-xs text-gray-500 truncate">
                        {f.metadata ? JSON.stringify(f.metadata) : "-"}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(f.identifier || "");
                              toast.success("Identifier copied");
                            } catch (e) {
                              toast.error("Copy failed");
                            }
                          }}
                          className="px-2 py-1 border rounded-md text-sm hover:bg-gray-50"
                        >
                          Copy
                        </button>

                        <button
                          onClick={() => {
                            // open a modal? for now show details in alert
                            alert(
                              `Identifier: ${f.identifier}\n\nReason: ${f.reason}\n\nMetadata: ${JSON.stringify(
                                f.metadata || {},
                                null,
                                2
                              )}`
                            );
                          }}
                          className="px-2 py-1 bg-sky-600 text-white rounded-md text-sm hover:bg-sky-700"
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
