// SECURITY: GitHub token must be provided via environment variable.
const https = require('https');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error('Error: GITHUB_TOKEN environment variable is not set.');
  process.exit(1);
}

const data = JSON.stringify({
  title: 'Backend Phase 4: Production Readiness (Redis, Health, Logging)',
  head: 'phase4-backend-prod-readiness',
  base: 'main',
  body: 'Phase 4 consolidated patch including Redis init, health endpoint, ephemeral test port, and logger-based startup.'
});
const options = {
  hostname: 'api.github.com',
  path: '/repos/Amatex1/pryde-backend/pulls',
  method: 'POST',
  headers: {
    'Authorization': 'token ' + GITHUB_TOKEN,
    'User-Agent': 'PrydeBackend',
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};
const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (d) => { body += d; });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    // Do not log the raw body if it contains potential secrets; display URL if present
    try {
      const json = JSON.parse(body);
      if (json && json.html_url) {
        console.log('PR URL:', json.html_url);
      } else {
        console.log('Response:', json);
      }
    } catch (e) {
      console.log('Raw response:', body);
    }
  });
});
req.on('error', (e) => { console.error('Error creating PR:', e); });
req.write(data);
req.end();
