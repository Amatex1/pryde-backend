const https = require('https');
const token = '11BZZFGRY0l046baxghptq_917sJ2EB34omNUchwCnzIoAf6npT9muCvqyhT4RjLjaN4DN6JGCwMCNWPQR';
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
    'Authorization': 'token ' + token,
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
