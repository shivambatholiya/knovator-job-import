export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100 flex justify-center items-start py-12 px-4">
      <div className="max-w-3xl w-full">
        {/* Header */}
        <div className="bg-white shadow-md rounded-xl p-6 mb-8">
          <h2 className="text-3xl font-bold text-gray-800">Admin Dashboard</h2>
          <p className="text-gray-500 mt-1">
            Manage logs, jobs and system activity
          </p>
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Import Logs Card */}
          <a
            href="/imports"
            className="group block bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition border border-gray-200"
          >
            <div className="flex items-center gap-4">
              {/* Icon */}
              <div className="bg-blue-100 p-4 rounded-lg group-hover:bg-blue-200 transition">
                📥
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-800 group-hover:text-blue-700 transition">
                  View Import Logs
                </h3>
                <p className="text-gray-500">
                  Check uploaded files & queue entries
                </p>
              </div>
            </div>
          </a>

          {/* Jobs Card */}
          <a
            href="/jobs"
            className="group block bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition border border-gray-200"
          >
            <div className="flex items-center gap-4">
              {/* Icon */}
              <div className="bg-green-100 p-4 rounded-lg group-hover:bg-green-200 transition">
                ⚙️
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-800 group-hover:text-green-700 transition">
                  View Jobs
                </h3>
                <p className="text-gray-500">
                  Monitor background tasks & worker status
                </p>
              </div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
