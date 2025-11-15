import express from "express"
import fetch from "node-fetch"

const app = express()
app.use(express.json({ limit: "2mb" }))

// --- Configuration ---
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434"
const GROQ_API_KEY = process.env.GROQ_API_KEY
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

// --- Helper: Try Ollama ---
async function tryOllama(model, prompt) {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false
      }),
      timeout: 20000
    })
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`)
    const data = await res.json()
    if (!data.response) throw new Error("No response field in Ollama output")
    return { provider: "ollama", content: data.response.trim() }
  } catch (e) {
    console.warn("⚠️ Ollama fallback triggered:", e.message)
    return null
  }
}

// --- Helper: Try Groq ---
async function tryGroq(model, prompt) {
  if (!GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY")
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 512
    }),
    timeout: 20000
  })
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`)
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content?.trim()
  return { provider: "groq", content }
}

// --- Endpoint ---
app.post("/api/llm", async (req, res) => {
  const { prompt, model = "llama3" } = req.body
  if (!prompt) return res.status(400).json({ error: "Missing prompt" })

  // 1️⃣ Try local Ollama
  let response = await tryOllama(model, prompt)

  // 2️⃣ Fallback to Groq if needed
  if (!response) {
    try {
      response = await tryGroq(model, prompt)
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  if (!response)
    return res.status(500).json({ error: "No provider available." })

  res.json({
    provider: response.provider,
    model,
    content: response.content
  })
})

// --- Startup ---
const PORT = process.env.PORT || 8000
app.listen(PORT, () => console.log(`🤖 LLM Router ready on http://localhost:${PORT}`))