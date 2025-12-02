# Architecture & Design — Job Importer

## Goals
- Reliable, scalable ingestion of XML job feeds.
- Durable background processing with retry and concurrency control.
- Efficient upsert into MongoDB for large volumes (bulkWrite).
- Clear separation: fetcher → parser → worker → storage → admin UI.

## High-level components
1. **Feed Fetcher (Scheduler)**
   - Runs on a schedule (cron) and enqueues `fetchFeed` jobs into the queue.
   - Responsible for fetching XML feed payloads and basic validation.

2. **Queue (Redis + Bull/BullMQ)**
   - Receives `fetchFeed` jobs. Decouples fetch scheduling and processing.
   - Supports retries, backoff, delayed jobs, and concurrency.

3. **Worker(s)**
   - `jobProcessor` consumes feed payloads, parses XML → JSON, normalizes items.
   - Performs batch `bulkWrite()` upserts into MongoDB.
   - Writes an `ImportLog` document per run.

4. **API Server (Express)**
   - Exposes CRUD/read endpoints for Jobs and Import Logs for the admin UI.
   - Optionally exposes endpoints to trigger manual import or re-run jobs.

5. **Admin UI (Next.js)**
   - Lists jobs and import logs, supports filtering/pagination.
   - Shows import run details (failed items + reasons).
   - Optional real-time updates via Socket.IO / SSE.

## Data flow (sequence)
1. Scheduler -> enqueue `fetchFeed` job
2. Worker dequeues job -> fetch XML -> parse -> normalize
3. Worker creates batches -> bulkWrite upserts to `jobs` collection
4. Worker records results to `import_logs` collection
5. API serves results to admin UI

## Schema notes
- `jobs` collection:
  - Fields: title, company, description, location, externalId, url, datePosted, categories, raw, createdAt, updatedAt
  - Indexes:
    - `externalId: 1` (unique if available)
    - `text` index on title, description, company for search
    - compound indexes for common filters (company + location)

- `import_logs` collection:
  - Fields: feedUrl, timestamp, totalFetched, totalImported, newJobs, updatedJobs, failedJobs[], durationMs

## Failure handling
- Use Bull retry & backoff.
- Persist failure reasons to `import_logs`.
- For persistent failures, provide a manual re-run endpoint.

## Performance & scale tips
- Use `bulkWrite` with batch size (configurable like 500).
- Horizontally scale workers (multiple instances) — queue ensures single ownership of jobs.
- Use sharding or partitioning for very large job tables.
- Use CDN/caching for admin UI, and pagination for API.

## Deployment suggestions
- Backend + worker as separate services (same repo, different processes).
- Deploy backend on Render / AWS ECS; Worker scaled via separate service replicas.
- Frontend on Vercel.
- Use MongoDB Atlas and Redis Cloud for managed reliability.

## Diagram
(Use draw.io / Excalidraw to draw boxes: Scheduler -> Queue -> Worker -> MongoDB; API + Admin UI reading from MongoDB. Save diagrams in `/docs/images/`.)

