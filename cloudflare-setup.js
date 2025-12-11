/**
 * Cloudflare Security Rules Setup Script
 * 
 * This script adds comprehensive security rules to your Cloudflare account
 * optimized for the FREE PLAN (5 rules maximum)
 * 
 * SETUP:
 * 1. Get your Cloudflare API Token:
 *    - Go to: https://dash.cloudflare.com/profile/api-tokens
 *    - Click "Create Token"
 *    - Use template: "Edit zone WAF"
 *    - Select your zone: prydeapp.com
 *    - Copy the token
 * 
 * 2. Get your Zone ID:
 *    - Go to: https://dash.cloudflare.com
 *    - Select your domain: prydeapp.com
 *    - Scroll down on Overview page
 *    - Copy "Zone ID" from the right sidebar
 * 
 * 3. Run this script:
 *    node cloudflare-setup.js
 */

const CLOUDFLARE_API_TOKEN = 'ovZf8y-1B4L5OLwmFSqp6gPJghIKX_KXKDDywDS0'; // Your Cloudflare API token
const ZONE_ID = 'cae2b45ba6538b5c0ffc2c152c39bfab'; // Your prydeapp.com Zone ID

const API_BASE = 'https://api.cloudflare.com/client/v4';

// ============================================================================
// OPTIMIZED FOR FREE PLAN: 5 RULES MAXIMUM
// ============================================================================

const SECURITY_RULES = [
  // -------------------------------------------------------------------------
  // RULE 1: BLOCK AI BOTS & MALICIOUS SCRAPERS (CRITICAL)
  // -------------------------------------------------------------------------
  {
    action: 'block',
    description: 'Block AI bots, scrapers, and malicious user agents to protect LGBTQ+ user privacy',
    expression: `(cf.bot_management.score lt 30) or (http.user_agent contains "GPTBot") or (http.user_agent contains "ChatGPT") or (http.user_agent contains "Claude-Web") or (http.user_agent contains "anthropic-ai") or (http.user_agent contains "Google-Extended") or (http.user_agent contains "CCBot") or (http.user_agent contains "FacebookBot") or (http.user_agent contains "Bytespider") or (http.user_agent contains "Applebot-Extended") or (http.user_agent contains "PerplexityBot") or (http.user_agent contains "Diffbot") or (http.user_agent contains "Scrapy") or (http.user_agent contains "python-requests") or (http.user_agent contains "curl") or (http.user_agent contains "wget") or (http.user_agent contains "sqlmap") or (http.user_agent contains "nikto") or (http.user_agent contains "nmap") or (http.user_agent contains "masscan") or (http.user_agent eq "")`,
    enabled: true
  },

  // -------------------------------------------------------------------------
  // RULE 2: PROTECT ADMIN & AUTH ENDPOINTS + HIGH THREAT TRAFFIC
  // -------------------------------------------------------------------------
  {
    action: 'managed_challenge',
    description: 'Protect admin panel, auth endpoints, and challenge high threat traffic',
    expression: `((http.request.uri.path contains "/api/admin") and (cf.threat_score gt 10)) or ((http.request.uri.path contains "/api/auth/login" or http.request.uri.path contains "/api/auth/signup" or http.request.uri.path contains "/api/auth/reset-password") and (cf.threat_score gt 5)) or (cf.threat_score gt 20)`,
    enabled: true
  },

  // -------------------------------------------------------------------------
  // RULE 3: BLOCK ATTACK PATTERNS (SQL INJECTION, XSS, FILE UPLOADS)
  // -------------------------------------------------------------------------
  {
    action: 'block',
    description: 'Block SQL injection, XSS attacks, and malicious file upload attempts',
    expression: `(http.request.uri.query contains "UNION SELECT") or (http.request.uri.query contains "DROP TABLE") or (http.request.uri.query contains "<script>") or (http.request.uri.query contains "javascript:") or (http.request.uri.query contains "onerror=") or (http.request.uri.query contains "onload=") or ((http.request.uri.path contains "/api/upload") and (http.request.body contains ".php" or http.request.body contains ".exe" or http.request.body contains ".sh" or http.request.body contains ".bat" or http.request.body contains ".cmd"))`,
    enabled: true
  },

  // -------------------------------------------------------------------------
  // RULE 4: GEOGRAPHIC RESTRICTIONS (SIGNUP ONLY)
  // -------------------------------------------------------------------------
  {
    action: 'block',
    description: 'Block signups from high-risk countries while allowing read access for LGBTQ+ users',
    expression: `(ip.geoip.country in {"IR" "AF" "PK" "IQ" "UG" "SA" "RU" "CN" "KP"}) and (http.request.uri.path contains "/api/auth/signup")`,
    enabled: true
  },

  // -------------------------------------------------------------------------
  // RULE 5: RESERVED FOR CUSTOM USE / WHITELIST
  // -------------------------------------------------------------------------
  {
    action: 'skip',
    action_parameters: {
      ruleset: 'current'
    },
    description: 'Whitelist your development IP and trusted services (UPDATE WITH YOUR IP)',
    expression: `(ip.src in {1.2.3.4}) or (http.user_agent contains "UptimeRobot")`,
    enabled: false // Disabled by default - enable after adding your IP
  }
];

