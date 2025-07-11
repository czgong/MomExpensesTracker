// API Configuration
// Use same domain for frontend and API
const API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://mom-expenses-tracker.vercel.app'
  : process.env.REACT_APP_API_URL || 'http://localhost:5001';

// Production configuration working correctly

export default API_URL;