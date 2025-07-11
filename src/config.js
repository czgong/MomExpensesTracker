// API Configuration
// Force production URL since Vercel environment variables aren't working
const API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://mom-expenses-tracker-5uthzfi3a-czgongs-projects.vercel.app'
  : process.env.REACT_APP_API_URL || 'http://localhost:5001';

// Production configuration working correctly

export default API_URL;