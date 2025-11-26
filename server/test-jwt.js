import jwt from 'jsonwebtoken';

// The NEW token from your fresh login
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTIyZGE0Yzg3N2Q4OTU3OGJiM2UzODkiLCJzZXNzaW9uSWQiOiI2NzQ1YzU5ZDI5YzI5YjI5ZjI5Yzk1NzMiLCJpYXQiOjE3MzI1ODY5MDksImV4cCI6MTczMzE5MTcwOX0.VFO_Gnyw8I_XwokdgcRl72cV4Ph07fWsHqcmECxBViI';

const secret1 = 'your-super-secret-jwt-key-change-this';
const secret2 = 'your-secret-key';

console.log('Testing JWT verification...\n');

try {
  const decoded1 = jwt.verify(token, secret1);
  console.log('✅ Token verified with secret1:', secret1);
  console.log('Decoded:', decoded1);
} catch (error) {
  console.log('❌ Token verification failed with secret1:', error.message);
}

console.log('\n---\n');

try {
  const decoded2 = jwt.verify(token, secret2);
  console.log('✅ Token verified with secret2:', secret2);
  console.log('Decoded:', decoded2);
} catch (error) {
  console.log('❌ Token verification failed with secret2:', error.message);
}

// Also decode without verification to see the payload
console.log('\n---\n');
console.log('Token payload (unverified):');
const decoded = jwt.decode(token);
console.log(decoded);

