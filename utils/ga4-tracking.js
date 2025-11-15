/**
 * GA4 Measurement Protocol API - Server-Side Event Tracking
 * For tracking Stripe checkout and purchase events from backend
 * 
 * Setup:
 * 1. Get API Secret from GA4 Admin → Data Streams → Measurement Protocol API secrets
 * 2. Add GA4_API_SECRET to your environment variables
 * 3. Import and use in your Stripe webhook handlers
 */

const GA_MEASUREMENT_ID = 'G-CMCWN64YTT';
const GA_API_SECRET = process.env.GA4_API_SECRET || '';

/**
 * Send event to GA4 via Measurement Protocol API
 * @param {string} eventName - GA4 event name (e.g., 'purchase', 'begin_checkout')
 * @param {object} params - Event parameters
 * @param {string} params.client_id - Unique client identifier (required)
 * @returns {Promise<boolean>} - Success status
 */
async function sendGAEvent(eventName, params = {}) {
  if (!GA_API_SECRET) {
    console.warn('⚠️ GA4_API_SECRET not configured. Skipping server-side tracking.');
    return false;
  }

  try {
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`;
    
    const payload = {
      client_id: params.client_id || 'server',
      events: [{
        name: eventName,
        params: {
          ...params,
          engagement_time_msec: '100',
          session_id: Date.now().toString()
        }
      }]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log(`✅ GA4 Event tracked: ${eventName}`, params);
      return true;
    } else {
      console.error(`❌ GA4 tracking failed: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.error('❌ GA4 tracking error:', error.message);
    return false;
  }
}

/**
 * Track Stripe checkout session created
 * @param {object} session - Stripe checkout session object
 */
async function trackCheckoutStarted(session) {
  const planType = session.metadata?.plan_type || 'unknown';
  const amount = session.amount_total / 100; // Convert cents to dollars
  
  return sendGAEvent('begin_checkout', {
    client_id: session.client_reference_id || session.id,
    transaction_id: session.id,
    value: amount,
    currency: session.currency.toUpperCase(),
    plan_type: planType,
    items: [{
      item_id: planType,
      item_name: `RinaWarp Terminal Pro - ${planType}`,
      price: amount,
      quantity: 1
    }]
  });
}

/**
 * Track successful purchase completion
 * @param {object} session - Stripe checkout session object
 */
async function trackPurchaseCompleted(session) {
  const planType = session.metadata?.plan_type || 'unknown';
  const amount = session.amount_total / 100;
  
  return sendGAEvent('purchase', {
    client_id: session.client_reference_id || session.id,
    transaction_id: session.id,
    value: amount,
    currency: session.currency.toUpperCase(),
    plan_type: planType,
    tax: (session.total_details?.amount_tax || 0) / 100,
    shipping: (session.total_details?.amount_shipping || 0) / 100,
    items: [{
      item_id: planType,
      item_name: `RinaWarp Terminal Pro - ${planType}`,
      price: amount,
      quantity: 1,
      category: 'Software'
    }]
  });
}

/**
 * Track subscription created
 * @param {object} subscription - Stripe subscription object
 */
async function trackSubscriptionCreated(subscription) {
  const planType = subscription.metadata?.plan_type || 'subscription';
  const amount = subscription.items.data[0]?.price?.unit_amount / 100 || 0;
  
  return sendGAEvent('subscription_created', {
    client_id: subscription.customer,
    subscription_id: subscription.id,
    value: amount,
    currency: subscription.currency.toUpperCase(),
    plan_type: planType,
    billing_interval: subscription.items.data[0]?.price?.recurring?.interval || 'month'
  });
}

/**
 * Track subscription cancelled
 * @param {object} subscription - Stripe subscription object
 */
async function trackSubscriptionCancelled(subscription) {
  const planType = subscription.metadata?.plan_type || 'subscription';
  
  return sendGAEvent('subscription_cancelled', {
    client_id: subscription.customer,
    subscription_id: subscription.id,
    plan_type: planType,
    cancellation_reason: subscription.cancellation_details?.reason || 'unknown'
  });
}

/**
 * Track refund issued
 * @param {object} refund - Stripe refund object
 */
async function trackRefundIssued(refund) {
  const amount = refund.amount / 100;
  
  return sendGAEvent('refund', {
    client_id: refund.charge,
    transaction_id: refund.charge,
    value: amount,
    currency: refund.currency.toUpperCase(),
    refund_reason: refund.reason || 'requested_by_customer'
  });
}

/**
 * Track custom server-side event
 * @param {string} eventName - Custom event name
 * @param {object} params - Event parameters
 */
async function trackCustomEvent(eventName, params = {}) {
  return sendGAEvent(eventName, params);
}

module.exports = {
  sendGAEvent,
  trackCheckoutStarted,
  trackPurchaseCompleted,
  trackSubscriptionCreated,
  trackSubscriptionCancelled,
  trackRefundIssued,
  trackCustomEvent
};
