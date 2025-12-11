/**
 * Test Cloudflare API Token
 */

const CLOUDFLARE_API_TOKEN = 'ovZf8y-1B4L5OLwmFSqp6gPJghIKX_KXKDDywDS0';
const ZONE_ID = 'cae2b45ba6538b5c0ffc2c152c39bfab';

async function testToken() {
  console.log('🔍 Testing Cloudflare API Token...\n');

  try {
    // Test 1: Verify token
    console.log('Test 1: Verifying token...');
    const verifyResponse = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    const verifyData = await verifyResponse.json();
    
    if (verifyData.success) {
      console.log('✅ Token is valid!\n');
      console.log('Token details:', JSON.stringify(verifyData.result, null, 2));
    } else {
      console.log('❌ Token verification failed:', verifyData.errors);
      return;
    }

    // Test 2: Get zone details
    console.log('\nTest 2: Getting zone details...');
    const zoneResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}`, {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    const zoneData = await zoneResponse.json();
    
    if (zoneData.success) {
      console.log('✅ Zone access successful!');
      console.log('Zone name:', zoneData.result.name);
      console.log('Zone status:', zoneData.result.status);
    } else {
      console.log('❌ Zone access failed:', zoneData.errors);
      return;
    }

    // Test 3: List existing WAF rules
    console.log('\nTest 3: Listing WAF rules...');
    const rulesResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/firewall/rules`, {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    const rulesData = await rulesResponse.json();
    
    if (rulesData.success) {
      console.log('✅ WAF rules access successful!');
      console.log('Existing rules:', rulesData.result.length);
    } else {
      console.log('⚠️  WAF rules access failed:', rulesData.errors);
      console.log('This might be normal - trying alternative endpoint...');
    }

    // Test 4: Try rulesets endpoint (newer API)
    console.log('\nTest 4: Trying rulesets endpoint...');
    const rulesetsResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets`, {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    const rulesetsData = await rulesetsResponse.json();
    
    if (rulesetsData.success) {
      console.log('✅ Rulesets access successful!');
      console.log('Existing rulesets:', rulesetsData.result.length);
      rulesetsData.result.forEach(ruleset => {
        console.log(`  - ${ruleset.name} (${ruleset.phase})`);
      });
    } else {
      console.log('⚠️  Rulesets access failed:', rulesetsData.errors);
    }

    console.log('\n✅ All tests complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testToken();

