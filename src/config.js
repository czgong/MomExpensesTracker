// API Configuration
const API_URL = process.env.REACT_APP_API_URL || 'https://momexpensestracker-production.up.railway.app';

// Extensive debugging
console.log('=== API Configuration Debug ===');
console.log('process.env.REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
console.log('Final API_URL:', API_URL);
console.log('process.env.NODE_ENV:', process.env.NODE_ENV);
console.log('All REACT_APP env vars:', Object.keys(process.env).filter(key => key.startsWith('REACT_APP_')));
console.log('=== End Debug ===');

export default API_URL;