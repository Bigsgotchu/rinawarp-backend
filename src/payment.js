import Stripe from 'stripe';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const stripe = process.env.STRIPE_SECRET_KEY
  ? Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Email configuration
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// License storage
const LICENSES_FILE = path.join(__dirname, 'licenses.json');
let licenses = {};

// Load existing licenses
if (fs.existsSync(LICENSES_FILE)) {
  try {
    licenses = JSON.parse(fs.readFileSync(LICENSES_FILE, 'utf-8'));
  } catch (err) {
    console.error('Failed to load licenses:', err);
  }
}

function saveLicenses() {
  fs.writeFileSync(LICENSES_FILE, JSON.stringify(licenses, null, 2));
}

// Generate license key
function generateLicenseKey() {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    segments.push(Math.random().toString(36).substring(2, 8).toUpperCase());
  }
  return `RINAWARP-${segments.join('-')}`;
}

// Create Stripe checkout session
async function createCheckoutSession(priceId, customerEmail) {
  try {
    if (!stripe) {
      throw new Error('Stripe not configured - missing STRIPE_SECRET_KEY');
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url:
        'https://rinawarptech.com/downloads.html?status=success&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://rinawarptech.com/downloads.html?status=cancelled',
      customer_email: customerEmail,
      metadata: {
        product: 'rinawarp-terminal-pro',
      },
    });

    return session;
  } catch (error) {
    console.error('Stripe checkout error:', error);
    throw error;
  }
}

// Send license via email
async function sendLicenseEmail(email, licenseKey, plan) {
  const mailOptions = {
    from: process.env.SMTP_USER,
    to: email,
    subject: '🎉 Your RinaWarp Terminal Pro License',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ff66cc, #ff8c42, #20b2aa, #87ceeb); padding: 20px; text-align: center; color: white;">
          <h1>🧜‍♀️ Welcome to RinaWarp Terminal Pro!</h1>
        </div>
        <div style="padding: 20px; background: #f8f9fa;">
          <h2>Your License Key</h2>
          <div style="background: #2d3748; color: #68d391; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 18px; text-align: center; margin: 20px 0;">
            ${licenseKey}
          </div>
          <p><strong>Plan:</strong> ${plan}</p>
          <p>Thank you for purchasing RinaWarp Terminal Pro! Your license is now active.</p>
          <div style="margin-top: 30px; padding: 15px; background: #e6fffa; border-left: 4px solid #20b2aa;">
            <h3>Next Steps:</h3>
            <ol>
              <li>Download RinaWarp Terminal Pro</li>
              <li>Enter your license key when prompted</li>
              <li>Enjoy your AI-powered terminal experience!</li>
            </ol>
          </div>
        </div>
        <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
          © 2025 RinaWarp Technologies, LLC. All rights reserved.
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`License email sent to ${email}`);
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
}

// Handle successful payment
async function handleSuccessfulPayment(session) {
  const { customer_email, amount_total, metadata } = session;
  const plan =
    amount_total === 2900
      ? 'Early Bird Lifetime'
      : amount_total === 2900
        ? 'Professional'
        : 'Personal';

  // Generate license
  const licenseKey = generateLicenseKey();
  const licenseId = uuidv4();

  // Store license
  licenses[licenseId] = {
    key: licenseKey,
    email: customer_email,
    plan: plan,
    createdAt: new Date().toISOString(),
    status: 'active',
  };

  saveLicenses();

  // Send email
  await sendLicenseEmail(customer_email, licenseKey, plan);

  console.log(`License generated for ${customer_email}: ${licenseKey}`);

  return { licenseKey, plan };
}

// Validate license
function validateLicense(licenseKey) {
  const license = Object.values(licenses).find((l) => l.key === licenseKey);

  if (!license) {
    return { valid: false, reason: 'License not found' };
  }

  if (license.status !== 'active') {
    return { valid: false, reason: 'License inactive' };
  }

  return {
    valid: true,
    plan: license.plan,
    email: license.email,
    createdAt: license.createdAt,
  };
}

export {
  createCheckoutSession,
  handleSuccessfulPayment,
  validateLicense,
  generateLicenseKey,
};
