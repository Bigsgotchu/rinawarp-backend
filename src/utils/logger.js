/**
 * Logger utility for RinaWarp Backend
 * Provides colored console logging with different levels
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

/**
 * Format timestamp
 */
const timestamp = () => {
  return new Date().toISOString();
};

/**
 * Create a logger instance
 */
class Logger {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  /**
   * Log info message
   */
  info(component, message) {
    if (this.isDevelopment) {
      console.log(
        `${colors.cyan}${timestamp()}${colors.reset} ${colors.blue}[INFO]${colors.reset} ${colors.yellow}[${component}]${colors.reset} ${message}`
      );
    }
  }

  /**
   * Log success message
   */
  success(component, message) {
    console.log(
      `${colors.green}${timestamp()}${colors.reset} ${colors.green}[SUCCESS]${colors.reset} ${colors.yellow}[${component}]${colors.reset} ${colors.green}${message}${colors.reset}`
    );
  }

  /**
   * Log error message
   */
  error(component, message) {
    console.error(
      `${colors.red}${timestamp()}${colors.reset} ${colors.red}[ERROR]${colors.reset} ${colors.yellow}[${component}]${colors.reset} ${colors.red}${message}${colors.reset}`
    );
  }

  /**
   * Log warning message
   */
  warn(component, message) {
    if (this.isDevelopment) {
      console.warn(
        `${colors.yellow}${timestamp()}${colors.reset} ${colors.yellow}[WARN]${colors.reset} ${colors.yellow}[${component}]${colors.reset} ${colors.yellow}${message}${colors.reset}`
      );
    }
  }

  /**
   * Log debug message
   */
  debug(component, message) {
    if (this.isDevelopment && process.env.DEBUG) {
      console.debug(
        `${colors.dim}${timestamp()}${colors.reset} ${colors.dim}[DEBUG]${colors.reset} ${colors.dim}[${component}]${colors.reset} ${colors.dim}${message}${colors.reset}`
      );
    }
  }

  /**
   * Log Rina-specific message with fancy styling
   */
  rina(message) {
    console.log(
      `${colors.magenta}${colors.bright}
   🧜‍♀️ Rina says: ${message}
   ${colors.reset}`
    );
  }

  /**
   * Create a child logger with a specific component
   */
  child(component) {
    return {
      info: (message) => this.info(component, message),
      success: (message) => this.success(component, message),
      error: (message) => this.error(component, message),
      warn: (message) => this.warn(component, message),
      debug: (message) => this.debug(component, message),
      rina: (message) => this.rina(`[${component}] ${message}`)
    };
  }
}

// Create and export default logger instance
const logger = new Logger();
export default logger;
export { Logger };