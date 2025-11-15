import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LICENSES_FILE = path.join(__dirname, '../data/licenses.json');

// Ensure data directory exists
const dataDir = path.dirname(LICENSES_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load licenses from file
function loadLicenses() {
  if (!fs.existsSync(LICENSES_FILE)) {
    // Create initial licenses file with demo licenses
    const initialLicenses = {
      'RINAWARP-PRO-123': {
        id: 'RINAWARP-PRO-123',
        type: 'personal',
        status: 'active',
        createdAt: Date.now(),
        lastUsed: null,
        usageCount: 0,
        maxUsage: 1000,
      },
      'RINAWARP-EARLY-456': {
        id: 'RINAWARP-EARLY-456',
        type: 'earlybird',
        status: 'active',
        createdAt: Date.now(),
        lastUsed: null,
        usageCount: 0,
        maxUsage: 5000,
      },
    };
    saveLicenses(initialLicenses);
    return initialLicenses;
  }

  try {
    return JSON.parse(fs.readFileSync(LICENSES_FILE, 'utf8'));
  } catch (error) {
    console.error('Error loading licenses:', error);
    return {};
  }
}

// Save licenses to file
function saveLicenses(licenses) {
  try {
    fs.writeFileSync(LICENSES_FILE, JSON.stringify(licenses, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving licenses:', error);
    return false;
  }
}

// Check if license is valid
export function checkLicense(key) {
  if (!key) return { valid: false, reason: 'No license key provided' };

  const licenses = loadLicenses();
  const license = licenses[key];

  if (!license) {
    return { valid: false, reason: 'Invalid license key' };
  }

  if (license.status !== 'active') {
    return { valid: false, reason: 'License is inactive' };
  }

  if (license.usageCount >= license.maxUsage) {
    return { valid: false, reason: 'License usage limit exceeded' };
  }

  return {
    valid: true,
    license: {
      id: license.id,
      type: license.type,
      usageCount: license.usageCount,
      maxUsage: license.maxUsage,
    },
  };
}

// Record license usage
export function recordLicenseUsage(key) {
  const licenses = loadLicenses();
  const license = licenses[key];

  if (license) {
    license.usageCount = (license.usageCount || 0) + 1;
    license.lastUsed = Date.now();
    saveLicenses(licenses);
    return true;
  }

  return false;
}

// Generate new license
export function generateLicense(type = 'personal', maxUsage = 1000) {
  const licenses = loadLicenses();
  const licenseId = `RINAWARP-${type.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  const newLicense = {
    id: licenseId,
    type: type,
    status: 'active',
    createdAt: Date.now(),
    lastUsed: null,
    usageCount: 0,
    maxUsage: maxUsage,
  };

  licenses[licenseId] = newLicense;
  saveLicenses(licenses);

  return newLicense;
}

// Get license statistics
export function getLicenseStats() {
  const licenses = loadLicenses();
  const stats = {
    total: Object.keys(licenses).length,
    active: 0,
    personal: 0,
    earlybird: 0,
    totalUsage: 0,
  };

  Object.values(licenses).forEach((license) => {
    if (license.status === 'active') stats.active++;
    if (license.type === 'personal') stats.personal++;
    if (license.type === 'earlybird') stats.earlybird++;
    stats.totalUsage += license.usageCount || 0;
  });

  return stats;
}

// Validate license for WebSocket connection
export function validateLicenseForConnection(key) {
  const result = checkLicense(key);

  if (result.valid) {
    recordLicenseUsage(key);
    return {
      success: true,
      message: 'License validated successfully',
      license: result.license,
    };
  }

  return {
    success: false,
    message: result.reason,
  };
}
