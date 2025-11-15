import { spawn } from "child_process";
import { v4 as uuid } from "uuid";

/**
 * @typedef {Object} ShellSessionOptions
 * @property {string} [shell] - The shell to use (defaults to system shell)
 * @property {string} [cwd] - Working directory for the shell session
 * @property {Object} [env] - Environment variables for the shell session
 */

export class ShellSession {
  /**
   * @param {ShellSessionOptions} options
   */
  constructor(options = {}) {
    this.id = uuid();

    // Determine shell based on platform
    const shell =
      options.shell ??
      (process.platform === "win32" ? "powershell.exe" : "bash");

    // Spawn the shell process
    this.process = spawn(shell, ["-l"], {
      cwd: options.cwd ?? process.cwd(),
      env: { ...process.env, ...options.env },
      shell: false,
    });

    this.isClosed = false;

    // Handle process exit
    this.process.on("exit", () => {
      this.isClosed = true;
      console.log(`Shell session ${this.id} exited`);
    });

    // Handle process errors
    this.process.on("error", (error) => {
      console.error(`Shell session ${this.id} error:`, error);
    });

    console.log(`Created shell session ${this.id} with shell: ${shell}`);
  }

  /**
   * Write a command to the shell's stdin
   * @param {string} line
   */
  write(line) {
    if (!this.isClosed && this.process.stdin && !this.process.stdin.destroyed) {
      try {
        this.process.stdin.write(line + "\n");
        console.log(`Sent command to session ${this.id}: ${line}`);
      } catch (error) {
        console.error(`Error writing to session ${this.id}:`, error);
      }
    } else {
      console.warn(`Cannot write to closed session ${this.id}`);
    }
  }

  /**
   * Subscribe to stdout data
   * @param {(chunk: string) => void} cb
   */
  onStdout(cb) {
    if (this.process.stdout) {
      this.process.stdout.on("data", (data) => {
        const chunk = data.toString();
        console.log(`Session ${this.id} stdout:`, chunk.substring(0, 100) + (chunk.length > 100 ? "..." : ""));
        cb(chunk);
      });
    }
  }

  /**
   * Subscribe to stderr data
   * @param {(chunk: string) => void} cb
   */
  onStderr(cb) {
    if (this.process.stderr) {
      this.process.stderr.on("data", (data) => {
        const chunk = data.toString();
        console.log(`Session ${this.id} stderr:`, chunk.substring(0, 100) + (chunk.length > 100 ? "..." : ""));
        cb(chunk);
      });
    }
  }

  /**
   * Close the shell session
   */
  close() {
    if (!this.isClosed) {
      try {
        this.process.kill();
        this.isClosed = true;
        console.log(`Closed shell session ${this.id}`);
      } catch (error) {
        console.error(`Error closing session ${this.id}:`, error);
      }
    }
  }

  /**
   * Check if the session is still active
   * @returns {boolean}
   */
  isActive() {
    return !this.isClosed;
  }

  /**
   * Get session info
   * @returns {Object}
   */
  getInfo() {
    return {
      id: this.id,
      isClosed: this.isClosed,
      isActive: this.isActive(),
      cwd: this.process.cwd?.() || process.cwd(),
      pid: this.process.pid,
      platform: process.platform
    };
  }
}