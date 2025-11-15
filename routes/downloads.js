/**
 * =====================================================
 *  RinaWarp Terminal Pro — Downloads API
 * =====================================================
 * Authenticated file downloads with tier-based access
 * =====================================================
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import logger from './src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Tier-based download permissions
const TIER_PERMISSIONS = {
  'community': {
    platforms: ['linux'],
    files: [
      'RinaWarp Terminal Pro-1.0.0.AppImage',
      'rinawarp-terminal-pro_1.0.0_amd64.deb'
    ]
  },
  'starter': {
    platforms: ['linux', 'windows', 'macos'],
    files: ['*'] // All files
  },
  'creator': {
    platforms: ['linux', 'windows', 'macos'],
    files: ['*']
  },
  'pro': {
    platforms: ['linux', 'windows', 'macos'],
    files: ['*']
  },
  'pioneer': {
    platforms: ['linux', 'windows', 'macos'],
    files: ['*']
  },
  'founder': {
    platforms: ['linux', 'windows', 'macos'],
    files: ['*']
  },
  'enterprise': {
    platforms: ['linux', 'windows', 'macos'],
    files: ['*']
  }
};

// Current release version
const CURRENT_VERSION = '1.0.0';

// CDN base URL (can be overridden by environment variable)
const CDN_BASE = process.env.RINAWARP_CDN_BASE || 'https://cdn.rinawarptech.com/apps/terminal-pro';

// Available downloads catalog
const DOWNLOADS_CATALOG = {
  linux: [
    {
      name: 'RinaWarp-Terminal-Pro-1.0.0.AppImage',
      size: '104 MB',
      type: 'AppImage',
      description: 'Universal Linux package (recommended)',
      tier: 'community'
    },
    {
      name: 'rinawarp-terminal-pro_1.0.0_amd64.deb',
      size: '72 MB',
      type: 'deb',
      description: 'Debian/Ubuntu package',
      tier: 'community'
    }
  ],
  macos: [
    {
      name: 'RinaWarp-Terminal-Pro-1.0.0.dmg',
      size: '89 MB',
      type: 'dmg',
      description: 'macOS Universal (Intel + Apple Silicon)',
      tier: 'starter'
    }
  ],
  windows: [
    {
      name: 'RinaWarp-Terminal-Pro-Setup-1.0.0.exe',
      size: '319 MB',
      type: 'exe',
      description: 'Windows Installer (64-bit)',
      tier: 'starter'
    }
  ]
};

// Optional license verification middleware
const optionalLicenseCheck = async (req, res, next) => {
  const licenseKey = req.headers['x-license-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (licenseKey) {
    try {
      // Verify license (simplified - you can use your existing checkLicense middleware)
      const jwt = await import('jsonwebtoken');
      const publicKeyPath = process.env.LICENSE_SIGNING_PUBLIC_KEY_PATH;
      
      if (publicKeyPath && fs.existsSync(publicKeyPath)) {
        const publicKey = fs.readFileSync(publicKeyPath, 'utf8');
        const decoded = jwt.default.verify(licenseKey, publicKey, { algorithms: ['RS256'] });
        
        req.licenseInfo = {
          email: decoded.sub,
          tier: decoded.tier || 'community',
          valid: true
        };
      }
    } catch (error) {
      logger.warn('DOWNLOADS', `Invalid license provided: ${error.message}`);
      // Don't fail - just treat as community tier
    }
  }
  
  // Default to community tier if no license
  if (!req.licenseInfo) {
    req.licenseInfo = {
      tier: 'community',
      valid: false
    };
  }
  
  next();
};

// GET /api/downloads/catalog - Get available downloads for user's tier
router.get('/catalog', optionalLicenseCheck, async (req, res) => {
  try {
    const userTier = req.licenseInfo?.tier || 'community';
    const permissions = TIER_PERMISSIONS[userTier] || TIER_PERMISSIONS.community;
    
    // Filter catalog based on tier
    const availableDownloads = {};
    
    for (const [platform, files] of Object.entries(DOWNLOADS_CATALOG)) {
      if (permissions.platforms.includes(platform)) {
        availableDownloads[platform] = files.filter(file => {
          // Check if user's tier can access this file
          const tierIndex = Object.keys(TIER_PERMISSIONS).indexOf(userTier);
          const fileTierIndex = Object.keys(TIER_PERMISSIONS).indexOf(file.tier);
          return tierIndex >= fileTierIndex;
        });
      }
    }
    
    logger.info('DOWNLOADS', `Catalog requested by tier: ${userTier}`);
    
    // Convert to format expected by download page (multi-app structure)
    const files = [];
    for (const [platform, platformFiles] of Object.entries(availableDownloads)) {
      for (const file of platformFiles) {
        // Map platforms to CDN folder structure
        let platformPath;
        switch (platform) {
          case 'windows':
            platformPath = 'windows';
            break;
          case 'linux':
            platformPath = file.type === 'AppImage' ? 'linux' : 'linux-deb';
            break;
          case 'macos':
            platformPath = 'mac';
            break;
          default:
            platformPath = platform;
        }
        
        // Generate filename for latest (not versioned)
        let latestFileName;
        if (platform === 'windows') {
          latestFileName = 'RinaWarp-Terminal-Pro-Setup.exe';
        } else if (platform === 'linux' && file.type === 'AppImage') {
          latestFileName = 'RinaWarp-Terminal-Pro.AppImage';
        } else if (platform === 'linux' && file.type === 'deb') {
          latestFileName = 'rinawarp-terminal-pro_amd64.deb';
        } else if (platform === 'macos') {
          latestFileName = 'RinaWarp-Terminal-Pro.dmg';
        } else {
          latestFileName = file.name;
        }
        
        files.push({
          id: `${platform}-${file.type.toLowerCase()}`,
          platform: platform,
          tier: file.tier,
          fileName: file.name,
          url: `${CDN_BASE}/latest/${platformPath}/${latestFileName}`,
          sizeLabel: file.size,
          version: CURRENT_VERSION
        });
      }
    }

    res.json({
      ok: true,
      version: CURRENT_VERSION,
      tier: userTier,
      licensed: req.licenseInfo?.valid || false,
      files: files,
      downloads: availableDownloads
    });
  } catch (error) {
    logger.error('DOWNLOADS', `Catalog error: ${error.message}`);
    res.status(500).json({
      ok: false,
      error: 'Failed to get downloads catalog'
    });
  }
});

// GET /api/downloads/:platform/:filename - Download file
router.get('/:platform/:filename', optionalLicenseCheck, async (req, res) => {
  try {
    const { platform, filename } = req.params;
    const userTier = req.licenseInfo?.tier || 'community';
    const permissions = TIER_PERMISSIONS[userTier] || TIER_PERMISSIONS.community;
    
    // Verify platform access
    if (!permissions.platforms.includes(platform)) {
      logger.warn('DOWNLOADS', `Tier ${userTier} attempted to access ${platform}`);
      return res.status(403).json({
        ok: false,
        error: `Your ${userTier} tier does not have access to ${platform} downloads`,
        upgrade: 'Please upgrade to Starter tier or higher'
      });
    }
    
    // Verify file exists in catalog
    const platformFiles = DOWNLOADS_CATALOG[platform] || [];
    const fileInfo = platformFiles.find(f => f.name === filename);
    
    if (!fileInfo) {
      return res.status(404).json({
        ok: false,
        error: 'File not found'
      });
    }
    
    // Check if file is coming soon
    if (fileInfo.comingSoon) {
      return res.status(503).json({
        ok: false,
        error: 'This download is coming soon',
        platform: platform
      });
    }
    
    // Check tier requirement
    const tierIndex = Object.keys(TIER_PERMISSIONS).indexOf(userTier);
    const requiredTierIndex = Object.keys(TIER_PERMISSIONS).indexOf(fileInfo.tier);
    
    if (tierIndex < requiredTierIndex) {
      return res.status(403).json({
        ok: false,
        error: `This download requires ${fileInfo.tier} tier or higher`,
        currentTier: userTier,
        requiredTier: fileInfo.tier
      });
    }
    
    // Return CDN redirect instead of serving local file (multi-app structure)
    let platformPath;
    let latestFileName = filename;
    
    // Map platforms to CDN folder structure
    switch (platform) {
      case 'windows':
        platformPath = 'windows';
        if (filename.includes('Setup')) {
          latestFileName = 'RinaWarp-Terminal-Pro-Setup.exe';
        }
        break;
      case 'linux':
        platformPath = filename.includes('AppImage') ? 'linux' : 'linux-deb';
        if (filename.includes('AppImage')) {
          latestFileName = 'RinaWarp-Terminal-Pro.AppImage';
        } else {
          latestFileName = 'rinawarp-terminal-pro_amd64.deb';
        }
        break;
      case 'macos':
        platformPath = 'mac';
        latestFileName = 'RinaWarp-Terminal-Pro.dmg';
        break;
      default:
        platformPath = platform;
    }
    
    const cdnUrl = `${CDN_BASE}/latest/${platformPath}/${latestFileName}`;
    
    logger.info('DOWNLOADS', `Redirecting to CDN: ${userTier} tier downloading: ${platform}/${filename} -> ${cdnUrl}`);
    logDownload(req.licenseInfo?.email || 'anonymous', userTier, platform, filename);
    
    // Redirect to CDN for download
    res.redirect(302, cdnUrl);
    
  } catch (error) {
    logger.error('DOWNLOADS', `Download error: ${error.message}`);
    res.status(500).json({
      ok: false,
      error: 'Download failed'
    });
  }
});

// GET /api/downloads/verify/:platform/:filename - Verify download access without downloading
router.get('/verify/:platform/:filename', optionalLicenseCheck, async (req, res) => {
  try {
    const { platform, filename } = req.params;
    const userTier = req.licenseInfo?.tier || 'community';
    const permissions = TIER_PERMISSIONS[userTier] || TIER_PERMISSIONS.community;
    
    const hasAccess = permissions.platforms.includes(platform);
    const fileInfo = DOWNLOADS_CATALOG[platform]?.find(f => f.name === filename);
    
    res.json({
      ok: true,
      hasAccess: hasAccess,
      tier: userTier,
      file: fileInfo || null,
      message: hasAccess ? 'Access granted' : 'Upgrade required'
    });
  } catch (error) {
    logger.error('DOWNLOADS', `Verify error: ${error.message}`);
    res.status(500).json({
      ok: false,
      error: 'Verification failed'
    });
  }
});

// Download tracking/logging
function logDownload(email, tier, platform, filename) {
  const downloadLog = {
    timestamp: new Date().toISOString(),
    email: email,
    tier: tier,
    platform: platform,
    filename: filename
  };
  
  // Log to console (in production, save to database)
  logger.info('DOWNLOADS', `📥 Download: ${JSON.stringify(downloadLog)}`);
  
  // TODO: Save to database for analytics
  // await db.downloads.create(downloadLog);
}

export default router;
