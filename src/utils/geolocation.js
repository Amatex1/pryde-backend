// List of countries where same-sex relationships are criminalized
// Source: ILGA World (International Lesbian, Gay, Bisexual, Trans and Intersex Association)
const HIGH_RISK_COUNTRIES = [
  // Africa
  'DZ', 'AO', 'BW', 'BI', 'CM', 'KM', 'EG', 'ER', 'ET', 'GM', 'GH', 'GN', 'KE', 'LR', 'LY', 
  'MW', 'MR', 'MU', 'MA', 'MZ', 'NA', 'NG', 'SN', 'SC', 'SL', 'SO', 'SS', 'SD', 'TZ', 'TG', 
  'TN', 'UG', 'ZM', 'ZW',
  
  // Asia
  'AF', 'BD', 'BN', 'BT', 'ID', 'IR', 'IQ', 'KW', 'LB', 'MY', 'MV', 'MM', 'OM', 'PK', 'PS', 
  'QA', 'SA', 'SG', 'LK', 'SY', 'TM', 'AE', 'UZ', 'YE',
  
  // Caribbean
  'AG', 'BB', 'DM', 'GD', 'GY', 'JM', 'KN', 'LC', 'VC', 'TT',
  
  // Oceania
  'CK', 'KI', 'PG', 'WS', 'SB', 'TO', 'TV',
  
  // Other
  'RU' // Russia has anti-LGBTQ+ laws
];

// Countries with death penalty for same-sex relationships
const EXTREME_RISK_COUNTRIES = [
  'AF', 'BN', 'IR', 'MR', 'NG', 'QA', 'SA', 'SO', 'AE', 'YE'
];

/**
 * Detect user's country using IP geolocation
 * Returns country code (ISO 3166-1 alpha-2)
 */
export async function detectUserCountry() {
  try {
    // Try multiple free geolocation APIs
    const apis = [
      'https://ipapi.co/json/',
      'https://ip-api.com/json/',
      'https://ipwhois.app/json/'
    ];

    for (const apiUrl of apis) {
      try {
        const response = await fetch(apiUrl);
        if (response.ok) {
          const data = await response.json();
          const countryCode = data.country_code || data.countryCode || data.country;
          if (countryCode) {
            return countryCode.toUpperCase();
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch from ${apiUrl}:`, err);
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error('Geolocation detection failed:', error);
    return null;
  }
}

/**
 * Check if a country is high-risk for LGBTQ+ individuals
 */
export function isHighRiskCountry(countryCode) {
  if (!countryCode) return false;
  return HIGH_RISK_COUNTRIES.includes(countryCode.toUpperCase());
}

/**
 * Check if a country has extreme risk (death penalty)
 */
export function isExtremeRiskCountry(countryCode) {
  if (!countryCode) return false;
  return EXTREME_RISK_COUNTRIES.includes(countryCode.toUpperCase());
}

/**
 * Get risk level for a country
 * Returns: 'safe', 'high', or 'extreme'
 */
export function getRiskLevel(countryCode) {
  if (!countryCode) return 'safe';
  
  const code = countryCode.toUpperCase();
  
  if (EXTREME_RISK_COUNTRIES.includes(code)) {
    return 'extreme';
  }
  
  if (HIGH_RISK_COUNTRIES.includes(code)) {
    return 'high';
  }
  
  return 'safe';
}

/**
 * Get safety recommendations based on risk level
 */
export function getSafetyRecommendations(riskLevel) {
  if (riskLevel === 'extreme') {
    return {
      title: '⚠️ EXTREME RISK DETECTED',
      message: 'You appear to be in a country where same-sex relationships may result in severe penalties including death penalty.',
      recommendations: [
        '🚨 DO NOT use real names or photos',
        '🚨 DO NOT share any identifying information',
        '🚨 Turn off online status and last seen immediately',
        '🚨 Disable location services',
        '🚨 Use a VPN at all times',
        '🚨 Consider deactivating your account if you feel unsafe',
        '🚨 Be extremely cautious about who you connect with'
      ],
      color: '#dc3545'
    };
  }
  
  if (riskLevel === 'high') {
    return {
      title: '⚠️ HIGH RISK DETECTED',
      message: 'You appear to be in a country where same-sex relationships are criminalized.',
      recommendations: [
        '⚠️ Do not use real names or photos',
        '⚠️ Do not share identifying details (location, workplace, school)',
        '⚠️ Turn off online status and last seen',
        '⚠️ Avoid enabling location',
        '⚠️ Use a VPN if possible',
        '⚠️ Be cautious about who you connect with',
        '⚠️ Verify identities before sharing personal information'
      ],
      color: '#ff8c00'
    };
  }
  
  return null;
}

/**
 * Store user's country preference in localStorage
 */
export function storeCountryPreference(countryCode) {
  try {
    localStorage.setItem('pryde_user_country', countryCode);
  } catch (error) {
    console.error('Failed to store country preference:', error);
  }
}

/**
 * Get stored country preference
 */
export function getStoredCountry() {
  try {
    return localStorage.getItem('pryde_user_country');
  } catch (error) {
    return null;
  }
}

