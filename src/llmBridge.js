import express from "express"
import fetch from "node-fetch"
const app = express()
app.use(express.json())

app.post("/api/llm", async (req, res) => {
  const { prompt, model = "llama3-70b" } = req.body
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }]
    })
  })
  const data = await r.json()
  res.json(data)
})

app.listen(8000, () => console.log("Groq bridge on :8000"))