// Feedback management system - ES6 Module
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Feedback storage file
const FEEDBACK_FILE = path.join(__dirname, 'feedback.json');

// Initialize feedback file if it doesn't exist
async function initializeFeedbackFile() {
  try {
    await fs.access(FEEDBACK_FILE);
  } catch (error) {
    // File doesn't exist, create it with empty array
    await fs.writeFile(FEEDBACK_FILE, JSON.stringify([], null, 2));
  }
}

// Load feedback from file
async function loadFeedback() {
  try {
    const data = await fs.readFile(FEEDBACK_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading feedback:', error);
    return [];
  }
}

// Save feedback to file
async function saveFeedback(feedback) {
  try {
    await fs.writeFile(FEEDBACK_FILE, JSON.stringify(feedback, null, 2));
  } catch (error) {
    console.error('Error saving feedback:', error);
    throw error;
  }
}

// Add new feedback
export async function addFeedback(feedbackData) {
  await initializeFeedbackFile();

  const feedback = await loadFeedback();

  const newFeedback = {
    id: Date.now().toString(),
    name: feedbackData.name,
    email: feedbackData.email,
    category: feedbackData.category || 'general',
    feedback: feedbackData.feedback || feedbackData.message,
    allowPublic: feedbackData.allowPublic !== false, // Default true
    date: new Date().toISOString(),
    verified: false, // Will be manually verified
    rating: parseInt(feedbackData.rating) || 5
  };

  feedback.push(newFeedback);
  await saveFeedback(feedback);

  return newFeedback;
}

// Get public feedback (for testimonials)
export async function getPublicFeedback() {
  const feedback = await loadFeedback();
  return feedback.filter((f) => f.allowPublic && f.verified);
}

// Get all feedback (admin)
export async function getAllFeedback() {
  return await loadFeedback();
}

// Verify feedback (admin)
export async function verifyFeedback(feedbackId) {
  const feedback = await loadFeedback();
  const index = feedback.findIndex((f) => f.id === feedbackId);

  if (index !== -1) {
    feedback[index].verified = true;
    await saveFeedback(feedback);
    return feedback[index];
  }

  throw new Error('Feedback not found');
}

// Delete feedback (admin)
export async function deleteFeedback(feedbackId) {
  const feedback = await loadFeedback();
  const filteredFeedback = feedback.filter((f) => f.id !== feedbackId);

  if (filteredFeedback.length !== feedback.length) {
    await saveFeedback(filteredFeedback);
    return true;
  }

  return false;
}
