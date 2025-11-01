import fs from "fs";
import path from "path";
import chalk from "chalk";

// ───────────────────────────────
//   CONFIGURATION
// ───────────────────────────────
const LOG_DIR = path.resolve(process.cwd(), "../logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const LOG_FILE = path.join(
  LOG_DIR,
  `app-${new Date().toISOString().split("T")[0]}.log`
);

// ───────────────────────────────
//   RINA MOOD ENGINE
// ───────────────────────────────
let currentMood = {
  name: "calm",
  color: "blue",
  emoji: "🌙",
  energy: 0.4,
  tone: "soft, measured",
};

const MOODS = {
  calm: { color: "blue", emoji: "🌙", energy: 0.3, tone: "soft, measured" },
  focused: { color: "cyan", emoji: "💡", energy: 0.6, tone: "analytical" },
  flirty: { color: "magenta", emoji: "💋", energy: 0.8, tone: "playful" },
  chaotic: { color: "red", emoji: "🔥", energy: 1.0, tone: "intense, reactive" },
  dreamy: { color: "pink", emoji: "💫", energy: 0.5, tone: "curious, poetic" },
};

// Mood setter with smooth transitions
function setMood(mood) {
  if (!MOODS[mood]) return;
  currentMood = MOODS[mood];
  info("RINA", `Mood changed to ${mood} ${currentMood.emoji}`);
}

// ───────────────────────────────
//   BASE LOGGING FUNCTIONS
// ───────────────────────────────
function format(level, tag, message) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] [${tag}] ${message}`;
}

function writeToFile(entry) {
  fs.appendFileSync(LOG_FILE, entry + "\n");
}

function print(level, tag, message, colorFunc) {
  const entry = format(level, tag, message);
  writeToFile(entry);
  console.log(colorFunc(entry));
}

// ───────────────────────────────
//   LOGGER INTERFACE
// ───────────────────────────────
function info(tag, msg) {
  print("info", tag, msg, chalk.cyan);
}
function success(tag, msg) {
  print("success", tag, msg, chalk.green);
}
function warn(tag, msg) {
  print("warn", tag, msg, chalk.yellow);
}
function error(tag, msg) {
  print("error", tag, msg, chalk.red);
}
function debug(tag, msg) {
  print("debug", tag, msg, chalk.magenta);
}

// Personality-driven wrapper
function rinaSpeak(text) {
  const c = chalk[currentMood.color] || chalk.white;
  const prefix = `${currentMood.emoji} [${currentMood.name.toUpperCase()} RINA]: `;
  const entry = `${prefix}${text}`;
  writeToFile(entry);
  console.log(c(entry));
}

// ───────────────────────────────
//   EXPORTS
// ───────────────────────────────
const logger = {
  info,
  success,
  warn,
  error,
  debug,
  setMood,
  mood: () => currentMood,
  rina: rinaSpeak,
};

export default logger;
