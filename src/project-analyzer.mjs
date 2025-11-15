import { readdirSync, statSync, readFileSync, existsSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Project analyzer for workspace scanning and task generation
 */
class ProjectAnalyzer {
  constructor() {
    this.scanResults = {
      projects: [],
      files: [],
      dependencies: [],
      issues: [],
      recommendations: [],
      metadata: {
        scannedAt: new Date().toISOString(),
        workspaceRoot: process.cwd(),
      },
    };
  }

  /**
   * Scan workspace for projects and files
   * @param {string} rootPath - Root path to scan (default: current directory)
   */
  async scanWorkspace(rootPath = process.cwd()) {
    console.log(`Scanning workspace: ${rootPath}`);

    try {
      this.scanResults.metadata.scannedAt = new Date().toISOString();
      this.scanResults.metadata.workspaceRoot = rootPath;

      // Scan for projects (directories with package.json or other indicators)
      await this.scanForProjects(rootPath);

      // Scan for files and analyze them
      await this.scanFiles(rootPath);

      // Analyze dependencies
      await this.analyzeDependencies(rootPath);

      // Generate recommendations
      this.generateRecommendations();

      console.log(
        `Scan complete. Found ${this.scanResults.projects.length} projects, ${this.scanResults.files.length} files`
      );
      return this.scanResults;
    } catch (error) {
      console.error('Error scanning workspace:', error);
      throw error;
    }
  }

  /**
   * Scan for project directories
   */
  async scanForProjects(rootPath) {
    const entries = readdirSync(rootPath, { withFileTypes: true });

    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        entry.name !== 'node_modules'
      ) {
        const projectPath = join(rootPath, entry.name);
        const project = await this.analyzeProject(projectPath);

        if (project) {
          this.scanResults.projects.push(project);
        }
      }
    }
  }

  /**
   * Analyze a single project directory
   */
  async analyzeProject(projectPath) {
    const project = {
      name: null,
      path: projectPath,
      type: 'unknown',
      hasPackageJson: false,
      hasGit: false,
      dependencies: [],
      devDependencies: [],
      scripts: [],
      files: [],
      issues: [],
      score: 0,
    };

    try {
      // Check for package.json
      const packageJsonPath = join(projectPath, 'package.json');
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        project.name = packageJson.name || entry.name;
        project.hasPackageJson = true;
        project.dependencies = Object.keys(packageJson.dependencies || {});
        project.devDependencies = Object.keys(
          packageJson.devDependencies || {}
        );
        project.scripts = Object.keys(packageJson.scripts || {});

        // Determine project type
        if (packageJson.scripts && packageJson.scripts.build) {
          project.type = 'buildable';
        } else if (packageJson.main || packageJson.bin) {
          project.type = 'application';
        } else {
          project.type = 'library';
        }
      }

      // Check for git repository
      project.hasGit = existsSync(join(projectPath, '.git'));

      // Scan project files
      project.files = this.scanProjectFiles(projectPath);

      // Analyze project health
      this.analyzeProjectHealth(project);
    } catch (error) {
      project.issues.push(`Error analyzing project: ${error.message}`);
    }

    return project;
  }

  /**
   * Scan files in a project directory
   */
  scanProjectFiles(projectPath) {
    const files = [];

    try {
      const scanDirectory = (dir, relativePath = '') => {
        const entries = readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;

          const fullPath = join(dir, entry.name);
          const relPath = join(relativePath, entry.name);

          if (
            entry.isDirectory() &&
            entry.name !== 'node_modules' &&
            entry.name !== '.git'
          ) {
            scanDirectory(fullPath, relPath);
          } else if (entry.isFile()) {
            const fileInfo = this.analyzeFile(fullPath, relPath);
            if (fileInfo) {
              files.push(fileInfo);
            }
          }
        }
      };

      scanDirectory(projectPath);
    } catch (error) {
      console.error(`Error scanning files in ${projectPath}:`, error);
    }

    return files;
  }

  /**
   * Analyze a single file
   */
  analyzeFile(filePath, relativePath) {
    try {
      const stats = statSync(filePath);
      const ext = extname(filePath).toLowerCase();

      const fileInfo = {
        path: relativePath,
        extension: ext,
        size: stats.size,
        modified: stats.mtime,
        type: this.getFileType(ext),
        issues: [],
        score: 100,
      };

      // Analyze based on file type
      switch (fileInfo.type) {
      case 'javascript':
      case 'typescript':
        this.analyzeCodeFile(filePath, fileInfo);
        break;
      case 'json':
        this.analyzeJsonFile(filePath, fileInfo);
        break;
      case 'markdown':
        this.analyzeMarkdownFile(filePath, fileInfo);
        break;
      case 'configuration':
        this.analyzeConfigFile(filePath, fileInfo);
        break;
      }

      return fileInfo;
    } catch (error) {
      return {
        path: relativePath,
        error: error.message,
        score: 0,
      };
    }
  }

  /**
   * Get file type based on extension
   */
  getFileType(ext) {
    const typeMap = {
      '.js': 'javascript',
      '.mjs': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.c': 'c',
      '.cpp': 'cpp',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'css',
      '.sass': 'css',
      '.less': 'css',
      '.json': 'json',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.md': 'markdown',
      '.txt': 'text',
      '.sh': 'shell',
      '.bat': 'batch',
      '.ps1': 'powershell',
      '.dockerfile': 'dockerfile',
      '.makefile': 'makefile',
      '.gitignore': 'configuration',
      '.eslintrc': 'configuration',
      '.prettierrc': 'configuration',
      '.editorconfig': 'configuration',
      '.package.json': 'configuration',
      '.tsconfig.json': 'configuration',
      '.webpack.config.js': 'configuration',
      '.vite.config.js': 'configuration',
      '.tailwind.config.js': 'configuration',
    };

    return typeMap[ext] || 'unknown';
  }

  /**
   * Analyze code files for issues
   */
  analyzeCodeFile(filePath, fileInfo) {
    try {
      const content = readFileSync(filePath, 'utf8');

      // Check for common issues
      if (
        content.includes('console.log') &&
        !content.includes('console.error') &&
        !content.includes('console.warn')
      ) {
        fileInfo.issues.push('Consider removing debug console.log statements');
        fileInfo.score -= 10;
      }

      if (
        content.includes('TODO') ||
        content.includes('FIXME') ||
        content.includes('HACK')
      ) {
        fileInfo.issues.push('Contains TODO/FIXME comments');
        fileInfo.score -= 5;
      }

      if (content.includes('var ') && !content.includes('use strict')) {
        fileInfo.issues.push('Uses var instead of let/const');
        fileInfo.score -= 5;
      }

      // Check file size
      if (fileInfo.size > 1000 * 1024) {
        // 1MB
        fileInfo.issues.push('File is very large, consider splitting');
        fileInfo.score -= 10;
      }

      // Check for imports/exports (ESM vs CommonJS)
      if (content.includes('require(') && content.includes('module.exports')) {
        fileInfo.issues.push('Uses CommonJS, consider migrating to ESM');
        fileInfo.score -= 5;
      }
    } catch (error) {
      fileInfo.issues.push(`Error reading file: ${error.message}`);
      fileInfo.score = 0;
    }
  }

  /**
   * Analyze JSON files
   */
  analyzeJsonFile(filePath, fileInfo) {
    try {
      const content = readFileSync(filePath, 'utf8');
      JSON.parse(content); // Validate JSON

      // Check for outdated dependencies in package.json
      if (filePath.endsWith('package.json')) {
        const packageJson = JSON.parse(content);
        this.analyzePackageJson(packageJson, fileInfo);
      }
    } catch (error) {
      fileInfo.issues.push(`Invalid JSON: ${error.message}`);
      fileInfo.score = 0;
    }
  }

  /**
   * Analyze package.json for issues
   */
  analyzePackageJson(packageJson, fileInfo) {
    // Check for missing fields
    const requiredFields = ['name', 'version'];
    for (const field of requiredFields) {
      if (!packageJson[field]) {
        fileInfo.issues.push(`Missing required field: ${field}`);
        fileInfo.score -= 10;
      }
    }

    // Check for outdated scripts
    if (packageJson.scripts) {
      if (
        packageJson.scripts.test === 'echo "Error: no test specified" && exit 1'
      ) {
        fileInfo.issues.push('No test script configured');
        fileInfo.score -= 5;
      }
    }

    // Check for security issues
    if (packageJson.dependencies) {
      const outdatedDeps = this.checkOutdatedDependencies(
        packageJson.dependencies
      );
      if (outdatedDeps.length > 0) {
        fileInfo.issues.push(
          `Potentially outdated dependencies: ${outdatedDeps.join(', ')}`
        );
        fileInfo.score -= 10;
      }
    }
  }

  /**
   * Analyze markdown files
   */
  analyzeMarkdownFile(filePath, fileInfo) {
    try {
      const content = readFileSync(filePath, 'utf8');

      if (content.length < 100) {
        fileInfo.issues.push('Documentation is very short');
        fileInfo.score -= 5;
      }

      if (!content.includes('#')) {
        fileInfo.issues.push('Missing main heading');
        fileInfo.score -= 5;
      }
    } catch (error) {
      fileInfo.issues.push(`Error reading markdown file: ${error.message}`);
    }
  }

  /**
   * Analyze configuration files
   */
  analyzeConfigFile(filePath, fileInfo) {
    // Configuration files should exist and be valid
    if (fileInfo.size === 0) {
      fileInfo.issues.push('Empty configuration file');
      fileInfo.score -= 10;
    }
  }

  /**
   * Analyze project health and calculate score
   */
  analyzeProjectHealth(project) {
    let score = 100;

    // Package.json quality
    if (!project.hasPackageJson) {
      score -= 30;
      project.issues.push('Missing package.json');
    }

    // Git repository
    if (!project.hasGit) {
      score -= 10;
      project.issues.push('No git repository found');
    }

    // Dependencies
    if (project.dependencies.length === 0 && project.type !== 'library') {
      score -= 5;
      project.issues.push('No production dependencies');
    }

    if (project.devDependencies.length === 0) {
      score -= 5;
      project.issues.push('No development dependencies');
    }

    // Scripts
    if (project.scripts.length === 0) {
      score -= 10;
      project.issues.push('No npm scripts defined');
    }

    // File issues
    const fileIssues = project.files.reduce(
      (sum, file) => sum + file.issues.length,
      0
    );
    score -= fileIssues * 2;

    project.score = Math.max(0, score);
  }

  /**
   * Analyze dependencies for the entire workspace
   */
  async analyzeDependencies(rootPath) {
    const allDependencies = new Map();
    const allDevDependencies = new Map();

    for (const project of this.scanResults.projects) {
      // Merge dependencies
      for (const dep of project.dependencies) {
        allDependencies.set(dep, (allDependencies.get(dep) || 0) + 1);
      }

      for (const dep of project.devDependencies) {
        allDevDependencies.set(dep, (allDevDependencies.get(dep) || 0) + 1);
      }
    }

    this.scanResults.dependencies = {
      shared: Array.from(allDependencies.entries())
        .filter(([_, count]) => count > 1)
        .map(([dep, count]) => ({ name: dep, usage: count })),
      totalUnique: allDependencies.size,
      totalDevUnique: allDevDependencies.size,
    };
  }

  /**
   * Generate recommendations based on scan results
   */
  generateRecommendations() {
    const recommendations = [];

    // Project-specific recommendations
    for (const project of this.scanResults.projects) {
      if (project.score < 50) {
        recommendations.push({
          type: 'critical',
          project: project.name || project.path,
          message: `Project health score is low (${project.score}/100). Consider reviewing and fixing identified issues.`,
          issues: project.issues,
        });
      }

      if (!project.hasGit) {
        recommendations.push({
          type: 'improvement',
          project: project.name || project.path,
          message: 'Initialize git repository for version control',
        });
      }

      if (project.dependencies.length > 20) {
        recommendations.push({
          type: 'optimization',
          project: project.name || project.path,
          message: 'Consider reducing number of dependencies',
        });
      }
    }

    // Workspace-wide recommendations
    if (this.scanResults.dependencies.shared.length > 10) {
      recommendations.push({
        type: 'workspace',
        message: `Found ${this.scanResults.dependencies.shared.length} shared dependencies across projects. Consider using a monorepo structure.`,
      });
    }

    // Security recommendations
    const totalProjects = this.scanResults.projects.length;
    const projectsWithoutPackageJson = this.scanResults.projects.filter(
      (p) => !p.hasPackageJson
    ).length;

    if (projectsWithoutPackageJson > 0) {
      recommendations.push({
        type: 'security',
        message: `${projectsWithoutPackageJson} projects missing package.json. This may indicate unmanaged dependencies.`,
      });
    }

    this.scanResults.recommendations = recommendations;
  }

  /**
   * Check for outdated dependencies (simplified check)
   */
  checkOutdatedDependencies(dependencies) {
    // This is a simplified check - in a real implementation,
    // you would check against a vulnerability database
    const potentiallyOutdated = [
      'lodash',
      'moment',
      'request',
      'express@3',
      'angular@1',
    ];

    return Object.keys(dependencies).filter((dep) =>
      potentiallyOutdated.some((outdated) =>
        dep.includes(outdated.split('@')[0])
      )
    );
  }

  /**
   * Generate tasks based on scan results
   */
  generateTasks() {
    const tasks = [];

    // Generate tasks from issues
    for (const project of this.scanResults.projects) {
      for (const issue of project.issues) {
        tasks.push({
          type: 'fix',
          project: project.name || project.path,
          description: issue,
          priority: project.score < 50 ? 'high' : 'medium',
          estimatedTime: '1h',
        });
      }
    }

    // Generate tasks from recommendations
    for (const recommendation of this.scanResults.recommendations) {
      tasks.push({
        type: 'improvement',
        project: recommendation.project || 'workspace',
        description: recommendation.message,
        priority: recommendation.type === 'critical' ? 'high' : 'low',
        estimatedTime: '2h',
      });
    }

    return tasks;
  }

  /**
   * Get project graph and metadata
   */
  getProjectGraph() {
    return {
      projects: this.scanResults.projects.map((p) => ({
        name: p.name,
        path: p.path,
        type: p.type,
        dependencies: p.dependencies.length,
        score: p.score,
      })),
      dependencies: this.scanResults.dependencies,
      metadata: this.scanResults.metadata,
    };
  }

  /**
   * Export scan results
   */
  exportResults() {
    return {
      ...this.scanResults,
      tasks: this.generateTasks(),
    };
  }
}

// Create singleton instance
const projectAnalyzer = new ProjectAnalyzer();

export default projectAnalyzer;
export { ProjectAnalyzer };