// ============================================================================
// RATE LIMITING RULES (Separate API endpoint)
// Note: Free plan has LIMITED rate limiting rules
// ============================================================================

const RATE_LIMIT_RULES = [
  // Login rate limit
  {
    description: 'Rate limit login attempts - 5 per minute per IP',
    match: {
      request: {
        methods: ['POST'],
        url: '*/api/auth/login'
      }
    },
    threshold: 5,
    period: 60,
    action: {
      mode: 'ban',
      timeout: 900 // 15 minutes
    }
  },

  // Signup rate limit
  {
    description: 'Rate limit signups - 3 per hour per IP',
    match: {
      request: {
        methods: ['POST'],
        url: '*/api/auth/signup'
      }
    },
    threshold: 3,
    period: 3600,
    action: {
      mode: 'ban',
      timeout: 3600 // 1 hour
    }
  }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function makeCloudflareRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await response.json();

  if (!data.success) {
    throw new Error(`Cloudflare API Error: ${JSON.stringify(data.errors)}`);
  }

  return data;
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

async function addSecurityRules() {
  console.log('🔥 Adding Cloudflare Security Rules...\n');

  for (let i = 0; i < SECURITY_RULES.length; i++) {
    const rule = SECURITY_RULES[i];
    
    try {
      console.log(`📝 Adding Rule ${i + 1}/5: ${rule.description}`);
      
      const payload = {
        action: rule.action,
        description: rule.description,
        expression: rule.expression,
        enabled: rule.enabled
      };

      if (rule.action_parameters) {
        payload.action_parameters = rule.action_parameters;
      }

      const result = await makeCloudflareRequest(
        `/zones/${ZONE_ID}/rulesets/phases/http_request_firewall_custom/entrypoint`,
        'PUT',
        {
          rules: [payload]
        }
      );

      console.log(`   ✅ Success!\n`);
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}\n`);
    }
  }

  console.log('✅ All security rules added!\n');
}

async function addRateLimitRules() {
  console.log('⏱️  Adding Rate Limiting Rules...\n');

  for (let i = 0; i < RATE_LIMIT_RULES.length; i++) {
    const rule = RATE_LIMIT_RULES[i];

    try {
      console.log(`📝 Adding Rate Limit ${i + 1}/${RATE_LIMIT_RULES.length}: ${rule.description}`);

      const result = await makeCloudflareRequest(
        `/zones/${ZONE_ID}/rate_limits`,
        'POST',
        rule
      );

      console.log(`   ✅ Success!\n`);
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}\n`);
    }
  }

  console.log('✅ All rate limit rules added!\n');
}

async function listExistingRules() {
  console.log('📋 Listing existing security rules...\n');

  try {
    const result = await makeCloudflareRequest(
      `/zones/${ZONE_ID}/rulesets/phases/http_request_firewall_custom/entrypoint`
    );

    if (result.result && result.result.rules) {
      console.log(`Found ${result.result.rules.length} existing rules:\n`);
      result.result.rules.forEach((rule, index) => {
        console.log(`${index + 1}. ${rule.description || 'Unnamed rule'}`);
        console.log(`   Action: ${rule.action}`);
        console.log(`   Enabled: ${rule.enabled}`);
        console.log('');
      });
    } else {
      console.log('No existing rules found.\n');
    }
  } catch (error) {
    console.error(`❌ Failed to list rules: ${error.message}\n`);
  }
}

async function deleteAllRules() {
  console.log('🗑️  Deleting all existing security rules...\n');

  try {
    const result = await makeCloudflareRequest(
      `/zones/${ZONE_ID}/rulesets/phases/http_request_firewall_custom/entrypoint`,
      'PUT',
      {
        rules: []
      }
    );

    console.log('✅ All rules deleted!\n');
  } catch (error) {
    console.error(`❌ Failed to delete rules: ${error.message}\n`);
  }
}

