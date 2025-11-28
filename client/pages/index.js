export default function Home() {
  return (
    <div className="container">
      <div className="card">
        <h2>Admin Dashboard</h2>

        <div style={{ marginTop: 16 }}>
          <a
            href="/imports"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            style={{ marginRight: 8 }}
          >
            View Import Logs
          </a>

          <a
            href="/jobs"
            className="inline-block px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
          >
            View Jobs
          </a>
        </div>
      </div>
    </div>
  );
}
