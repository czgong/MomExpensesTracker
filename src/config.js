// API Configuration
// Force production URL since Vercel environment variables aren't working
const API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://momexpensestracker-production.up.railway.app'
  : process.env.REACT_APP_API_URL || 'http://localhost:5001';

// Debugging
console.log('=== API Configuration Debug ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
console.log('Final API_URL:', API_URL);
console.log('=== End Debug ===');

export default API_URL;