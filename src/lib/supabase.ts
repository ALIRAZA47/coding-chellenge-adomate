import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

// Check if Supabase is configured
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseKey && supabase)
}

// Utility functions for image storage
export const uploadImageToSupabase = async (imageBase64: string): Promise<string> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment variables.')
  }

  try {
    console.log('🔄 Uploading image to Supabase...')
    
    // Convert base64 to blob
    const response = await fetch(imageBase64)
    const blob = await response.blob()
    
    // Generate unique filename
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 15)
    const fileName = `image_${timestamp}_${randomId}.png`
    
    console.log('📤 Uploading file:', fileName, 'Size:', Math.round(blob.size / 1024), 'KB')
    
    // Upload to Supabase Storage
    const { data, error } = await supabase!.storage
      .from('images')
      .upload(fileName, blob, {
        contentType: 'image/png',
        cacheControl: '3600'
      })
    
    if (error) {
      console.error('❌ Supabase upload error:', error)
      throw error
    }
    
    console.log('✅ Image uploaded successfully:', data.path)
    return data.path
  } catch (error) {
    console.error('❌ Failed to upload image to Supabase:', error)
    throw error
  }
}

export const getImageFromSupabase = async (imagePath: string): Promise<string> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.')
  }

  try {
    console.log('🔄 Getting image from Supabase:', imagePath)
    
    const { data, error } = await supabase!.storage
      .from('images')
      .download(imagePath)
    
    if (error) {
      console.error('❌ Supabase download error:', error)
      throw error
    }
    
    // Convert blob to base64
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(data)
    })
    
    console.log('✅ Image downloaded from Supabase, size:', Math.round(base64.length / 1024), 'KB')
    return base64
  } catch (error) {
    console.error('❌ Failed to get image from Supabase:', error)
    throw error
  }
}

export const deleteImageFromSupabase = async (imagePath: string): Promise<void> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.')
  }

  try {
    console.log('🗑️ Deleting image from Supabase:', imagePath)
    
    const { error } = await supabase!.storage
      .from('images')
      .remove([imagePath])
    
    if (error) {
      console.error('❌ Supabase delete error:', error)
      throw error
    }
    
    console.log('✅ Image deleted from Supabase')
  } catch (error) {
    console.error('❌ Failed to delete image from Supabase:', error)
    throw error
  }
}

// Get public URL for an image stored in Supabase
export const getImagePublicUrl = (imagePath: string): string => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.')
  }

  const { data } = supabase!.storage
    .from('images')
    .getPublicUrl(imagePath)
  
  return data.publicUrl
}

// Get signed URL for private access (alternative to public URL)
export const getImageSignedUrl = async (imagePath: string, expiresIn: number = 3600): Promise<string> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.')
  }

  try {
    const { data, error } = await supabase!.storage
      .from('images')
      .createSignedUrl(imagePath, expiresIn)
    
    if (error) {
      console.error('❌ Supabase signed URL error:', error)
      throw error
    }
    
    return data.signedUrl
  } catch (error) {
    console.error('❌ Failed to get signed URL from Supabase:', error)
    throw error
  }
}
