/**
 * Cloudflare Firewall Rules Setup Script
 * Uses the Firewall Rules API (compatible with free plan)
 */

const CLOUDFLARE_API_TOKEN = 'ovZf8y-1B4L5OLwmFSqp6gPJghIKX_KXKDDywDS0';
const ZONE_ID = 'cae2b45ba6538b5c0ffc2c152c39bfab';

const API_BASE = 'https://api.cloudflare.com/client/v4';

// ============================================================================
// FIREWALL RULES (Free Plan Compatible)
// ============================================================================

const FIREWALL_RULES = [
  // Rule 1: Block AI Bots & Malicious Scrapers
  {
    filter: {
      expression: '(http.user_agent contains "GPTBot") or (http.user_agent contains "ChatGPT") or (http.user_agent contains "Claude-Web") or (http.user_agent contains "anthropic-ai") or (http.user_agent contains "Google-Extended") or (http.user_agent contains "CCBot") or (http.user_agent contains "FacebookBot") or (http.user_agent contains "Bytespider") or (http.user_agent contains "Applebot-Extended") or (http.user_agent contains "PerplexityBot") or (http.user_agent contains "Diffbot") or (http.user_agent contains "Scrapy") or (http.user_agent contains "python-requests") or (http.user_agent contains "curl") or (http.user_agent contains "wget") or (http.user_agent contains "sqlmap") or (http.user_agent contains "nikto") or (http.user_agent contains "nmap") or (http.user_agent eq "")',
      description: 'Block AI bots and malicious scrapers'
    },
    action: 'block',
    description: 'Block AI Bots and Scrapers - Protects LGBTQ+ user privacy'
  },

  // Rule 2: Block Attack Patterns
  {
    filter: {
      expression: '(http.request.uri.query contains "UNION SELECT") or (http.request.uri.query contains "DROP TABLE") or (http.request.uri.query contains "<script>") or (http.request.uri.query contains "javascript:") or (http.request.uri.query contains "onerror=") or (http.request.uri.query contains "onload=")',
      description: 'Block SQL injection and XSS attacks'
    },
    action: 'block',
    description: 'Block SQL Injection and XSS Attacks'
  },

  // Rule 3: Geographic Restrictions
  {
    filter: {
      expression: '(ip.geoip.country in {"IR" "AF" "PK" "IQ" "UG" "SA" "RU" "CN" "KP"}) and (http.request.uri.path contains "/api/auth/signup")',
      description: 'Block signups from high-risk countries'
    },
    action: 'block',
    description: 'Block Signups from High-Risk Countries'
  },

  // Rule 4: Challenge High Threat Traffic
  {
    filter: {
      expression: '(cf.threat_score gt 20)',
      description: 'Challenge high threat score traffic'
    },
    action: 'challenge',
    description: 'Challenge High Threat Traffic'
  },

  // Rule 5: Protect Auth Endpoints
  {
    filter: {
      expression: '(http.request.uri.path contains "/api/auth/login" or http.request.uri.path contains "/api/auth/signup" or http.request.uri.path contains "/api/auth/reset-password") and (cf.threat_score gt 5)',
      description: 'Protect authentication endpoints'
    },
    action: 'challenge',
    description: 'Protect Authentication Endpoints'
  }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function makeRequest(endpoint, method = 'GET', data = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, options);
  const result = await response.json();

  if (!result.success) {
    throw new Error(`Cloudflare API Error: ${JSON.stringify(result.errors)}`);
  }

  return result;
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

async function listExistingRules() {
  console.log('📋 Listing existing firewall rules...\n');

  try {
    const result = await makeRequest(`/zones/${ZONE_ID}/firewall/rules`);

    if (result.result && result.result.length > 0) {
      console.log(`Found ${result.result.length} existing rules:\n`);
      result.result.forEach((rule, index) => {
        console.log(`${index + 1}. ${rule.description || 'Unnamed rule'}`);
        console.log(`   Action: ${rule.action}`);
        console.log(`   Enabled: ${!rule.paused}`);
        console.log('');
      });
    } else {
      console.log('No existing rules found.\n');
    }

    return result.result || [];
  } catch (error) {
    console.error(`❌ Failed to list rules: ${error.message}\n`);
    return [];
  }
}

async function deleteAllRules() {
  console.log('🗑️  Deleting all existing firewall rules...\n');

  try {
    const existing = await makeRequest(`/zones/${ZONE_ID}/firewall/rules`);
    
    if (existing.result && existing.result.length > 0) {
      const ruleIds = existing.result.map(r => r.id);
      
      await makeRequest(
        `/zones/${ZONE_ID}/firewall/rules`,
        'DELETE',
        { ids: ruleIds }
      );
      
      console.log(`✅ Deleted ${ruleIds.length} rules!\n`);
    } else {
      console.log('No rules to delete.\n');
    }
  } catch (error) {
    console.error(`❌ Failed to delete rules: ${error.message}\n`);
  }
}

async function addFirewallRules() {
  console.log('🔥 Adding Cloudflare Firewall Rules...\n');

  try {
    // Create rules one by one (more reliable than batch)
    const createdRules = [];

    for (let i = 0; i < FIREWALL_RULES.length; i++) {
      const rule = FIREWALL_RULES[i];
      console.log(`📝 Creating rule ${i + 1}/${FIREWALL_RULES.length}: ${rule.description}...`);

      try {
        // Create filter first
        const filterResult = await makeRequest(
          `/zones/${ZONE_ID}/filters`,
          'POST',
          [rule.filter]
        );

        const filterId = filterResult.result[0].id;

        // Create firewall rule using the filter
        const ruleResult = await makeRequest(
          `/zones/${ZONE_ID}/firewall/rules`,
          'POST',
          [{
            filter: { id: filterId },
            action: rule.action,
            description: rule.description
          }]
        );

        createdRules.push(ruleResult.result[0]);
        console.log(`   ✅ Created successfully\n`);

      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}\n`);
      }
    }

    console.log(`\n✅ Successfully created ${createdRules.length}/${FIREWALL_RULES.length} firewall rules!\n`);

    // Display created rules
    if (createdRules.length > 0) {
      console.log('📋 Created Rules:\n');
      createdRules.forEach((rule, index) => {
        console.log(`${index + 1}. ${rule.description}`);
        console.log(`   Action: ${rule.action}`);
        console.log(`   Enabled: ${!rule.paused}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error(`❌ Failed to add rules: ${error.message}\n`);
  }
}

async function configureSecuritySettings() {
  console.log('🔐 Configuring security settings...\n');

  const settings = [
    { name: 'security_level', value: 'medium', description: 'Security level set to Medium' },
    { name: 'browser_check', value: 'on', description: 'Browser Integrity Check enabled' },
    { name: 'always_use_https', value: 'on', description: 'Always Use HTTPS enabled' },
    { name: 'min_tls_version', value: '1.2', description: 'Minimum TLS version set to 1.2' },
    { name: 'tls_1_3', value: 'on', description: 'TLS 1.3 enabled' },
  ];

  for (const setting of settings) {
    try {
      await makeRequest(
        `/zones/${ZONE_ID}/settings/${setting.name}`,
        'PATCH',
        { value: setting.value }
      );
      console.log(`✅ ${setting.description}`);
    } catch (error) {
      console.log(`⚠️  Failed to set ${setting.name}: ${error.message}`);
    }
  }

  console.log('');
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

  try {
    const args = process.argv.slice(2);

    if (args.includes('--list')) {
      await listExistingRules();
    } else if (args.includes('--delete')) {
      await listExistingRules();
      await deleteAllRules();
    } else if (args.includes('--setup')) {
      // List existing rules
      const existing = await listExistingRules();

      // Warn if rules exist
      if (existing.length > 0) {
        console.log('⚠️  WARNING: You already have firewall rules.');
        console.log('   Free plan allows 5 rules maximum.');
        console.log('   Current rules: ' + existing.length);
        console.log('   New rules to add: ' + FIREWALL_RULES.length);
        console.log('   Total would be: ' + (existing.length + FIREWALL_RULES.length));
        console.log('');

        if (existing.length + FIREWALL_RULES.length > 5) {
          console.log('❌ ERROR: This would exceed the 5-rule limit!');
          console.log('   Run with --delete --setup to delete old rules first.\n');
          return;
        }
      }

      // Add firewall rules
      await addFirewallRules();

      // Configure security settings
      await configureSecuritySettings();

      console.log('═══════════════════════════════════════════════════════════════');
      console.log('✅  SETUP COMPLETE!');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('\n');
      console.log('🎯 Next Steps:');
      console.log('1. Visit https://dash.cloudflare.com and verify the rules');
      console.log('2. Go to: Security → Firewall → Firewall Rules');
      console.log('3. Test your website to ensure no false positives');
      console.log('4. Monitor Security → Events for blocked traffic\n');

    } else {
      console.log('Usage:');
      console.log('  node cloudflare-setup-firewall.js --list              # List existing rules');
      console.log('  node cloudflare-setup-firewall.js --delete            # Delete all existing rules');
      console.log('  node cloudflare-setup-firewall.js --setup             # Add all security rules');
      console.log('  node cloudflare-setup-firewall.js --delete --setup    # Delete old rules and add new ones\n');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();

