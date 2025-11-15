// Very simple async task queue with concurrency control
export function createQueue({ concurrency = 1, timeoutMs = 120000 }) {
  let active = 0
  const waiting = []

  async function runTask(task) {
    active++
    try {
      const result = await Promise.race([
        task(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Task timeout")), timeoutMs)
        )
      ])
      return result
    } finally {
      active--
      if (waiting.length > 0) {
        const next = waiting.shift()
        next()
      }
    }
  }

  const enqueue = async function enqueue(task) {
    if (active >= concurrency) {
      await new Promise((resolve) => waiting.push(resolve))
    }
    return runTask(task)
  }

  // Add counter methods
  enqueue.activeCount = () => active
  enqueue.waitingCount = () => waiting.length
  enqueue.concurrency = concurrency
  return enqueue
}