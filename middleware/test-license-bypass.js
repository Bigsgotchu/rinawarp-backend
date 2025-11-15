/**
 * Test License Bypass Middleware
 * FOR TESTING ONLY - DO NOT USE IN PRODUCTION
 */

export async function testLicenseBypass(req, res, next) {
  // Only bypass if x-test-bypass header is present
  if (req.headers['x-test-bypass'] === 'true') {
    console.log('[TEST] Bypassing license check for testing');
    
    // Mock license info for testing
    req.licenseInfo = {
      sub: 'test@rinawarp.local',
      tier: 'personal',
      maxUsage: 999999,
      exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year from now
    };
    
    req.user = {
      id: 'test-user',
      email: 'test@rinawarp.local',
      tier: 'personal',
      maxUsage: 999999
    };
  }
  
  next();
}
