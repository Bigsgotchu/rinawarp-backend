/**
 * =====================================================
 *  RinaWarp Terminal Pro — CLI Execution Routes
 * =====================================================
 * Secure command execution with license validation
 * =====================================================
 */

import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { requireValidLicense } from './middleware/license-mw.js';
import { testLicenseBypass } from './middleware/test-license-bypass.js';
import logger from './src/utils/logger.js';

// Chain middlewares: test bypass first (only in dev), then license check
const licenseMiddleware = process.env.NODE_ENV === 'development'
  ? [testLicenseBypass, requireValidLicense]
  : requireValidLicense;

const router = express.Router();
const execAsync = promisify(exec);

// Command execution timeout (30 seconds)
const EXEC_TIMEOUT = 30000;

// Dangerous commands blacklist
const DANGEROUS_COMMANDS = [
  'rm -rf',
  'mkfs',
  'dd if=',
  ':(){:|:&};:',  // fork bomb
  'chmod -R 777',
  'chown -R',
  '> /dev/sda',
  'mv /* /dev/null',
  'wget http',
  'curl http',
  'nc -l',
  'ncat -l',
];

// Command whitelist patterns (optional - for stricter security)
const SAFE_COMMAND_PATTERNS = [
  /^ls(\s|$)/,
  /^pwd(\s|$)/,
  /^echo(\s|$)/,
  /^cat(\s|$)/,
  /^grep(\s|$)/,
  /^find(\s|$)/,
  /^which(\s|$)/,
  /^whoami(\s|$)/,
  /^date(\s|$)/,
  /^uname(\s|$)/,
  /^df(\s|$)/,
  /^du(\s|$)/,
  /^ps(\s|$)/,
  /^top(\s|$)/,
  /^htop(\s|$)/,
  /^free(\s|$)/,
  /^uptime(\s|$)/,
  /^git(\s|$)/,
  /^npm(\s|$)/,
  /^node(\s|$)/,
  /^python(\s|$)/,
  /^pip(\s|$)/,
];

/**
 * Sanitize and validate command
 */
function validateCommand(command) {
  if (!command || typeof command !== 'string') {
    return { valid: false, reason: 'Command must be a non-empty string' };
  }

  const trimmedCommand = command.trim();

  // Check for dangerous commands
  for (const dangerous of DANGEROUS_COMMANDS) {
    if (trimmedCommand.includes(dangerous)) {
      return { 
        valid: false, 
        reason: `Dangerous command detected: ${dangerous}` 
      };
    }
  }

  // Check for command injection attempts
  const injectionPatterns = [
    /;.*rm/,
    /\|.*rm/,
    /&&.*rm/,
    /`.*`/,
    /\$\(/,
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(trimmedCommand)) {
      return { 
        valid: false, 
        reason: 'Potential command injection detected' 
      };
    }
  }

  // Optional: Check against whitelist (commented out for flexibility)
  // const isWhitelisted = SAFE_COMMAND_PATTERNS.some(pattern => 
  //   pattern.test(trimmedCommand)
  // );
  // if (!isWhitelisted) {
  //   return { 
  //     valid: false, 
  //     reason: 'Command not in whitelist' 
  //   };
  // }

  return { valid: true };
}

/**
 * POST /api/cli/execute
 * Execute a CLI command securely
 */
router.post('/execute', licenseMiddleware, async (req, res) => {
  try {
    const { command, cwd } = req.body;

    if (!command) {
      logger.warn('CLI', 'Execute attempted without command');
      return res.status(400).json({
        ok: false,
        error: 'Command is required'
      });
    }

    // Validate command
    const validation = validateCommand(command);
    if (!validation.valid) {
      logger.warn('CLI', `Invalid command rejected: ${command}`);
      return res.status(400).json({
        ok: false,
        error: 'INVALID_COMMAND',
        reason: validation.reason
      });
    }

    logger.info('CLI', `Executing command from ${req.user?.email}: ${command}`);

    // Execute command with timeout
    const options = {
      timeout: EXEC_TIMEOUT,
      maxBuffer: 1024 * 1024, // 1MB buffer
      shell: '/bin/bash',
      env: { ...process.env, TERM: 'xterm-256color' }
    };

    if (cwd) {
      options.cwd = cwd;
    }

    try {
      const { stdout, stderr } = await execAsync(command, options);
      
      logger.info('CLI', `Command executed successfully: ${command}`);
      
      res.json({
        ok: true,
        command,
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: 0,
        timestamp: new Date().toISOString()
      });
    } catch (execError) {
      // Command executed but returned non-zero exit code
      logger.warn('CLI', `Command failed: ${command} - ${execError.message}`);
      
      res.json({
        ok: false,
        command,
        stdout: execError.stdout || '',
        stderr: execError.stderr || execError.message,
        exitCode: execError.code || 1,
        error: 'COMMAND_FAILED',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('CLI', `Execute error: ${error.message}`);
    res.status(500).json({
      ok: false,
      error: 'EXECUTION_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/cli/status
 * Get CLI service status
 */
router.get('/status', licenseMiddleware, (req, res) => {
  logger.info('CLI', 'Status check requested');
  
  res.json({
    ok: true,
    status: 'operational',
    shell: process.env.SHELL || '/bin/bash',
    platform: process.platform,
    timeout: EXEC_TIMEOUT,
    timestamp: new Date().toISOString()
  });
});

export default router;
