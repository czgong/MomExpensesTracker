// API Configuration
// Use relative path for production to avoid CORS issues with Vercel preview URLs
const API_URL = process.env.NODE_ENV === 'production' 
  ? ''
  : process.env.REACT_APP_API_URL || 'http://localhost:5001';

// Production uses relative API paths, development uses full URL

export default API_URL;