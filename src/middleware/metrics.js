import os from "os"

let metrics = {
  requestsTotal: 0,
  requestsBlocked: 0,
  activeJobs: 0,
  queueLength: 0,
  lastReset: new Date().toISOString()
}

export function collectMetrics({ queue }) {
  return async function (req, res, next) {
    metrics.requestsTotal++
    // snapshot current queue state on each request
    metrics.activeJobs = queue.activeCount()
    metrics.queueLength = queue.waitingCount()
    next()
  }
}

export function adminStatus({ queue }) {
  return (req, res) => {
    const token = req.headers["x-rinawarp-key"]
    if (token !== process.env.RINAWARP_PRIVATE_KEY) {
      metrics.requestsBlocked++
      return res.status(403).json({ error: "Forbidden" })
    }

    const uptime = process.uptime()
    res.json({
      service: "RinaWarp LLM Router",
      uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
      hostname: os.hostname(),
      metrics,
      queue: {
        active: queue.activeCount(),
        waiting: queue.waitingCount(),
        concurrency: queue.concurrency
      },
      timestamp: new Date().toISOString()
    })
  }
}

// helper so the queue can update counts
export function getMetrics() {
  return metrics
}