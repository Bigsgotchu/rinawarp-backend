// Feedback API Routes - ES6 Module
import express from 'express';
import { addFeedback, getPublicFeedback, getAllFeedback } from '../src/feedback.js';

const router = express.Router();

// POST /api/feedback - Submit new feedback
router.post('/', async (req, res) => {
  try {
    const { name, email, category, message } = req.body;

    if (!name || !email || !category || !message) {
      return res.status(400).json({
        ok: false,
        error: 'All fields are required: name, email, category, message'
      });
    }

    const feedbackData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      category: category,
      feedback: message.trim(),
      allowPublic: true, // Allow for testimonials
      rating: 5 // Default rating for now
    };

    const result = await addFeedback(feedbackData);

    res.json({
      ok: true,
      message: 'Feedback submitted successfully!',
      data: {
        id: result.id,
        name: result.name,
        timestamp: result.date
      }
    });

  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to submit feedback'
    });
  }
});

// GET /api/feedback/public - Get public feedback for testimonials
router.get('/public', async (req, res) => {
  try {
    const feedback = await getPublicFeedback();
    
    res.json({
      ok: true,
      data: feedback.map(f => ({
        id: f.id,
        name: f.name,
        feedback: f.feedback,
        category: f.category,
        date: f.date,
        rating: f.rating
      }))
    });
  } catch (error) {
    console.error('Error fetching public feedback:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch feedback'
    });
  }
});

// GET /api/feedback/all - Get all feedback (admin only)
router.get('/all', async (req, res) => {
  try {
    const feedback = await getAllFeedback();
    
    res.json({
      ok: true,
      data: feedback
    });
  } catch (error) {
    console.error('Error fetching all feedback:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch feedback'
    });
  }
});

export default router;