async function enableBotFightMode() {
  console.log('🤖 Enabling Bot Fight Mode...\n');

  try {
    const result = await makeCloudflareRequest(
      `/zones/${ZONE_ID}/bot_management`,
      'PUT',
      {
        fight_mode: true,
        enable_js: true
      }
    );

    console.log('✅ Bot Fight Mode enabled!\n');
  } catch (error) {
    console.error(`❌ Failed to enable Bot Fight Mode: ${error.message}`);
    console.log('   Note: Bot Fight Mode may not be available on free plan\n');
  }
}

async function configureSecuritySettings() {
  console.log('🔐 Configuring security settings...\n');

  try {
    // Set security level to medium
    await makeCloudflareRequest(
      `/zones/${ZONE_ID}/settings/security_level`,
      'PATCH',
      {
        value: 'medium'
      }
    );
    console.log('✅ Security level set to Medium\n');

    // Enable browser integrity check
    await makeCloudflareRequest(
      `/zones/${ZONE_ID}/settings/browser_check`,
      'PATCH',
      {
        value: 'on'
      }
    );
    console.log('✅ Browser Integrity Check enabled\n');

    // Enable Always Use HTTPS
    await makeCloudflareRequest(
      `/zones/${ZONE_ID}/settings/always_use_https`,
      'PATCH',
      {
        value: 'on'
      }
    );
    console.log('✅ Always Use HTTPS enabled\n');

    // Set minimum TLS version to 1.2
    await makeCloudflareRequest(
      `/zones/${ZONE_ID}/settings/min_tls_version`,
      'PATCH',
      {
        value: '1.2'
      }
    );
    console.log('✅ Minimum TLS version set to 1.2\n');

    // Enable TLS 1.3
    await makeCloudflareRequest(
      `/zones/${ZONE_ID}/settings/tls_1_3`,
      'PATCH',
      {
        value: 'on'
      }
    );
    console.log('✅ TLS 1.3 enabled\n');

  } catch (error) {
    console.error(`❌ Failed to configure security settings: ${error.message}\n`);
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🏳️‍🌈  PRYDE SOCIAL - CLOUDFLARE SECURITY SETUP');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n');

  // Validate configuration
  if (CLOUDFLARE_API_TOKEN === 'YOUR_API_TOKEN_HERE' || ZONE_ID === 'YOUR_ZONE_ID_HERE') {
    console.error('❌ ERROR: Please update CLOUDFLARE_API_TOKEN and ZONE_ID in the script!\n');
    console.log('📝 Instructions:');
    console.log('1. Get API Token: https://dash.cloudflare.com/profile/api-tokens');
    console.log('2. Get Zone ID: https://dash.cloudflare.com (select your domain)\n');
    process.exit(1);
  }

  try {
    // List existing rules
    await listExistingRules();

    // Ask user if they want to proceed
    console.log('⚠️  WARNING: This will add 5 new security rules to your Cloudflare account.');
    console.log('   If you already have rules, you may exceed the free plan limit (5 rules).\n');
    console.log('   Options:');
    console.log('   1. Continue and add rules (may fail if limit exceeded)');
    console.log('   2. Delete existing rules first (run with --delete flag)');
    console.log('   3. Cancel (Ctrl+C)\n');

    // Check for command line arguments
    const args = process.argv.slice(2);

    if (args.includes('--delete')) {
      await deleteAllRules();
    }

    if (args.includes('--list')) {
      // Already listed above
      process.exit(0);
    }

    if (args.includes('--setup')) {
      // Add security rules
      await addSecurityRules();

      // Add rate limit rules (if available on free plan)
      await addRateLimitRules();

      // Configure security settings
      await configureSecuritySettings();

      // Try to enable bot fight mode
      await enableBotFightMode();

      console.log('═══════════════════════════════════════════════════════════════');
      console.log('✅  SETUP COMPLETE!');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('\n');
      console.log('🎯 Next Steps:');
      console.log('1. Visit https://dash.cloudflare.com and verify the rules');
      console.log('2. Test your website to ensure no false positives');
      console.log('3. Monitor Security → Events for blocked traffic');
      console.log('4. Update Rule 5 with your development IP address\n');
    } else {
      console.log('Usage:');
      console.log('  node cloudflare-setup.js --list          # List existing rules');
      console.log('  node cloudflare-setup.js --delete        # Delete all existing rules');
      console.log('  node cloudflare-setup.js --setup         # Add all security rules');
      console.log('  node cloudflare-setup.js --delete --setup # Delete old rules and add new ones\n');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();

