import express from "express"
import fetch from "node-fetch"
import { publicLimiter, llmQueue } from "./middleware/rateLimiter.js"
import { collectMetrics, adminStatus } from "./middleware/metrics.js"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(express.json({ limit: "2mb" }))

// Apply limiter only for non-authenticated requests
app.use((req, res, next) => {
  const token = req.headers["x-rinawarp-key"]
  if (!token || token !== process.env.RINAWARP_PRIVATE_KEY) {
    publicLimiter(req, res, next)
  } else next()
})

// Metrics collection
app.use(collectMetrics({ queue: llmQueue }))

// Admin status endpoint
app.get("/admin/status", adminStatus({ queue: llmQueue }))

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434"
const GROQ_API_KEY = process.env.GROQ_API_KEY
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

// --- Utility: stream text chunks to client ---
async function streamToClient(res, reader) {
  const encoder = new TextEncoder()
  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache")
  res.setHeader("Connection", "keep-alive")

  for await (const chunk of reader) {
    res.write(`data: ${chunk}\n\n`)
  }
  res.write("data: [DONE]\n\n")
  res.end()
}

// --- Streaming from Ollama ---
async function streamOllama(model, prompt, res) {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: true
      })
    })

    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`)
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    })

    const decoder = new TextDecoder()
    for await (const chunk of response.body) {
      const text = decoder.decode(chunk)
      // each line is a small JSON block or plain text
      const lines = text.split("\n").filter(Boolean)
      for (const line of lines) {
        if (line.trim() === "data: [DONE]") continue
        try {
          const json = JSON.parse(line)
          if (json.response) res.write(`data: ${json.response}\n\n`)
        } catch {
          res.write(`data: ${line}\n\n`)
        }
      }
    }

    res.write("data: [DONE]\n\n")
    res.end()
    console.log("✅ Ollama stream completed")
  } catch (err) {
    console.warn("⚠️ Ollama stream failed:", err.message)
    return false
  }
  return true
}

// --- Streaming from Groq ---
async function streamGroq(model, prompt, res) {
  if (!GROQ_API_KEY) {
    res.status(500).json({ error: "Missing GROQ_API_KEY" })
    return
  }
  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      stream: true
    })
  })

  if (!response.ok) {
    res.status(response.status).json({ error: "Groq streaming error" })
    return
  }

  const decoder = new TextDecoder()
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  })

  for await (const chunk of response.body) {
    const text = decoder.decode(chunk)
    const lines = text.split("\n").filter((line) => line.startsWith("data: "))
    for (const line of lines) {
      const data = line.replace(/^data:\s*/, "")
      if (data === "[DONE]") {
        res.write("data: [DONE]\n\n")
        res.end()
        return
      }
      try {
        const parsed = JSON.parse(data)
        const content = parsed.choices?.[0]?.delta?.content
        if (content) res.write(`data: ${content}\n\n`)
      } catch {
        /* ignore */
      }
    }
  }
}

// --- Route ---
app.post("/api/llm/stream", async (req, res) => {
  const { prompt, model = "llama3" } = req.body
  console.log(`💬 New stream: ${prompt.slice(0, 60)}...`)

  await llmQueue(async () => {
    // Try Ollama first
    const success = await streamOllama(model, prompt, res)
    if (!success) await streamGroq(model, prompt, res)
  })
})

// --- Serve static files ---
app.use(express.static(path.join(__dirname, "../../public")))

// --- Start server ---
const PORT = process.env.PORT || 8000
app.listen(PORT, () =>
  console.log(`🌊 Streaming LLM Router running on http://localhost:${PORT}`)
)