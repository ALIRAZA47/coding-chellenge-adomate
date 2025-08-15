# Supabase Setup Guide

This app now supports Supabase for reliable cloud image storage! Here's how to set it up:

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up/Login and create a new project
3. Wait for the project to be ready

## 2. Set up Storage Bucket

1. In your Supabase dashboard, go to **Storage**
2. Create a new bucket named `images`
3. Set the bucket to **Public** (for image access)
4. **Important**: Make sure the bucket policy allows public access:
   - Click on the `images` bucket
   - Go to **Policies** tab
   - If no policies exist, create one that allows public read access
   - Or disable RLS (Row Level Security) for simple public access

## 3. Get Your Credentials

1. Go to **Settings** → **API**
2. Copy your **Project URL**
3. Copy your **anon/public API key**

## 4. Configure Environment Variables

Create a `.env.local` file in your project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

## 5. Restart Your Development Server

```bash
npm run dev
```

## ✅ Benefits of Using Supabase

- **No size limits** - Store images of any size
- **Cloud persistence** - Images persist across devices/browsers
- **Reliable storage** - Professional cloud infrastructure
- **Automatic cleanup** - Old images are automatically replaced
- **Fast CDN** - Global content delivery network

## 📱 Fallback Storage

If Supabase is not configured, the app automatically falls back to localStorage for smaller images (under 5MB). You'll see appropriate console messages indicating which storage method is being used.

## 🛠️ Troubleshooting CORS Issues

If you're getting CORS errors when accessing images:

1. **Check the correct URL format**: 
   - ❌ Wrong: `https://supabase.com/dashboard/project/xxx/storage/v1/object/images/filename.png`
   - ✅ Correct: `https://yourproject.supabase.co/storage/v1/object/public/images/filename.png`

2. **Use the proper helper functions**:
   ```javascript
   import { getImagePublicUrl } from '@/lib/supabase'
   const publicUrl = getImagePublicUrl('your-image-filename.png')
   ```

3. **Verify bucket configuration**:
   - Ensure the `images` bucket is set to **Public**
   - Check if RLS (Row Level Security) is properly configured or disabled
   - Test access in a new incognito/private browser window

4. **Next.js configuration**: The app is already configured to allow Supabase domains in `next.config.js`

## 🛠️ Optional: RLS Policies

For enhanced security, you can set up Row Level Security (RLS) policies in Supabase, but it's not required for basic functionality. If you enable RLS, make sure to create appropriate policies for public read access.
