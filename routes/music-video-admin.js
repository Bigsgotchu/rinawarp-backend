/**
 * =====================================================
 *  AI Music Video Creator — Admin Routes
 * =====================================================
 * Admin endpoints for creating music videos, avatars, and demos
 * =====================================================
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = '../data/music-video';
    
    // Create directories if they don't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    const subDir = file.fieldname === 'avatar_image' || file.fieldname === 'avatar_video' 
      ? 'avatars' 
      : file.fieldname === 'music'
      ? 'music'
      : 'temp';
    
    const fullPath = path.join(uploadPath, subDir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
    
    cb(null, fullPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = {
      avatar_image: ['image/jpeg', 'image/png', 'image/webp'],
      avatar_video: ['video/mp4', 'video/mov', 'video/avi'],
      music: ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg']
    };
    
    if (allowedTypes[file.fieldname]?.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type for ${file.fieldname}`), false);
    }
  }
});

// Middleware to check admin access
const checkAdmin = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({
      ok: false,
      error: 'Admin access required'
    });
  }
  next();
};

// Apply admin check to all routes
router.use(checkAdmin);

// ==================== AVATAR MANAGEMENT ====================

/**
 * Create new avatar from photo or video
 */
router.post('/avatars/create', upload.fields([
  { name: 'avatar_image', maxCount: 10 },
  { name: 'avatar_video', maxCount: 1 }
]), async (req, res) => {
  try {
    const { name, description, type = 'photo' } = req.body;
    
    if (!name) {
      return res.status(400).json({
        ok: false,
        error: 'Avatar name is required'
      });
    }
    
    if (!req.files.avatar_image && !req.files.avatar_video) {
      return res.status(400).json({
        ok: false,
        error: 'At least one file (image or video) is required'
      });
    }
    
    // Create avatar record
    const avatar = {
      id: `avatar_${Date.now()}`,
      name,
      description: description || '',
      type, // 'photo' or 'video'
      files: {
        images: req.files.avatar_image || [],
        video: req.files.avatar_video?.[0] || null
      },
      status: 'processing',
      createdAt: new Date().toISOString(),
      createdBy: 'admin'
    };
    
    // Save avatar metadata
    const avatarsPath = '../data/music-video/avatars';
    if (!fs.existsSync(avatarsPath)) {
      fs.mkdirSync(avatarsPath, { recursive: true });
    }
    
    const avatarFile = path.join(avatarsPath, `${avatar.id}.json`);
    fs.writeFileSync(avatarFile, JSON.stringify(avatar, null, 2));
    
    // Simulate AI processing (replace with actual AI service)
    setTimeout(() => {
      try {
        avatar.status = 'ready';
        fs.writeFileSync(avatarFile, JSON.stringify(avatar, null, 2));
        logger.success('AVATAR', `Avatar ${name} is now ready`);
      } catch (err) {
        logger.error('AVATAR', `Failed to update avatar status: ${err.message}`);
      }
    }, 5000); // 5 second processing time
    
    res.json({
      ok: true,
      data: avatar,
      message: 'Avatar created successfully. Processing will complete in 5 seconds.'
    });
    
  } catch (error) {
    logger.error('AVATAR_CREATE', error.message);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/**
 * Get all avatars
 */
router.get('/avatars', (req, res) => {
  try {
    const avatarsPath = '../data/music-video/avatars';
    const avatars = [];
    
    if (fs.existsSync(avatarsPath)) {
      const files = fs.readdirSync(avatarsPath).filter(f => f.endsWith('.json'));
      
      for (const file of files) {
        const avatarData = JSON.parse(fs.readFileSync(path.join(avatarsPath, file), 'utf8'));
        avatars.push(avatarData);
      }
    }
    
    res.json({
      ok: true,
      data: avatars
    });
    
  } catch (error) {
    logger.error('AVATAR_LIST', error.message);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/**
 * Get specific avatar
 */
router.get('/avatars/:id', (req, res) => {
  try {
    const avatarId = req.params.id;
    const avatarFile = path.join('../data/music-video/avatars', `${avatarId}.json`);
    
    if (!fs.existsSync(avatarFile)) {
      return res.status(404).json({
        ok: false,
        error: 'Avatar not found'
      });
    }
    
    const avatar = JSON.parse(fs.readFileSync(avatarFile, 'utf8'));
    res.json({
      ok: true,
      data: avatar
    });
    
  } catch (error) {
    logger.error('AVATAR_GET', error.message);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// ==================== MUSIC MANAGEMENT ====================

/**
 * Upload music file
 */
router.post('/music/upload', upload.single('music'), (req, res) => {
  try {
    const { title, artist = 'Rina Vex', description = '' } = req.body;
    
    if (!title) {
      return res.status(400).json({
        ok: false,
        error: 'Music title is required'
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: 'Music file is required'
      });
    }
    
    const music = {
      id: `music_${Date.now()}`,
      title,
      artist,
      description,
      filePath: req.file.path,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      fileSize: req.file.size,
      duration: null, // Will be detected by audio processing
      createdAt: new Date().toISOString(),
      isRinaVex: artist.toLowerCase() === 'rina vex'
    };
    
    // Save music metadata
    const musicPath = '../data/music-video/music';
    if (!fs.existsSync(musicPath)) {
      fs.mkdirSync(musicPath, { recursive: true });
    }
    
    const musicFile = path.join(musicPath, `${music.id}.json`);
    fs.writeFileSync(musicFile, JSON.stringify(music, null, 2));
    
    res.json({
      ok: true,
      data: music,
      message: 'Music uploaded successfully'
    });
    
  } catch (error) {
    logger.error('MUSIC_UPLOAD', error.message);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/**
 * Get all music
 */
router.get('/music', (req, res) => {
  try {
    const musicPath = '../data/music-video/music';
    const music = [];
    
    if (fs.existsSync(musicPath)) {
      const files = fs.readdirSync(musicPath).filter(f => f.endsWith('.json'));
      
      for (const file of files) {
        const musicData = JSON.parse(fs.readFileSync(path.join(musicPath, file), 'utf8'));
        music.push(musicData);
      }
    }
    
    // Sort by createdAt (newest first)
    music.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
      ok: true,
      data: music
    });
    
  } catch (error) {
    logger.error('MUSIC_LIST', error.message);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// ==================== VIDEO GENERATION ====================

/**
 * Generate music video
 */
router.post('/generate', async (req, res) => {
  try {
    const { musicId, avatarId, style = 'cinematic', title, customPrompt = '' } = req.body;
    
    if (!musicId || !avatarId) {
      return res.status(400).json({
        ok: false,
        error: 'Music ID and Avatar ID are required'
      });
    }
    
    // Get music and avatar data
    const musicFile = path.join('../data/music-video/music', `${musicId}.json`);
    const avatarFile = path.join('../data/music-video/avatars', `${avatarId}.json`);
    
    if (!fs.existsSync(musicFile) || !fs.existsSync(avatarFile)) {
      return res.status(404).json({
        ok: false,
        error: 'Music or Avatar not found'
      });
    }
    
    const music = JSON.parse(fs.readFileSync(musicFile, 'utf8'));
    const avatar = JSON.parse(fs.readFileSync(avatarFile, 'utf8'));
    
    // Create video generation job
    const video = {
      id: `video_${Date.now()}`,
      title: title || `${music.title} - ${avatar.name}`,
      musicId,
      avatarId,
      style,
      customPrompt,
      status: 'processing',
      progress: 0,
      createdAt: new Date().toISOString(),
      estimatedDuration: music.duration || 180, // 3 minutes default
      outputPath: null,
      thumbnailPath: null,
      metadata: {
        musicTitle: music.title,
        musicArtist: music.artist,
        avatarName: avatar.name,
        avatarType: avatar.type,
        generatedBy: 'admin'
      }
    };
    
    // Save video job
    const videosPath = '../data/music-video/videos';
    if (!fs.existsSync(videosPath)) {
      fs.mkdirSync(videosPath, { recursive: true });
    }
    
    const videoFile = path.join(videosPath, `${video.id}.json`);
    fs.writeFileSync(videoFile, JSON.stringify(video, null, 2));
    
    // Simulate video generation process
    const generateVideo = async () => {
      try {
        for (let i = 0; i <= 100; i += 10) {
          video.progress = i;
          video.status = i === 100 ? 'completed' : 'processing';
          fs.writeFileSync(videoFile, JSON.stringify(video, null, 2));
          
          if (i < 100) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second per 10%
          }
        }
        
        // Mark as completed
        video.status = 'completed';
        video.progress = 100;
        video.outputPath = path.join(videosPath, `${video.id}.mp4`);
        video.thumbnailPath = path.join(videosPath, `${video.id}_thumb.jpg`);
        fs.writeFileSync(videoFile, JSON.stringify(video, null, 2));
        
        logger.success('VIDEO', `Video generation completed: ${video.title}`);
        
      } catch (error) {
        video.status = 'failed';
        video.error = error.message;
        fs.writeFileSync(videoFile, JSON.stringify(video, null, 2));
        logger.error('VIDEO', `Video generation failed: ${error.message}`);
      }
    };
    
    // Start generation process
    generateVideo();
    
    res.json({
      ok: true,
      data: video,
      message: 'Video generation started. Check status for progress.'
    });
    
  } catch (error) {
    logger.error('VIDEO_GENERATE', error.message);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/**
 * Get video generation status
 */
router.get('/generate/:id', (req, res) => {
  try {
    const videoId = req.params.id;
    const videoFile = path.join('../data/music-video/videos', `${videoId}.json`);
    
    if (!fs.existsSync(videoFile)) {
      return res.status(404).json({
        ok: false,
        error: 'Video not found'
      });
    }
    
    const video = JSON.parse(fs.readFileSync(videoFile, 'utf8'));
    res.json({
      ok: true,
      data: video
    });
    
  } catch (error) {
    logger.error('VIDEO_STATUS', error.message);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/**
 * List all videos
 */
router.get('/videos', (req, res) => {
  try {
    const videosPath = '../data/music-video/videos';
    const videos = [];
    
    if (fs.existsSync(videosPath)) {
      const files = fs.readdirSync(videosPath).filter(f => f.endsWith('.json'));
      
      for (const file of files) {
        const videoData = JSON.parse(fs.readFileSync(path.join(videosPath, file), 'utf8'));
        videos.push(videoData);
      }
    }
    
    // Sort by createdAt (newest first)
    videos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
      ok: true,
      data: videos
    });
    
  } catch (error) {
    logger.error('VIDEO_LIST', error.message);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// ==================== DEMO MANAGEMENT ====================

/**
 * Create demo video using Rina Vex music and quick avatar
 */
router.post('/demo/create', async (req, res) => {
  try {
    const { musicId, demoName, useRinaVex = true } = req.body;
    
    // Get Rina Vex music if specified
    let music;
    if (useRinaVex) {
      const musicList = JSON.parse(fs.readFileSync(path.join('../data/music-video/music', 'music_list.json'), 'utf8') || '[]');
      music = musicList.find(m => m.isRinaVex);
      if (!music) {
        return res.status(404).json({
          ok: false,
          error: 'No Rina Vex music found. Please upload Rina Vex tracks first.'
        });
      }
    } else if (musicId) {
      const musicFile = path.join('../data/music-video/music', `${musicId}.json`);
      if (!fs.existsSync(musicFile)) {
        return res.status(404).json({
          ok: false,
          error: 'Music not found'
        });
      }
      music = JSON.parse(fs.readFileSync(musicFile, 'utf8'));
    } else {
      return res.status(400).json({
        ok: false,
        error: 'Music ID is required when not using Rina Vex'
      });
    }
    
    // Get or create a default avatar
    let avatar;
    const avatars = fs.readdirSync('../data/music-video/avatars').filter(f => f.endsWith('.json'));
    if (avatars.length > 0) {
      const avatarData = JSON.parse(fs.readFileSync(path.join('../data/music-video/avatars', avatars[0]), 'utf8'));
      avatar = avatarData;
    } else {
      // Create a default demo avatar
      avatar = {
        id: `default_avatar_${Date.now()}`,
        name: 'Demo Avatar',
        description: 'Default avatar for demos',
        type: 'photo',
        status: 'ready',
        createdAt: new Date().toISOString(),
        files: {
          images: [],
          video: null
        }
      };
    }
    
    // Create demo video
    const demoVideo = {
      id: `demo_${Date.now()}`,
      title: demoName || `Demo: ${music.title}`,
      musicId: music.id,
      avatarId: avatar.id,
      style: 'demo',
      customPrompt: 'Create a dynamic, engaging music video with smooth transitions',
      status: 'processing',
      progress: 0,
      createdAt: new Date().toISOString(),
      isDemo: true,
      metadata: {
        musicTitle: music.title,
        musicArtist: music.artist,
        avatarName: avatar.name,
        generatedBy: 'admin',
        demoType: 'rina_vex'
      }
    };
    
    // Save demo video
    const videosPath = '../data/music-video/videos';
    if (!fs.existsSync(videosPath)) {
      fs.mkdirSync(videosPath, { recursive: true });
    }
    
    const videoFile = path.join(videosPath, `${demoVideo.id}.json`);
    fs.writeFileSync(videoFile, JSON.stringify(demoVideo, null, 2));
    
    // Simulate quick demo generation
    const generateDemo = async () => {
      try {
        for (let i = 0; i <= 100; i += 20) {
          demoVideo.progress = i;
          demoVideo.status = i === 100 ? 'completed' : 'processing';
          fs.writeFileSync(videoFile, JSON.stringify(demoVideo, null, 2));
          
          if (i < 100) {
            await new Promise(resolve => setTimeout(resolve, 500)); // Faster for demos
          }
        }
        
        demoVideo.status = 'completed';
        demoVideo.progress = 100;
        demoVideo.outputPath = path.join(videosPath, `${demoVideo.id}.mp4`);
        fs.writeFileSync(videoFile, JSON.stringify(demoVideo, null, 2));
        
        logger.success('DEMO', `Demo video created: ${demoVideo.title}`);
        
      } catch (error) {
        demoVideo.status = 'failed';
        demoVideo.error = error.message;
        fs.writeFileSync(videoFile, JSON.stringify(demoVideo, null, 2));
      }
    };
    
    generateDemo();
    
    res.json({
      ok: true,
      data: demoVideo,
      message: 'Demo video creation started with Rina Vex music!'
    });
    
  } catch (error) {
    logger.error('DEMO_CREATE', error.message);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

export default router;