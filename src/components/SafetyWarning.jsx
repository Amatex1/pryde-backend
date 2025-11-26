import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './SafetyWarning.css';
import { 
  detectUserCountry, 
  getRiskLevel, 
  getSafetyRecommendations,
  storeCountryPreference,
  getStoredCountry
} from '../utils/geolocation';

function SafetyWarning() {
  const [show, setShow] = useState(false);
  const [riskLevel, setRiskLevel] = useState('safe');
  const [recommendations, setRecommendations] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkLocation();
  }, []);

  const checkLocation = async () => {
    try {
      // Check if user has already dismissed the warning
      const dismissedWarning = localStorage.getItem('pryde_safety_warning_dismissed');
      if (dismissedWarning) {
        setDismissed(true);
        return;
      }

      // Try to get stored country first
      let countryCode = getStoredCountry();

      // If no stored country, detect it
      if (!countryCode) {
        countryCode = await detectUserCountry();
        if (countryCode) {
          storeCountryPreference(countryCode);
        }
      }

      if (countryCode) {
        const level = getRiskLevel(countryCode);
        setRiskLevel(level);

        if (level !== 'safe') {
          const recs = getSafetyRecommendations(level);
          setRecommendations(recs);
          setShow(true);
        }
      }
    } catch (error) {
      console.error('Failed to check location:', error);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    localStorage.setItem('pryde_safety_warning_dismissed', 'true');
  };

  const handleGoToSafety = () => {
    navigate('/safety');
    setShow(false);
  };

  const handleGoToSettings = () => {
    navigate('/settings');
    setShow(false);
  };

  if (!show || !recommendations || dismissed) {
    return null;
  }

  return (
    <div className="safety-warning-overlay">
      <div className="safety-warning-modal" style={{ borderColor: recommendations.color }}>
        <div className="safety-warning-header" style={{ background: recommendations.color }}>
          <h2>{recommendations.title}</h2>
        </div>

        <div className="safety-warning-content">
          <p className="safety-warning-message">{recommendations.message}</p>

          <div className="safety-recommendations">
            <h3>Safety Recommendations:</h3>
            <ul>
              {recommendations.recommendations.map((rec, index) => (
                <li key={index}>{rec}</li>
              ))}
            </ul>
          </div>

          <div className="safety-warning-notice">
            <p>
              <strong>Your safety is our priority.</strong> If you feel unsafe using this platform, 
              please consider deactivating your account or using additional privacy measures.
            </p>
          </div>
        </div>

        <div className="safety-warning-actions">
          <button 
            className="btn-safety-center"
            onClick={handleGoToSafety}
          >
            📖 Read Full Safety Guide
          </button>
          <button 
            className="btn-privacy-settings"
            onClick={handleGoToSettings}
          >
            🔒 Privacy Settings
          </button>
          <button 
            className="btn-dismiss-warning"
            onClick={handleDismiss}
          >
            I Understand
          </button>
        </div>

        <div className="safety-warning-footer">
          <small>
            This warning is based on your detected location. You can dismiss it, but we strongly 
            recommend following these safety guidelines.
          </small>
        </div>
      </div>
    </div>
  );
}

export default SafetyWarning;

