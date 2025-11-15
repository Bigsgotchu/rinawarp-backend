import rateLimit from "express-rate-limit"
import { createQueue } from "./taskQueue.js"

// Simple in-memory limiter for unauthenticated/public requests
export const publicLimiter = rateLimit({
  windowMs: 60 * 1000,          // 1-minute window
  max: 5,                       // 5 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests — please wait a bit and try again."
  }
})

// Lightweight task queue to prevent GPU overload
export const llmQueue = createQueue({
  concurrency: 1,               // only 1 LLM job at a time
  timeoutMs: 120000             // auto-timeout after 2 min
})