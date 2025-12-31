# Deployment Guide

## Netlify Deployment

This project is configured to deploy the frontend to Netlify.

### Prerequisites

1. A Netlify account
2. Node.js 20+ installed locally (for testing)
3. Environment variables configured

### Environment Variables

Set the following environment variables in Netlify:

- `NEXT_PUBLIC_API_URL` - Your backend API URL (e.g., `https://api.yourdomain.com/api/v1`)
- Any other environment variables your app needs

### Deployment Steps

1. **Connect Repository to Netlify**
   - Go to Netlify dashboard
   - Click "Add new site" → "Import an existing project"
   - Connect your Git repository
   - Select the branch to deploy (usually `main`)

2. **Configure Build Settings**
   - Build command: `cd frontend && npm install && npm run build`
   - Publish directory: `frontend/.next`
   - Base directory: (leave empty or set to root)

3. **Set Environment Variables**
   - Go to Site settings → Environment variables
   - Add all required environment variables

4. **Deploy**
   - Netlify will automatically deploy on every push to the main branch
   - Or trigger a manual deploy from the dashboard

### Build Configuration

The project uses:
- **Next.js 15.5.9** with standalone output
- **Node.js 20** runtime
- **@netlify/plugin-nextjs** for optimal Next.js support

### Troubleshooting

- If build fails, check the build logs in Netlify dashboard
- Ensure all environment variables are set
- Verify Node.js version is 20+
- Check that all dependencies are properly installed

