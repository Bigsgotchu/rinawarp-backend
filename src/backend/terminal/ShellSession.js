/**
 * =====================================================
 *  Real Shell Session — Direct Integration
 * =====================================================
 * Creates real bash/shell sessions with stdin/stdout
 * =====================================================
 */

import { spawn } from "child_process";
import { v4 as uuidv4 } from "uuid";

/**
 * Real Shell Session - handles actual shell processes
 */
export class ShellSession {
  constructor(options = {}) {
    this.id = uuidv4();
    
    // Determine shell based on platform
    const shell =
      options.shell ??
      (process.platform === "win32" ? "powershell.exe" : "bash");
    
    // Spawn shell process
    this.shell = spawn(shell, ["-i"], {
      stdio: "pipe",
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
      shell: false,
    });
    
    this.isClosed = false;
    
    // Handle process events
    this.shell.on("exit", () => {
      this.isClosed = true;
      console.log(`Shell session ${this.id} exited`);
    });
    
    this.shell.on("error", (error) => {
      console.error(`Shell session ${this.id} error:`, error);
    });
    
    console.log(`Created shell session ${this.id} with ${shell}`);
  }
  
  /**
   * Subscribe to shell output (stdout + stderr)
   */
  onData(callback) {
    this.shell.stdout.on("data", (data) => callback(data.toString()));
    this.shell.stderr.on("data", (data) => callback(data.toString()));
  }
  
  /**
   * Write command to shell
   */
  write(cmd) {
    if (!this.isClosed && this.shell.stdin && !this.shell.stdin.destroyed) {
      try {
        this.shell.stdin.write(cmd + "\n");
        console.log(`Session ${this.id} received command: ${cmd}`);
      } catch (error) {
        console.error(`Error writing to session ${this.id}:`, error);
      }
    }
  }
  
  /**
   * Get session info
   */
  getInfo() {
    return {
      id: this.id,
      isClosed: this.isClosed,
      pid: this.shell.pid,
      cwd: this.shell.cwd?.() || process.cwd(),
      platform: process.platform
    };
  }
  
  /**
   * Kill the shell session
   */
  kill() {
    if (!this.isClosed) {
      try {
        this.shell.kill();
        this.isClosed = true;
        console.log(`Killed shell session ${this.id}`);
      } catch (error) {
        console.error(`Error killing session ${this.id}:`, error);
      }
    }
  }
  
  /**
   * Check if session is still active
   */
  isActive() {
    return !this.isClosed;
  }
}