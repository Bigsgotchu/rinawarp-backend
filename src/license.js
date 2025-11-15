// Placeholder for license system (Stripe + validation)
const validateLicense = (key) => {
  console.log(`[LICENSE VALIDATION] Validating key: ${key}`);
  const validKey = process.env.VALID_LICENSE_KEY || 'RINAWARP-PRO-123'; // Use env var, fallback for now
  const isValid = key === validKey;
  console.log(`[LICENSE VALIDATION] Key valid: ${isValid}`);
  return isValid;
};

module.exports = { validateLicense };
