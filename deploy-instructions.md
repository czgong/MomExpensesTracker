# 🚀 Deploy Your Family Expense Tracker

## Option 1: Railway (Easiest - One Platform)

### Step 1: Prepare Your Code
```bash
# Create production build
npm run build

# Test locally first
cd server && npm start
# Open another terminal
npm start  # (from main directory)
```

### Step 2: Deploy to Railway
1. Go to https://railway.app
2. Sign up with GitHub
3. Click "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-detect both frontend and backend

### Step 3: Configure Environment Variables
In Railway dashboard, add these variables:
- `NODE_ENV=production`
- `PORT=5001` (for backend)
- `REACT_APP_API_URL=https://your-backend-url.railway.app`

### Step 4: Update API URLs
In your React app, update fetch calls to use environment variable:
```javascript
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
// Replace all fetch('/api/...') with fetch(`${API_URL}/api/...`)
```

## Option 2: Vercel + Railway (More Control)

### Frontend (Vercel)
1. Go to https://vercel.com
2. Import GitHub repository
3. Set build command: `npm run build`
4. Deploy!

### Backend (Railway)  
1. Go to https://railway.app
2. Deploy `/server` directory
3. Add environment variables

## Option 3: Netlify (Frontend Only)
If you want to keep using Supabase directly:
1. Build your app: `npm run build`
2. Drag `build` folder to https://netlify.com
3. Done!

## 📱 Mobile-Friendly Setup

Your app is already mobile-responsive! Your family can:
- Bookmark the website on phones
- Add to home screen (works like an app)
- Use on tablets, phones, computers

## 🔐 Security Notes

- Supabase handles authentication
- Your API keys are already properly configured
- HTTPS is automatic with these platforms

## 💡 Tips for Family Use

1. **Share the URL** with family members
2. **Create a family group chat** to share the link
3. **Set up notifications** for new expenses (future feature)
4. **Regular backups** via CSV export

## 🆘 Need Help?

- Railway docs: https://docs.railway.app
- Vercel docs: https://vercel.com/docs
- Your app includes CSV import/export for data portability