'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import { HexColorPicker } from 'react-colorful';
import { Download, Upload, Undo, Redo, Type, Layers, RotateCcw, Settings, Palette, ChevronUp, ChevronDown, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { uploadImageToSupabase, getImageFromSupabase, deleteImageFromSupabase, shouldUseSupabase, getImagePublicUrl } from '@/lib/supabase';

interface TextLayer {
  id: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  opacity: number;
  alignment: string;
  x: number;
  y: number;
  rotation: number;
  visible: boolean;
  fabricObject?: fabric.IText;
}

interface ImageLayer {
  id: string;
  type: 'background';
  name: string;
  url: string | null;
  path?: string; // Supabase path
  visible: boolean;
  thumbnail?: string;
}

interface DesignState {
  backgroundImage: string | null;
  backgroundImagePath?: string; // Path for Supabase stored images
  textLayers: TextLayer[];
  canvasWidth: number;
  canvasHeight: number;
}

interface UploadState {
  isUploading: boolean;
  tempImageUrl?: string;
}

interface LoadingState {
  canvas: boolean;
  imageLoad: boolean;
  upload: boolean;
  message?: string;
}

// const GOOGLE_FONTS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_FONTS_API_KEY || '';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FabricObject = any;

// Supabase image storage utilities are imported from @/lib/supabase

export default function ImageEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasLoadedFromStorage = useRef(false);
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [selectedTextLayer, setSelectedTextLayer] = useState<string | null>(null);
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [imageLayers, setImageLayers] = useState<ImageLayer[]>([]);
  const [history, setHistory] = useState<DesignState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [googleFonts, setGoogleFonts] = useState<string[]>([]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [currentColor, setCurrentColor] = useState('#000000');
  const [uploadState, setUploadState] = useState<UploadState>({ isUploading: false });
  const [loadingState, setLoadingState] = useState<LoadingState>({
    canvas: true,
    imageLoad: false,
    upload: false,
    message: 'Initializing canvas...'
  });

  // Load Google Fonts
  useEffect(() => {
    const loadGoogleFonts = async () => {
      try {
        const response = await fetch(`https://www.googleapis.com/webfonts/v1/webfonts?key=${process.env.NEXT_PUBLIC_GOOGLE_FONTS_API_KEY}&sort=popularity`);
        const data = await response.json();
        const fontNames = data.items?.slice(0, 50).map((font: { family: string }) => font.family) || [];
        setGoogleFonts(['Arial', 'Georgia', 'Times New Roman', 'Courier New', ...fontNames]);
      } catch (error) {
        console.error('Failed to load Google Fonts:', error);
        setGoogleFonts(['Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Helvetica']);
      }
    };
    loadGoogleFonts();
  }, []);

  // Initialize Fabric.js canvas with better error handling and timing
  useEffect(() => {
    if (!canvasRef.current) {
      console.warn('Canvas ref not available yet');
      return;
    }

    console.log('Initializing canvas with size:', canvasSize.width, 'x', canvasSize.height);
    
    let fabricCanvas: fabric.Canvas | null = null;
    let initAttempts = 0;
    const maxInitAttempts = 5;
    
    const initializeCanvas = () => {
      try {
        initAttempts++;
        console.log(`Canvas initialization attempt ${initAttempts}/${maxInitAttempts}`);
        
        if (!canvasRef.current) {
          throw new Error('Canvas ref not available');
        }
        
        // Check if canvas element is properly mounted
        if (!canvasRef.current.getContext) {
          throw new Error('Canvas context not available');
        }
        
        fabricCanvas = new fabric.Canvas(canvasRef.current, {
          width: canvasSize.width,
          height: canvasSize.height,
          backgroundColor: '#ffffff',
        });
        
        // Verify canvas was created properly
        if (!fabricCanvas || !fabricCanvas.lowerCanvasEl || !fabricCanvas.getContext) {
          throw new Error('Fabric canvas creation failed');
        }
        
        console.log('Canvas initialized successfully');
        
        // Test canvas rendering capability
        try {
          fabricCanvas.renderAll();
          console.log('Canvas render test successful');
        } catch (renderError) {
          throw new Error(`Canvas render test failed: ${renderError}`);
        }
        
        return fabricCanvas;
      } catch (error) {
        console.error(`Canvas initialization attempt ${initAttempts} failed:`, error);
        
        if (fabricCanvas) {
          try {
            fabricCanvas.dispose();
          } catch (disposeError) {
            console.warn('Error disposing failed canvas:', disposeError);
          }
          fabricCanvas = null;
        }
        
        if (initAttempts < maxInitAttempts) {
          console.log(`Retrying canvas initialization in 200ms...`);
          setTimeout(initializeCanvas, 200);
          return null;
        } else {
          console.error('Canvas initialization failed after maximum attempts');
          setLoadingState(prev => ({ 
            ...prev, 
            canvas: false, 
            message: 'Canvas initialization failed' 
          }));
          alert('Canvas failed to initialize. Please refresh the page and try again.');
          return null;
        }
      }
    };
    
    // Start initialization with a small delay to ensure DOM is ready
    const initTimer = setTimeout(() => {
      const canvas = initializeCanvas();
      if (!canvas) return;
      
            fabricCanvas = canvas;

      if (fabricCanvas) {
        // Enable snap to center
        fabricCanvas.on('object:moving', (e) => {
          const obj = e.target;
          if (!obj || !fabricCanvas) return;

          const centerX = fabricCanvas.width! / 2;
          const centerY = fabricCanvas.height! / 2;
          const threshold = 10;

          if (Math.abs(obj.left! - centerX) < threshold) {
            obj.set('left', centerX);
          }
          if (Math.abs(obj.top! - centerY) < threshold) {
            obj.set('top', centerY);
          }
        });

        // Handle object selection
        fabricCanvas.on('selection:created', (e) => {
          const obj = e.selected?.[0];
          if (obj && obj.type === 'i-text') {
            const layerId = (obj as FabricObject).layerId;
            setSelectedTextLayer(layerId);
          }
        });

        fabricCanvas.on('selection:cleared', () => {
          setSelectedTextLayer(null);
        });
      }

      if (fabricCanvas) {
        setCanvas(fabricCanvas);
        
        // Mark canvas as ready after a brief delay
        setTimeout(() => {
          setLoadingState(prev => ({ 
            ...prev, 
            canvas: false, 
            message: undefined 
          }));
          console.log('Canvas fully initialized and marked as ready');
        }, 300);
      }
    }, 100); // Initial delay to ensure DOM is fully ready

    return () => {
      clearTimeout(initTimer);
      if (fabricCanvas) {
        try {
          fabricCanvas.dispose();
          console.log('Canvas disposed successfully');
        } catch (error) {
          console.warn('Error disposing canvas:', error);
        }
      }
    };
  }, [canvasSize.width, canvasSize.height]);

  // Add to history
  const addToHistory = useCallback(() => {
    const currentState: DesignState = {
      backgroundImage,
      textLayers,
      canvasWidth: canvasSize.width,
      canvasHeight: canvasSize.height,
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(currentState);
    
    if (newHistory.length > 20) {
      newHistory.shift();
    } else {
      setHistoryIndex(historyIndex + 1);
    }
    
    setHistory(newHistory);
  }, [backgroundImage, textLayers, canvasSize, history, historyIndex]);

  const loadBackgroundImage = useCallback((imageUrl: string, fabricCanvas: fabric.Canvas, retryCount = 0) => {
    console.log('Loading background image...', `(retry: ${retryCount})`, `(imageUrl: ${imageUrl})`);
    
    setLoadingState(prev => ({ 
      ...prev, 
      imageLoad: true, 
      message: 'Loading image...' 
    }));

     // Check if canvas is ready before proceeding
    const isCanvasReady = () => {
      try {
        const checks = {
          fabricCanvas: !!fabricCanvas,
          lowerCanvasEl: !!fabricCanvas?.lowerCanvasEl,
          getContext: typeof fabricCanvas?.getContext === 'function',
          canvasContext: !!fabricCanvas?.lowerCanvasEl?.getContext,
          canvas2dContext: !!fabricCanvas?.lowerCanvasEl?.getContext?.('2d'),
          notDisposed: !(fabricCanvas as { disposed?: boolean })?.disposed
        };
        
        console.log('🔍 Canvas readiness check:', checks);
        
        const isReady = fabricCanvas && 
               fabricCanvas.lowerCanvasEl && 
               typeof fabricCanvas.getContext === 'function' && 
               fabricCanvas.lowerCanvasEl.getContext && 
               fabricCanvas.lowerCanvasEl.getContext('2d') &&
               !(fabricCanvas as { disposed?: boolean }).disposed;
               
        console.log('📊 Canvas ready result:', isReady);
        return isReady;
      } catch (error) {
        console.warn('Canvas readiness check failed:', error);
        return false;
      }
    };
    
    if (!isCanvasReady()) {
      if (retryCount < 5) { // Reduced retries, try a different approach
        console.warn(`Canvas not ready, retry ${retryCount + 1}/5`);
        setTimeout(() => {
          loadBackgroundImage(imageUrl, fabricCanvas, retryCount + 1);
        }, 500); // Shorter delay
        return;
      } else {
        console.warn('Canvas not fully ready after retries, attempting with basic checks...');
        
        // Try with more lenient checks - just require basic canvas
        if (!fabricCanvas || !fabricCanvas.lowerCanvasEl) {
          console.error('Canvas fundamentally not available');
          setLoadingState(prev => ({ 
            ...prev, 
            imageLoad: false, 
            message: 'Canvas not available' 
          }));
          alert('Canvas is not available. Please refresh the page and try again.');
          return;
        }
        
        console.log('⚠️ Proceeding with basic canvas checks...');
        // Continue with image loading despite readiness check failures
      }
    }
    
    // Load image - handle both data URLs and regular URLs
    console.log('🖼️ Loading image from URL:', imageUrl.substring(0, 100) + (imageUrl.length > 100 ? '...' : ''));
    
    // Configure CORS settings for Supabase URLs
    const imageOptions = {
      crossOrigin: imageUrl.includes('supabase.co') ? 'anonymous' as const : undefined
    };
    if (imageUrl.includes('supabase.co')) {
      console.log('🔗 Detected Supabase URL, setting CORS to anonymous');
    }
    
    console.log('🚀 Starting fabric.Image.fromURL with options:', imageOptions);
    const loadImage = fabric.Image.fromURL(imageUrl, imageOptions);
    
    loadImage.then((img) => {
      console.log('✅ Image loaded successfully:', img.width, 'x', img.height);
      console.log('📊 Image object details:', {
        width: img.width,
        height: img.height,
        src: img.getSrc?.() || 'unknown',
        crossOrigin: img.getCrossOrigin?.() || 'unknown'
      });
      
      // Calculate new canvas size maintaining aspect ratio
      const maxWidth = 1200;
      const maxHeight = 800;
      const imgWidth = img.width!;
      const imgHeight = img.height!;
      const imgAspect = imgWidth / imgHeight;
      
      let newWidth: number, newHeight: number;
      
      if (imgWidth > maxWidth || imgHeight > maxHeight) {
        if (imgAspect > maxWidth / maxHeight) {
          newWidth = maxWidth;
          newHeight = maxWidth / imgAspect;
        } else {
          newHeight = maxHeight;
          newWidth = maxHeight * imgAspect;
        }
      } else {
        newWidth = imgWidth;
        newHeight = imgHeight;
      }

      console.log('Setting canvas size to:', newWidth, 'x', newHeight);
      
      // Update canvas dimensions safely
      try {
        console.log('🔧 Attempting to set canvas dimensions...');
        // Always update state first
        setCanvasSize({ width: newWidth, height: newHeight });
        
        // Try to set canvas dimensions
        if (fabricCanvas && fabricCanvas.lowerCanvasEl) {
          fabricCanvas.setDimensions({ width: newWidth, height: newHeight });
          console.log('✅ Canvas dimensions set successfully');
        } else {
          console.warn('⚠️ Canvas element not ready for dimension setting, state updated');
        }
      } catch (error) {
        console.error('❌ Error setting canvas dimensions:', error);
        console.log('📏 Canvas size state updated despite dimension setting failure');
      }
      
      // Configure image for background
      console.log('🎨 Configuring image for background with scale:', {
        scaleX: newWidth / imgWidth,
        scaleY: newHeight / imgHeight,
        newWidth,
        newHeight,
        imgWidth,
        imgHeight
      });
      
      img.set({
        left: 0,
        top: 0,
        scaleX: newWidth / imgWidth,
        scaleY: newHeight / imgHeight,
        selectable: false,
        evented: false,
        crossOrigin: 'anonymous'
      });
      
      console.log('📐 Image configured, setting as background...');
      
      // Set as background and render
      try {
        fabricCanvas.backgroundImage = img;
        console.log('🖼️ Background image set on canvas, rendering...');
        
        fabricCanvas.renderAll();
        console.log('✅ Background image set and rendered successfully');
      } catch (renderError) {
        console.error('❌ Error setting background or rendering:', renderError);
        console.log('🔄 Attempting fallback render...');
        
        // Try a simpler approach
        try {
          fabricCanvas.backgroundImage = img;
          setTimeout(() => {
            fabricCanvas.renderAll();
            console.log('✅ Fallback render successful');
          }, 100);
        } catch (fallbackError) {
          console.error('❌ Fallback render also failed:', fallbackError);
        }
      }
      
      // Double-check that the background image was actually set
      console.log('🔍 Canvas background check:', {
        hasBackgroundImage: !!fabricCanvas.backgroundImage,
        backgroundImageType: fabricCanvas.backgroundImage?.type || 'none'
      });
      
      // Force a re-render after a short delay to ensure visibility
      setTimeout(() => {
        fabricCanvas.renderAll();
        console.log('Canvas re-rendered');
        setLoadingState(prev => ({ 
          ...prev, 
          imageLoad: false, 
          message: undefined 
        }));
      }, 100);
      
    }).catch((error) => {
      console.error('❌ Error loading image:', error);
      console.error('❌ Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        imageUrl: imageUrl.substring(0, 100) + '...'
      });
      
      // Check if it's a CORS error and try fallback
      if (error.message && (error.message.includes('CORS') || error.message.includes('cross-origin'))) {
        console.error('🚫 CORS error detected - trying fallback approach...');
        console.log('🔄 Attempting to load image via data URL fallback...');
        
        // Try to get the image as data URL from Supabase if it's a Supabase URL
        if (imageUrl.includes('supabase.co') && shouldUseSupabase()) {
          // Extract the path from the public URL
          const urlParts = imageUrl.split('/storage/v1/object/public/images/');
          if (urlParts.length > 1) {
            const imagePath = urlParts[1];
            console.log('🔄 Trying to load via data URL with path:', imagePath);
            
            getImageFromSupabase(imagePath).then(dataUrl => {
              console.log('✅ Fallback: Got data URL, retrying with data URL...');
              loadBackgroundImage(dataUrl, fabricCanvas, retryCount + 1);
            }).catch(fallbackError => {
              console.error('❌ Fallback also failed:', fallbackError);
              alert('CORS error: Unable to load image from Supabase. Please check your Supabase bucket CORS settings.');
            });
            return; // Don't continue with the original error handling
          }
        }
        
        alert('CORS error: Unable to load image from Supabase. Please check your Supabase bucket CORS settings.');
      } else if (error.message && error.message.includes('Failed to fetch')) {
        console.error('🌐 Network error detected');
        alert('Network error: Unable to load image. Please check your internet connection and try again.');
      } else {
        console.error('🔍 Unknown image loading error');
        alert('Failed to load image. Please try again or check if the image URL is accessible.');
      }
      
      setLoadingState(prev => ({ 
        ...prev, 
        imageLoad: false, 
        message: undefined 
      }));
    });
  }, []);

  const addTextToCanvas = useCallback((layer: TextLayer, fabricCanvas: fabric.Canvas) => {
    console.log('Adding text to canvas:', layer.id, layer.text);
    
    const text = new fabric.IText(layer.text, {
      left: layer.x,
      top: layer.y,
      fontFamily: layer.fontFamily,
      fontSize: layer.fontSize,
      fontWeight: layer.fontWeight,
      fill: layer.color,
      opacity: layer.opacity,
      textAlign: layer.alignment as 'left' | 'center' | 'right',
      angle: layer.rotation,
      visible: layer.visible,
    });

    (text as FabricObject).layerId = layer.id;
    
    // Update the layer with the fabricObject reference immediately
    setTextLayers(prev => prev.map(l => 
      l.id === layer.id ? { ...l, fabricObject: text } : l
    ));

    const handleTextChange = () => {
      setTextLayers(prev => prev.map(l => 
        l.id === layer.id ? { ...l, text: text.text! } : l
      ));
    };
    text.on('changed', handleTextChange);

    const handleTextMove = () => {
      setTextLayers(prev => prev.map(l => 
        l.id === layer.id ? { ...l, x: text.left!, y: text.top! } : l
      ));
    };
    text.on('moving', handleTextMove);

    const handleTextRotate = () => {
      setTextLayers(prev => prev.map(l => 
        l.id === layer.id ? { ...l, rotation: text.angle! } : l
      ));
    };
    text.on('rotating', handleTextRotate);

    fabricCanvas.add(text);
    fabricCanvas.renderAll();
    
    console.log('Text added to canvas successfully:', layer.id);
  }, []);

  // Debug function to check and fix layer references
  // Generate thumbnail for image layers
  const generateThumbnail = (imageUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        // Set thumbnail size
        const size = 48;
        canvas.width = size;
        canvas.height = size;
        
        // Calculate dimensions to maintain aspect ratio
        const aspectRatio = img.width / img.height;
        let drawWidth = size;
        let drawHeight = size;
        let offsetX = 0;
        let offsetY = 0;
        
        if (aspectRatio > 1) {
          drawHeight = size / aspectRatio;
          offsetY = (size - drawHeight) / 2;
        } else {
          drawWidth = size * aspectRatio;
          offsetX = (size - drawWidth) / 2;
        }
        
        // Draw the image
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    });
  };

  // Update image layers when background image changes
  useEffect(() => {
    if (backgroundImage) {
      generateThumbnail(backgroundImage).then(thumbnail => {
        const imageLayer: ImageLayer = {
          id: 'background-image',
          type: 'background',
          name: 'Background Image',
          url: backgroundImage,
          visible: true,
          thumbnail
        };
        setImageLayers([imageLayer]);
      }).catch(error => {
        console.warn('Failed to generate thumbnail:', error);
        const imageLayer: ImageLayer = {
          id: 'background-image',
          type: 'background',
          name: 'Background Image',
          url: backgroundImage,
          visible: true
        };
        setImageLayers([imageLayer]);
      });
    } else {
      setImageLayers([]);
    }
  }, [backgroundImage]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const debugLayerReferences = () => {
    if (!canvas) {
      console.log('No canvas available for debugging');
      return;
    }
    
    console.log('=== LAYER DEBUG INFO ===');
    console.log('Text layers count:', textLayers.length);
    console.log('Canvas objects count:', canvas.getObjects().length);
    
    textLayers.forEach((layer, index) => {
      console.log(`Layer ${index + 1}:`, {
        id: layer.id,
        text: layer.text,
        hasFabricObject: !!layer.fabricObject,
        fabricObjectLayerId: layer.fabricObject ? (layer.fabricObject as FabricObject).layerId : 'none'
      });
    });
    
    canvas.getObjects().forEach((obj, index) => {
      console.log(`Canvas object ${index + 1}:`, {
        type: obj.type,
        layerId: (obj as FabricObject).layerId || 'none'
      });
    });
    
    // Fix any missing references
    const updatedLayers = textLayers.map(layer => {
      if (!layer.fabricObject) {
        const fabricObject = canvas.getObjects().find(obj => 
          (obj as FabricObject).layerId === layer.id
        ) as fabric.IText;
        
        if (fabricObject) {
          console.log('Fixed missing reference for layer:', layer.id);
          return { ...layer, fabricObject };
        }
      }
      return layer;
    });
    
    setTextLayers(updatedLayers);
    console.log('=== END LAYER DEBUG ===');
  };



  // Load from localStorage once when canvas is ready
  useEffect(() => {
    if (!canvas || hasLoadedFromStorage.current) return;
    
    const loadFromStorage = async () => {
      console.log('=== LOADING DESIGN STATE ===');
      const saved = localStorage.getItem('imageTextComposerDesign');
      if (saved) {
        try {
          const designState: DesignState = JSON.parse(saved);
          console.log('📄 Design state loaded from localStorage');
          console.log('Has background image path:', !!designState.backgroundImagePath);
          console.log('Text layers count:', designState.textLayers.length);
          
          // Set canvas dimensions first (safely)
          if (designState.canvasWidth && designState.canvasHeight) {
            try {
              if (canvas && canvas.lowerCanvasEl) {
                canvas.setDimensions({ 
                  width: designState.canvasWidth, 
                  height: designState.canvasHeight 
                });
                setCanvasSize({ width: designState.canvasWidth, height: designState.canvasHeight });
                console.log('✅ Canvas dimensions restored:', designState.canvasWidth, 'x', designState.canvasHeight);
              } else {
                console.warn('⚠️ Canvas not ready for dimension setting, just updating state');
                setCanvasSize({ width: designState.canvasWidth, height: designState.canvasHeight });
              }
            } catch (error) {
              console.error('❌ Error setting canvas dimensions during load:', error);
              setCanvasSize({ width: designState.canvasWidth, height: designState.canvasHeight });
            }
          }
          
          // Handle background image
          let backgroundImageForCanvas: string | null = null;
          
          // Always prioritize Supabase if configured and path exists
          if (designState.backgroundImagePath && shouldUseSupabase()) {
            console.log('🖼️ Loading image from Supabase with path:', designState.backgroundImagePath);
            try {
              // Try to get the image as data URL for CORS-safe canvas loading
              backgroundImageForCanvas = await getImageFromSupabase(designState.backgroundImagePath);
              if (backgroundImageForCanvas) {
                console.log('✅ Image loaded from Supabase as data URL, size:', Math.round(backgroundImageForCanvas.length / 1024), 'KB');
                // Set the background image state to the public URL (for storage)
                setBackgroundImage(designState.backgroundImage || getImagePublicUrl(designState.backgroundImagePath));
              } else {
                console.log('❌ Image not found in Supabase');
              }
            } catch (error) {
              console.error('❌ Failed to load image from Supabase as data URL:', error);
              // Fall back to using the public URL directly
              if (designState.backgroundImage) {
                console.log('⚠️ Falling back to public URL');
                backgroundImageForCanvas = designState.backgroundImage;
                setBackgroundImage(designState.backgroundImage);
              }
            }
          } else if (designState.backgroundImage) {
            console.log('📱 Using stored background image:', designState.backgroundImage.substring(0, 50) + '...');
            
            // Use the stored image directly (could be data URL or regular URL)
            backgroundImageForCanvas = designState.backgroundImage;
            setBackgroundImage(designState.backgroundImage);
          }
          
          if (backgroundImageForCanvas) {
            console.log('🎨 Loading background image to canvas');
            
            // Wait a bit for state to update before loading to canvas
            setTimeout(() => {
              if (canvas && canvas.lowerCanvasEl && backgroundImageForCanvas) {
                // backgroundImageForCanvas can be either a data URL or regular URL
                loadBackgroundImage(backgroundImageForCanvas, canvas);
              } else {
                console.log('⏳ Canvas not ready, retrying image load...');
                setTimeout(() => {
                  if (canvas && canvas.lowerCanvasEl && backgroundImageForCanvas) {
                    loadBackgroundImage(backgroundImageForCanvas, canvas);
                  }
                }, 500);
              }
            }, 100);
          } else {
            console.log('ℹ️ No background image to restore');
          }
          
          // Restore text layers
          designState.textLayers.forEach(layer => {
            addTextToCanvas(layer, canvas);
          });
          
          setTextLayers(designState.textLayers);
          console.log('✅ Text layers restored');
          console.log('=== LOAD COMPLETE ===');
          
        } catch (error) {
          console.error('❌ Failed to load from storage:', error);
        }
      } else {
        console.log('ℹ️ No saved design state found');
      }
    };
    
    loadFromStorage();
    hasLoadedFromStorage.current = true;
  }, [canvas, loadBackgroundImage, addTextToCanvas]);

  // Ensure background image is loaded when canvas becomes ready
  useEffect(() => {
    if (!canvas || !backgroundImage || loadingState.canvas || uploadState.isUploading) {
      return;
    }
    
    // Check if canvas is ready and doesn't already have a background image
    const isCanvasReady = canvas.lowerCanvasEl && 
                          typeof canvas.getContext === 'function' && 
                          !canvas.disposed;
    
    if (isCanvasReady && !canvas.backgroundImage) {
      console.log('🔄 Canvas ready and background image pending, loading now...');
      loadBackgroundImage(backgroundImage, canvas);
    }
  }, [canvas, backgroundImage, loadingState.canvas, uploadState.isUploading, loadBackgroundImage]);

  // Autosave functionality - Always use Supabase for images
  useEffect(() => {
    if (!canvas) return;
    
    // Don't save during upload process
    if (uploadState.isUploading) {
      console.log('⏳ Skipping autosave - upload in progress');
      return;
    }

    const saveToStorage = async () => {
      try {
        console.log('=== SAVING DESIGN STATE ===');
        console.log('Background image exists:', !!backgroundImage);
        console.log('Text layers count:', textLayers.length);
        console.log('Upload state:', uploadState);
        
        const designState: DesignState = {
          backgroundImage: null, // Will be set below if there's an image
          textLayers,
          canvasWidth: canvasSize.width,
          canvasHeight: canvasSize.height,
        };
        
        // Only save if we have a stable background image (not during upload)
        if (backgroundImage && !uploadState.isUploading) {
          if (shouldUseSupabase()) {
            // Check if this image is already from Supabase (avoid re-uploading)
            const saved = localStorage.getItem('imageTextComposerDesign');
            let existingPath: string | undefined;
            
            if (saved) {
              try {
                const prevState = JSON.parse(saved);
                existingPath = prevState.backgroundImagePath;
              } catch {
                console.warn('Could not parse existing state');
              }
            }
            
            // If we already have a Supabase path for this image, don't re-upload
            if (existingPath) {
              console.log('✅ Using existing Supabase path:', existingPath);
              designState.backgroundImagePath = existingPath;
              // Store the public URL in backgroundImage
              designState.backgroundImage = getImagePublicUrl(existingPath);
              console.log('💾 Storing Supabase public URL:', designState.backgroundImage);
            } else {
              console.log('🖼️ Image needs to be uploaded to Supabase...');
              // This should only happen if the image was set directly without going through upload
              try {
                const imagePath = await uploadImageToSupabase(backgroundImage);
                designState.backgroundImagePath = imagePath;
                // Store the public URL in backgroundImage
                designState.backgroundImage = getImagePublicUrl(imagePath);
                console.log('✅ Image saved to Supabase with path:', imagePath);
                console.log('💾 Storing Supabase public URL:', designState.backgroundImage);
                
                // Delete any previous image
                if (saved) {
                  const prevState = JSON.parse(saved);
                  if (prevState.backgroundImagePath && prevState.backgroundImagePath !== imagePath) {
                    console.log('🗑️ Deleting previous image from Supabase...');
                    try {
                      await deleteImageFromSupabase(prevState.backgroundImagePath);
                    } catch (deleteError) {
                      console.warn('⚠️ Could not delete previous image:', deleteError);
                    }
                  }
                }
              } catch (supabaseError) {
                console.error('❌ Supabase save failed:', supabaseError);
                // Don't use localStorage fallback - require Supabase
                throw new Error('Failed to save image to Supabase. Please check your Supabase configuration.');
              }
            }
          } else {
            console.error('❌ Supabase not configured. Image storage requires Supabase setup.');
            // Still store the backgroundImage as data URL for non-Supabase environments
            designState.backgroundImage = backgroundImage;
            console.log('💾 Storing data URL as fallback (Supabase not configured)');
          }
        } else {
          console.log('ℹ️ No background image to save or upload in progress');
        }
        
        // Save to localStorage (lightweight now)
        const finalStateStr = JSON.stringify(designState);
        console.log('💾 Saving to localStorage, size:', Math.round(finalStateStr.length / 1024), 'KB');
        
        localStorage.setItem('imageTextComposerDesign', finalStateStr);
        console.log('✅ Design saved successfully');
        console.log('=== SAVE COMPLETE ===');
        
      } catch (error) {
        console.error('❌ Failed to save to localStorage:', error);
      }
    };

    const timer = setTimeout(saveToStorage, 2000); // Slightly longer delay for Supabase
    return () => clearTimeout(timer);
  }, [backgroundImage, textLayers, canvasSize, canvas, uploadState]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }
    
    if (!file.type.includes('png')) {
      alert('Please upload a PNG file');
      return;
    }

    if (!canvas) {
      console.error('Canvas not initialized');
      alert('Canvas not ready. Please try again.');
      return;
    }

    console.log('Loading PNG file:', file.name, file.size, 'bytes');

    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageUrl = e.target?.result as string;
      console.log('File read successfully, data URL length:', imageUrl.length);
      
      // Set upload state and temp image
      setUploadState({ isUploading: true, tempImageUrl: imageUrl });
      setLoadingState(prev => ({ 
        ...prev, 
        upload: true, 
        message: 'Preparing image...' 
      }));
      
      // Load the image to canvas immediately for user feedback
      // Use improved canvas readiness check
      const isCanvasReady = canvas && 
                            canvas.lowerCanvasEl && 
                            typeof canvas.getContext === 'function' && 
                            !canvas.disposed &&
                            !loadingState.canvas;
      
      if (isCanvasReady) {
        loadBackgroundImage(imageUrl, canvas);
      } else {
        console.log('⏳ Canvas not ready during upload, will load after Supabase upload completes');
      }
      
      try {
        if (shouldUseSupabase()) {
          console.log('🚀 Starting Supabase upload...');
          setLoadingState(prev => ({ 
            ...prev, 
            message: 'Uploading to Supabase...' 
          }));
          
          // Upload to Supabase first
          const imagePath = await uploadImageToSupabase(imageUrl);
          console.log('✅ Supabase upload completed, path:', imagePath);
          
          setLoadingState(prev => ({ 
            ...prev, 
            message: 'Retrieving uploaded image...' 
          }));
          
          // Verify the upload was successful (could use this for fallback if needed)
          console.log('✅ Upload verified, using public URL for canvas loading');
          
          setLoadingState(prev => ({ 
            ...prev, 
            message: 'Updating canvas...' 
          }));
          
          // Set the actual background image to the Supabase public URL
          const publicUrl = getImagePublicUrl(imagePath);
          console.log('🔗 Generated public URL:', publicUrl);
          setBackgroundImage(publicUrl);
          
          // Load canvas with the public URL directly (should work with CORS)
          // Use improved canvas readiness check with retry mechanism
          const tryLoadImage = (retryCount = 0) => {
            const maxRetries = 50;
            const isCanvasReady = canvas && 
                                  canvas.lowerCanvasEl && 
                                  typeof canvas.getContext === 'function' && 
                                  !canvas.disposed &&
                                  !loadingState.canvas;
            
            if (isCanvasReady) {
              console.log('✅ Canvas ready, loading image');
              loadBackgroundImage(publicUrl, canvas);
            } else if (retryCount < maxRetries) {
              console.log(`⏳ Canvas not ready, retry ${retryCount + 1}/${maxRetries} (canvas:${!!canvas}, element:${!!canvas?.lowerCanvasEl}, loading:${loadingState.canvas})`);
              setTimeout(() => tryLoadImage(retryCount + 1), 500);
            } else {
              console.error('❌ Canvas still not ready after all retries');
              // Don't show alert, just log the error - the image will be loaded when canvas becomes ready
              console.log('📌 Image will be loaded when canvas becomes available');
            }
          };
          
          tryLoadImage();
          
          console.log('✅ Upload flow completed successfully');
        } else {
          // Fallback: just use the local image
          console.log('⚠️ Supabase not configured, using local image');
          setBackgroundImage(imageUrl);
        }
      } catch (error) {
        console.error('❌ Upload failed:', error);
        // Keep the temp image as fallback
        setBackgroundImage(imageUrl);
        setLoadingState(prev => ({ 
          ...prev, 
          message: 'Upload failed, using local image' 
        }));
        alert('Failed to upload to Supabase. Using local image as fallback.');
      } finally {
        // Clear upload state
        setUploadState({ isUploading: false });
        setTimeout(() => {
          setLoadingState(prev => ({ 
            ...prev, 
            upload: false, 
            message: undefined 
          }));
        }, 1000);
      }
      
      // Clear the file input so the same file can be selected again
      event.target.value = '';
      
      addToHistory();
    };
    
    reader.onerror = (error) => {
      console.error('FileReader error:', error);
      alert('Failed to read the file. Please try again.');
      setUploadState({ isUploading: false });
      setLoadingState(prev => ({ 
        ...prev, 
        upload: false, 
        imageLoad: false, 
        message: undefined 
      }));
    };
    
    reader.readAsDataURL(file);
  };

  const addTextLayer = () => {
    if (!canvas) return;

    const newLayer: TextLayer = {
      id: Date.now().toString(),
      text: 'New Text',
      fontFamily: 'Arial',
      fontSize: 32,
      fontWeight: 'normal',
      color: '#000000',
      opacity: 1,
      alignment: 'left',
      x: canvas.width! / 2,
      y: canvas.height! / 2,
      rotation: 0,
      visible: true,
    };

    addTextToCanvas(newLayer, canvas);
    setTextLayers([...textLayers, newLayer]);
    setSelectedTextLayer(newLayer.id);
    addToHistory();
  };

  const updateTextLayer = (layerId: string, updates: Partial<TextLayer>) => {
    setTextLayers(layers => 
      layers.map(layer => {
        if (layer.id === layerId) {
          const updatedLayer = { ...layer, ...updates };
          
          if (layer.fabricObject) {
            layer.fabricObject.set({
              text: updatedLayer.text,
              fontFamily: updatedLayer.fontFamily,
              fontSize: updatedLayer.fontSize,
              fontWeight: updatedLayer.fontWeight,
              fill: updatedLayer.color,
              opacity: updatedLayer.opacity,
              textAlign: updatedLayer.alignment as 'left' | 'center' | 'right',
              left: updatedLayer.x,
              top: updatedLayer.y,
              angle: updatedLayer.rotation,
              visible: updatedLayer.visible,
            });
            canvas?.renderAll();
          }
          
          return updatedLayer;
        }
        return layer;
      })
    );
  };

  const toggleLayerVisibility = (layerId: string) => {
    const layer = textLayers.find(l => l.id === layerId);
    if (layer) {
      updateTextLayer(layerId, { visible: !layer.visible });
    }
  };

  const deleteTextLayer = (layerId: string) => {
    const layer = textLayers.find(l => l.id === layerId);
    if (layer?.fabricObject) {
      canvas?.remove(layer.fabricObject);
    }
    setTextLayers(layers => layers.filter(l => l.id !== layerId));
    setSelectedTextLayer(null);
    addToHistory();
  };

  const moveLayerUp = (layerId: string) => {
    console.log('Moving layer up:', layerId);
    
    // Find current layer index in the array
    const currentIndex = textLayers.findIndex(l => l.id === layerId);
    if (currentIndex === -1) {
      console.warn('Layer not found:', layerId);
      return;
    }
    
    // Can't move up if already at the top (highest z-index)
    if (currentIndex === textLayers.length - 1) {
      console.log('Layer already at top:', layerId);
      return;
    }
    
    if (!canvas) {
      console.warn('Canvas not available');
      return;
    }
    
    // Update the text layers array order
    const newTextLayers = [...textLayers];
    const [movedLayer] = newTextLayers.splice(currentIndex, 1);
    newTextLayers.splice(currentIndex + 1, 0, movedLayer);
    setTextLayers(newTextLayers);
    
    // Update fabric canvas z-order
    const layer = textLayers[currentIndex];
    let fabricObject = layer.fabricObject;
    
    if (!fabricObject) {
      console.log('FabricObject reference lost, searching by layerId');
      fabricObject = canvas.getObjects().find(obj => (obj as FabricObject).layerId === layerId) as fabric.IText;
      
      if (fabricObject) {
        // Update the layer reference
        setTextLayers(prev => prev.map(l => 
          l.id === layerId ? { ...l, fabricObject } : l
        ));
      }
    }
    
    if (fabricObject) {
      canvas.bringObjectForward(fabricObject);
      canvas.renderAll();
      console.log('Layer moved up successfully:', layerId);
      addToHistory();
    } else {
      console.warn('FabricObject not found for layer:', layerId);
    }
  };

  const moveLayerDown = (layerId: string) => {
    console.log('Moving layer down:', layerId);
    
    // Find current layer index in the array
    const currentIndex = textLayers.findIndex(l => l.id === layerId);
    if (currentIndex === -1) {
      console.warn('Layer not found:', layerId);
      return;
    }
    
    // Can't move down if already at the bottom (lowest z-index)
    if (currentIndex === 0) {
      console.log('Layer already at bottom:', layerId);
      return;
    }
    
    if (!canvas) {
      console.warn('Canvas not available');
      return;
    }
    
    // Update the text layers array order
    const newTextLayers = [...textLayers];
    const [movedLayer] = newTextLayers.splice(currentIndex, 1);
    newTextLayers.splice(currentIndex - 1, 0, movedLayer);
    setTextLayers(newTextLayers);
    
    // Update fabric canvas z-order
    const layer = textLayers[currentIndex];
    let fabricObject = layer.fabricObject;
    
    if (!fabricObject) {
      console.log('FabricObject reference lost, searching by layerId');
      fabricObject = canvas.getObjects().find(obj => (obj as FabricObject).layerId === layerId) as fabric.IText;
      
      if (fabricObject) {
        // Update the layer reference
        setTextLayers(prev => prev.map(l => 
          l.id === layerId ? { ...l, fabricObject } : l
        ));
      }
    }
    
    if (fabricObject) {
      canvas.sendObjectBackwards(fabricObject);
      canvas.renderAll();
      console.log('Layer moved down successfully:', layerId);
      addToHistory();
    } else {
      console.warn('FabricObject not found for layer:', layerId);
    }
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      restoreState(prevState);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      restoreState(nextState);
      setHistoryIndex(historyIndex + 1);
    }
  };

  const restoreState = (state: DesignState) => {
    if (!canvas) return;

    try {
      // Check if canvas is properly initialized before clearing
      if (canvas.lowerCanvasEl && canvas.getContext && canvas.getContext()) {
        canvas.clear();
        setBackgroundImage(state.backgroundImage);
        setCanvasSize({ width: state.canvasWidth, height: state.canvasHeight });
        canvas.setDimensions({ width: state.canvasWidth, height: state.canvasHeight });
        
        if (state.backgroundImage) {
          loadBackgroundImage(state.backgroundImage, canvas);
        }
        
        state.textLayers.forEach(layer => {
          addTextToCanvas(layer, canvas);
        });
        
        setTextLayers(state.textLayers);
        console.log('✅ State restored successfully');
      } else {
        console.warn('⚠️ Canvas not properly initialized for state restore');
        // Still update the state even if canvas operations fail
        setBackgroundImage(state.backgroundImage);
        setCanvasSize({ width: state.canvasWidth, height: state.canvasHeight });
        setTextLayers(state.textLayers);
      }
    } catch (error) {
      console.error('❌ Error during state restore:', error);
      // Continue with state updates even if canvas operations fail
      setBackgroundImage(state.backgroundImage);
      setCanvasSize({ width: state.canvasWidth, height: state.canvasHeight });
      setTextLayers(state.textLayers);
    }
  };

  const exportImage = () => {
    if (!canvas) {
      alert('Canvas not available for export. Please try again.');
      return;
    }

    try {
      // Check if canvas is properly initialized before exporting
      if (canvas.lowerCanvasEl && canvas.getContext && canvas.getContext()) {
        const dataURL = canvas.toDataURL({
          format: 'png',
          quality: 1,
          multiplier: 1,
        });

        const link = document.createElement('a');
        link.download = 'image-text-composition.png';
        link.href = dataURL;
        link.click();
        console.log('✅ Image exported successfully');
      } else {
        console.error('❌ Canvas not properly initialized for export');
        alert('Canvas is not ready for export. Please try again in a moment.');
      }
    } catch (error) {
      console.error('❌ Error during image export:', error);
      alert('Failed to export image. Please try again.');
    }
  };

  const resetDesign = async () => {
    console.log('🗑️ Resetting design...');
    
    // Delete image from Supabase if exists
    try {
      const saved = localStorage.getItem('imageTextComposerDesign');
      if (saved) {
        const designState = JSON.parse(saved);
        if (designState.backgroundImagePath) {
          console.log('🗑️ Deleting image from Supabase...');
          await deleteImageFromSupabase(designState.backgroundImagePath);
          console.log('✅ Supabase image deleted successfully');
        }
      }
    } catch (error) {
      console.error('❌ Failed to delete image from Supabase:', error);
    }
    
    localStorage.removeItem('imageTextComposerDesign');
    localStorage.removeItem('imageTextComposerHasLargeImage');
    
    setBackgroundImage(null);
    setTextLayers([]);
    setImageLayers([]);
    setSelectedTextLayer(null);
    setHistory([]);
    setHistoryIndex(-1);
    setCanvasSize({ width: 800, height: 600 });
    
    if (canvas) {
      try {
        // Check if canvas is properly initialized before clearing
        if (canvas.lowerCanvasEl && canvas.getContext && canvas.getContext()) {
          canvas.clear();
          canvas.setDimensions({ width: 800, height: 600 });
          canvas.backgroundColor = '#ffffff';
          canvas.renderAll();
          console.log('✅ Canvas reset successfully');
        } else {
          console.warn('⚠️ Canvas not properly initialized, skipping clear operation');
          // Just update the canvas size state
          setCanvasSize({ width: 800, height: 600 });
        }
      } catch (error) {
        console.error('❌ Error during canvas reset:', error);
        // Continue with state reset even if canvas operations fail
      }
    }
    
    console.log('✅ Design reset complete');
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              redo();
            } else {
              undo();
            }
            break;
          case 'y':
            e.preventDefault();
            redo();
            break;
        }
      }

      // Arrow key nudging
      if (selectedTextLayer && canvas) {
        const layer = textLayers.find(l => l.id === selectedTextLayer);
        if (layer?.fabricObject) {
          let moved = false;
          switch (e.key) {
            case 'ArrowUp':
              layer.fabricObject.set('top', layer.fabricObject.top! - 1);
              moved = true;
              break;
            case 'ArrowDown':
              layer.fabricObject.set('top', layer.fabricObject.top! + 1);
              moved = true;
              break;
            case 'ArrowLeft':
              layer.fabricObject.set('left', layer.fabricObject.left! - 1);
              moved = true;
              break;
            case 'ArrowRight':
              layer.fabricObject.set('left', layer.fabricObject.left! + 1);
              moved = true;
              break;
          }
          if (moved) {
            e.preventDefault();
            canvas.renderAll();
            updateTextLayer(selectedTextLayer, {
              x: layer.fabricObject.left!,
              y: layer.fabricObject.top!,
            });
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTextLayer, textLayers, canvas, undo, redo, historyIndex, history]); // updateTextLayer is stable

  const selectedLayer = textLayers.find(l => l.id === selectedTextLayer);

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r bg-card shadow-sm overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Image Text Composer</h1>
            <p className="text-sm text-muted-foreground">Create beautiful text overlays on your images</p>
          </div>
          
          {/* Upload Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Image Upload</CardTitle>
              <CardDescription>Upload a PNG image to get started</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
                variant="outline"
                disabled={loadingState.upload || loadingState.canvas}
              >
                {loadingState.upload ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-2"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Choose PNG File
                  </>
                )}
              </Button>
              {(loadingState.upload || loadingState.imageLoad) && loadingState.message && (
                <div className="mt-2 text-sm text-primary flex items-center">
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent mr-2"></div>
                  {loadingState.message}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".png"
                onChange={handleImageUpload}
                className="hidden"
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button
                  onClick={undo}
                  disabled={historyIndex <= 0}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <Undo className="w-4 h-4 mr-1" />
                  Undo
                </Button>
                <Button
                  onClick={redo}
                  disabled={historyIndex >= history.length - 1}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <Redo className="w-4 h-4 mr-1" />
                  Redo
                </Button>
              </div>
              
              <Button
                onClick={addTextLayer}
                className="w-full"
              >
                <Type className="w-4 h-4 mr-2" />
                Add Text Layer
              </Button>

              <div className="flex gap-2">
                <Button
                  onClick={exportImage}
                  disabled={!backgroundImage}
                  variant="secondary"
                  className="flex-1"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Export
                </Button>
                <Button
                  onClick={resetDesign}
                  variant="destructive"
                  size="sm"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Text Properties & Layers */}
          <Tabs defaultValue="properties" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="properties" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Properties
              </TabsTrigger>
              <TabsTrigger value="layers" className="flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Layers
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="properties" className="mt-4">
              {selectedLayer ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Text Properties</CardTitle>
                    <CardDescription>Customize the selected text layer</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="text-content">Text</Label>
                      <textarea
                        id="text-content"
                        value={selectedLayer.text}
                        onChange={(e) => updateTextLayer(selectedLayer.id, { text: e.target.value })}
                        className="w-full p-2 border rounded-md resize-none"
                        rows={3}
                        placeholder="Enter your text..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="font-family">Font Family</Label>
                      <Select
                        value={selectedLayer.fontFamily}
                        onValueChange={(value) => updateTextLayer(selectedLayer.id, { fontFamily: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {googleFonts.map(font => (
                            <SelectItem key={font} value={font}>{font}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="font-size">Size</Label>
                        <Input
                          id="font-size"
                          type="number"
                          value={selectedLayer.fontSize}
                          onChange={(e) => updateTextLayer(selectedLayer.id, { fontSize: parseInt(e.target.value) })}
                          min="8"
                          max="200"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="font-weight">Weight</Label>
                        <Select
                          value={selectedLayer.fontWeight}
                          onValueChange={(value) => updateTextLayer(selectedLayer.id, { fontWeight: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="bold">Bold</SelectItem>
                            <SelectItem value="lighter">Light</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Color</Label>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-12 h-10 p-0 relative"
                          onClick={() => {
                            setCurrentColor(selectedLayer.color);
                            setShowColorPicker(!showColorPicker);
                          }}
                        >
                          <div
                            className="w-full h-full rounded-sm"
                            style={{ backgroundColor: selectedLayer.color }}
                          />
                          <Palette className="w-3 h-3 absolute bottom-0 right-0 bg-background rounded-tl" />
                        </Button>
                        <Input
                          value={selectedLayer.color}
                          onChange={(e) => updateTextLayer(selectedLayer.id, { color: e.target.value })}
                          className="flex-1"
                          placeholder="#000000"
                        />
                      </div>
                      {showColorPicker && (
                        <div className="mt-2 p-3 border rounded-lg bg-popover">
                          <HexColorPicker
                            color={currentColor}
                            onChange={(color) => {
                              setCurrentColor(color);
                              updateTextLayer(selectedLayer.id, { color });
                            }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-2"
                            onClick={() => setShowColorPicker(false)}
                          >
                            Done
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Opacity</Label>
                        <span className="text-sm text-muted-foreground">
                          {Math.round(selectedLayer.opacity * 100)}%
                        </span>
                      </div>
                      <Slider
                        value={[selectedLayer.opacity]}
                        onValueChange={([value]) => updateTextLayer(selectedLayer.id, { opacity: value })}
                        max={1}
                        min={0}
                        step={0.1}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="alignment">Alignment</Label>
                      <Select
                        value={selectedLayer.alignment}
                        onValueChange={(value) => updateTextLayer(selectedLayer.id, { alignment: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="center">Center</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center text-muted-foreground">
                      <Type className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>Select a text layer to edit its properties</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="layers" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Layer Management</CardTitle>
                  <CardDescription>Organize and control all layers in your design</CardDescription>
                </CardHeader>
                <CardContent>
                  {(imageLayers.length > 0 || textLayers.length > 0) ? (
                    <div className="space-y-2">
                      {/* Text Layers - rendered in reverse order (top layer first) */}
                      {[...textLayers].reverse().map((layer, index) => {
                        const actualIndex = textLayers.length - 1 - index;
                        return (
                          <div
                            key={layer.id}
                            className={cn(
                              "p-3 border rounded-lg cursor-pointer transition-colors",
                              selectedTextLayer === layer.id 
                                ? "bg-primary/10 border-primary" 
                                : "bg-background hover:bg-muted/50"
                            )}
                            onClick={() => setSelectedTextLayer(layer.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                {/* Text Layer Icon/Preview */}
                                <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                                  <Type className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium truncate">
                                      {layer.text || 'Empty Text'}
                                    </p>
                                    <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                                      Text
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {layer.fontFamily} • {layer.fontSize}px • Layer {actualIndex + 1}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 ml-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleLayerVisibility(layer.id);
                                      }}
                                      className="h-6 w-6 p-0"
                                    >
                                      {layer.visible ? (
                                        <Eye className="w-3 h-3" />
                                      ) : (
                                        <EyeOff className="w-3 h-3" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{layer.visible ? "Hide layer" : "Show layer"}</p>
                                  </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        moveLayerUp(layer.id);
                                      }}
                                      disabled={actualIndex === textLayers.length - 1}
                                      className="h-6 w-6 p-0"
                                    >
                                      <ChevronUp className="w-3 h-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Move layer up</p>
                                  </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        moveLayerDown(layer.id);
                                      }}
                                      disabled={actualIndex === 0}
                                      className="h-6 w-6 p-0"
                                    >
                                      <ChevronDown className="w-3 h-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Move layer down</p>
                                  </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteTextLayer(layer.id);
                                      }}
                                      className="text-destructive hover:text-destructive h-6 w-6 p-0"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Delete layer</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Image Layers */}
                      {imageLayers.map((layer) => (
                        <div
                          key={layer.id}
                          className="p-3 border rounded-lg bg-background hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {/* Image Thumbnail */}
                              <div className="w-10 h-10 bg-muted rounded-md overflow-hidden flex-shrink-0">
                                {layer.thumbnail ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img 
                                    src={layer.thumbnail} 
                                    alt={layer.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Type className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium truncate">
                                    {layer.name}
                                  </p>
                                  <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">
                                    Image
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Background • Always bottom layer
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1 ml-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Toggle background image visibility
                                      if (canvas && canvas.backgroundImage) {
                                        const newVisibility = !layer.visible;
                                        canvas.backgroundImage.visible = newVisibility;
                                        canvas.renderAll();
                                        setImageLayers(prev => prev.map(l => 
                                          l.id === layer.id ? { ...l, visible: newVisibility } : l
                                        ));
                                      }
                                    }}
                                    className="h-6 w-6 p-0"
                                  >
                                    {layer.visible ? (
                                      <Eye className="w-3 h-3" />
                                    ) : (
                                      <EyeOff className="w-3 h-3" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{layer.visible ? "Hide background" : "Show background"}</p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled
                                    className="h-6 w-6 p-0"
                                  >
                                    <ChevronUp className="w-3 h-3 opacity-30" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Background images cannot be moved</p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled
                                    className="h-6 w-6 p-0"
                                  >
                                    <ChevronDown className="w-3 h-3 opacity-30" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Background images cannot be moved</p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm('Are you sure you want to remove the background image?')) {
                                        setBackgroundImage(null);
                                        setImageLayers([]);
                                        if (canvas) {
                                          canvas.backgroundImage = undefined;
                                          canvas.renderAll();
                                        }
                                      }
                                    }}
                                    className="text-destructive hover:text-destructive h-6 w-6 p-0"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Remove background image</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No layers yet</p>
                      <p className="text-xs">Upload an image or add text to get started</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 flex items-center justify-center p-8 bg-muted/30">
        <Card className="p-4 shadow-lg relative">
          <canvas
            ref={canvasRef}
            className="border border-border rounded-md"
            style={{ maxWidth: '100%', maxHeight: '100%' }}
            width={canvasSize.width}
            height={canvasSize.height}
          />
          
          {/* Loading Overlay */}
          {(loadingState.canvas || loadingState.imageLoad || loadingState.upload) && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-md">
              <div className="text-center p-6">
                <div className="relative">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
                  {loadingState.upload && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Upload className="w-6 h-6 text-primary" />
                    </div>
                  )}
                </div>
                <p className="text-lg font-medium text-foreground">
                  {loadingState.message || 'Loading...'}
                </p>
                {loadingState.upload && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Please wait while we process your image
                  </p>
                )}
              </div>
            </div>
          )}
          
          {!backgroundImage && !loadingState.canvas && !loadingState.imageLoad && !loadingState.upload && (
            <div className="absolute inset-4 flex items-center justify-center text-muted-foreground pointer-events-none">
              <div className="text-center">
                <Upload className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Upload a PNG image to get started</p>
                <p className="text-sm">Click &quot;Choose PNG File&quot; in the sidebar</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
    </TooltipProvider>
  );
}