#!/usr/bin/env python3
"""
Cloudflare Security Rules Setup Script (Python Version)

This script adds comprehensive security rules to your Cloudflare account
optimized for the FREE PLAN (5 rules maximum)

SETUP:
1. Install requests: pip install requests
2. Get your Cloudflare API Token and Zone ID (see README.md)
3. Run: python cloudflare-setup.py --setup
"""

import requests
import json
import sys

# ============================================================================
# CONFIGURATION - UPDATE THESE VALUES
# ============================================================================

CLOUDFLARE_API_TOKEN = 'YOUR_API_TOKEN_HERE'  # Replace with your API token
ZONE_ID = 'YOUR_ZONE_ID_HERE'  # Replace with your zone ID

API_BASE = 'https://api.cloudflare.com/client/v4'

# ============================================================================
# OPTIMIZED FOR FREE PLAN: 5 RULES MAXIMUM
# ============================================================================

SECURITY_RULES = [
    # Rule 1: Block AI Bots & Malicious Scrapers
    {
        'action': 'block',
        'description': 'Block AI bots, scrapers, and malicious user agents to protect LGBTQ+ user privacy',
        'expression': '(cf.bot_management.score lt 30) or (http.user_agent contains "GPTBot") or (http.user_agent contains "ChatGPT") or (http.user_agent contains "Claude-Web") or (http.user_agent contains "anthropic-ai") or (http.user_agent contains "Google-Extended") or (http.user_agent contains "CCBot") or (http.user_agent contains "FacebookBot") or (http.user_agent contains "Bytespider") or (http.user_agent contains "Applebot-Extended") or (http.user_agent contains "PerplexityBot") or (http.user_agent contains "Diffbot") or (http.user_agent contains "Scrapy") or (http.user_agent contains "python-requests") or (http.user_agent contains "curl") or (http.user_agent contains "wget") or (http.user_agent contains "sqlmap") or (http.user_agent contains "nikto") or (http.user_agent contains "nmap") or (http.user_agent eq "")',
        'enabled': True
    },
    
    # Rule 2: Protect Admin & Auth Endpoints
    {
        'action': 'managed_challenge',
        'description': 'Protect admin panel, auth endpoints, and challenge high threat traffic',
        'expression': '((http.request.uri.path contains "/api/admin") and (cf.threat_score gt 10)) or ((http.request.uri.path contains "/api/auth/login" or http.request.uri.path contains "/api/auth/signup" or http.request.uri.path contains "/api/auth/reset-password") and (cf.threat_score gt 5)) or (cf.threat_score gt 20)',
        'enabled': True
    },
    
    # Rule 3: Block Attack Patterns
    {
        'action': 'block',
        'description': 'Block SQL injection, XSS attacks, and malicious file upload attempts',
        'expression': '(http.request.uri.query contains "UNION SELECT") or (http.request.uri.query contains "DROP TABLE") or (http.request.uri.query contains "<script>") or (http.request.uri.query contains "javascript:") or (http.request.uri.query contains "onerror=") or (http.request.uri.query contains "onload=") or ((http.request.uri.path contains "/api/upload") and (http.request.body contains ".php" or http.request.body contains ".exe" or http.request.body contains ".sh" or http.request.body contains ".bat"))',
        'enabled': True
    },
    
    # Rule 4: Geographic Restrictions
    {
        'action': 'block',
        'description': 'Block signups from high-risk countries while allowing read access for LGBTQ+ users',
        'expression': '(ip.geoip.country in {"IR" "AF" "PK" "IQ" "UG" "SA" "RU" "CN" "KP"}) and (http.request.uri.path contains "/api/auth/signup")',
        'enabled': True
    },
    
    # Rule 5: Whitelist (disabled by default)
    {
        'action': 'skip',
        'action_parameters': {
            'ruleset': 'current'
        },
        'description': 'Whitelist your development IP and trusted services (UPDATE WITH YOUR IP)',
        'expression': '(ip.src in {1.2.3.4}) or (http.user_agent contains "UptimeRobot")',
        'enabled': False
    }
]

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def make_request(endpoint, method='GET', data=None):
    """Make a request to Cloudflare API"""
    headers = {
        'Authorization': f'Bearer {CLOUDFLARE_API_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    url = f'{API_BASE}{endpoint}'
    
    if method == 'GET':
        response = requests.get(url, headers=headers)
    elif method == 'POST':
        response = requests.post(url, headers=headers, json=data)
    elif method == 'PUT':
        response = requests.put(url, headers=headers, json=data)
    elif method == 'PATCH':
        response = requests.patch(url, headers=headers, json=data)
    elif method == 'DELETE':
        response = requests.delete(url, headers=headers)
    
    result = response.json()
    
    if not result.get('success'):
        raise Exception(f"Cloudflare API Error: {result.get('errors')}")
    
    return result

# ============================================================================
# MAIN FUNCTIONS
# ============================================================================

def list_existing_rules():
    """List all existing security rules"""
    print('📋 Listing existing security rules...\n')
    
    try:
        result = make_request(f'/zones/{ZONE_ID}/rulesets/phases/http_request_firewall_custom/entrypoint')
        
        if result.get('result') and result['result'].get('rules'):
            rules = result['result']['rules']
            print(f'Found {len(rules)} existing rules:\n')
            
            for i, rule in enumerate(rules, 1):
                print(f"{i}. {rule.get('description', 'Unnamed rule')}")
                print(f"   Action: {rule.get('action')}")
                print(f"   Enabled: {rule.get('enabled')}")
                print()
        else:
            print('No existing rules found.\n')
    
    except Exception as e:
        print(f'❌ Failed to list rules: {e}\n')

def delete_all_rules():
    """Delete all existing security rules"""
    print('🗑️  Deleting all existing security rules...\n')
    
    try:
        make_request(
            f'/zones/{ZONE_ID}/rulesets/phases/http_request_firewall_custom/entrypoint',
            'PUT',
            {'rules': []}
        )
        print('✅ All rules deleted!\n')
    
    except Exception as e:
        print(f'❌ Failed to delete rules: {e}\n')

def add_security_rules():
    """Add all security rules"""
    print('🔥 Adding Cloudflare Security Rules...\n')
    
    # Get existing ruleset
    try:
        result = make_request(f'/zones/{ZONE_ID}/rulesets/phases/http_request_firewall_custom/entrypoint')
        ruleset_id = result['result']['id']
    except:
        ruleset_id = None
    
    for i, rule in enumerate(SECURITY_RULES, 1):
        try:
            print(f'📝 Adding Rule {i}/5: {rule["description"][:60]}...')
            
            # Add rule to ruleset
            make_request(
                f'/zones/{ZONE_ID}/rulesets/{ruleset_id}/rules' if ruleset_id else f'/zones/{ZONE_ID}/rulesets/phases/http_request_firewall_custom/entrypoint',
                'POST',
                rule
            )
            
            print(f'   ✅ Success!\n')
        
        except Exception as e:
            print(f'   ❌ Failed: {e}\n')
    
    print('✅ All security rules added!\n')

def configure_security_settings():
    """Configure basic security settings"""
    print('🔐 Configuring security settings...\n')

    settings = [
        ('security_level', 'medium', 'Security level set to Medium'),
        ('browser_check', 'on', 'Browser Integrity Check enabled'),
        ('always_use_https', 'on', 'Always Use HTTPS enabled'),
        ('min_tls_version', '1.2', 'Minimum TLS version set to 1.2'),
        ('tls_1_3', 'on', 'TLS 1.3 enabled'),
    ]

    for setting, value, message in settings:
        try:
            make_request(
                f'/zones/{ZONE_ID}/settings/{setting}',
                'PATCH',
                {'value': value}
            )
            print(f'✅ {message}')
        except Exception as e:
            print(f'❌ Failed to set {setting}: {e}')

    print()

def main():
    """Main execution"""
    print('\n')
    print('═══════════════════════════════════════════════════════════════')
    print('🏳️‍🌈  PRYDE SOCIAL - CLOUDFLARE SECURITY SETUP')
    print('═══════════════════════════════════════════════════════════════')
    print('\n')

    # Validate configuration
    if CLOUDFLARE_API_TOKEN == 'YOUR_API_TOKEN_HERE' or ZONE_ID == 'YOUR_ZONE_ID_HERE':
        print('❌ ERROR: Please update CLOUDFLARE_API_TOKEN and ZONE_ID in the script!\n')
        print('📝 Instructions:')
        print('1. Get API Token: https://dash.cloudflare.com/profile/api-tokens')
        print('2. Get Zone ID: https://dash.cloudflare.com (select your domain)\n')
        sys.exit(1)

    # Parse command line arguments
    args = sys.argv[1:]

    if '--list' in args:
        list_existing_rules()

    elif '--delete' in args:
        list_existing_rules()
        confirm = input('⚠️  Are you sure you want to delete ALL rules? (yes/no): ')
        if confirm.lower() == 'yes':
            delete_all_rules()
        else:
            print('Cancelled.\n')

    elif '--setup' in args:
        list_existing_rules()

        print('⚠️  WARNING: This will add 5 new security rules to your Cloudflare account.')
        print('   If you already have rules, you may exceed the free plan limit (5 rules).\n')

        if '--force' not in args:
            confirm = input('Continue? (yes/no): ')
            if confirm.lower() != 'yes':
                print('Cancelled.\n')
                sys.exit(0)

        # Delete existing rules if requested
        if '--delete' in args:
            delete_all_rules()

        # Add security rules
        add_security_rules()

        # Configure security settings
        configure_security_settings()

        print('═══════════════════════════════════════════════════════════════')
        print('✅  SETUP COMPLETE!')
        print('═══════════════════════════════════════════════════════════════')
        print('\n')
        print('🎯 Next Steps:')
        print('1. Visit https://dash.cloudflare.com and verify the rules')
        print('2. Test your website to ensure no false positives')
        print('3. Monitor Security → Events for blocked traffic')
        print('4. Update Rule 5 with your development IP address\n')

    else:
        print('Usage:')
        print('  python cloudflare-setup.py --list              # List existing rules')
        print('  python cloudflare-setup.py --delete            # Delete all existing rules')
        print('  python cloudflare-setup.py --setup             # Add all security rules')
        print('  python cloudflare-setup.py --setup --delete    # Delete old rules and add new ones')
        print('  python cloudflare-setup.py --setup --force     # Skip confirmation prompts\n')

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\n\n❌ Cancelled by user.\n')
        sys.exit(0)
    except Exception as e:
        print(f'\n❌ Fatal error: {e}\n')
        sys.exit(1)

