'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import { HexColorPicker } from 'react-colorful';
import { Download, Upload, Undo, Redo, Type, Layers, RotateCcw } from 'lucide-react';

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
  fabricObject?: fabric.IText;
}

interface DesignState {
  backgroundImage: string | null;
  textLayers: TextLayer[];
  canvasWidth: number;
  canvasHeight: number;
}

const GOOGLE_FONTS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_FONTS_API_KEY || '';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FabricObject = any;

export default function ImageEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [selectedTextLayer, setSelectedTextLayer] = useState<string | null>(null);
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [history, setHistory] = useState<DesignState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [googleFonts, setGoogleFonts] = useState<string[]>([]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [currentColor, setCurrentColor] = useState('#000000');

  // Load Google Fonts
  useEffect(() => {
    const loadGoogleFonts = async () => {
      try {
        const response = await fetch(`https://www.googleapis.com/webfonts/v1/webfonts?key=${GOOGLE_FONTS_API_KEY}&sort=popularity`);
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

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const fabricCanvas = new fabric.Canvas(canvasRef.current, {
      width: canvasSize.width,
      height: canvasSize.height,
      backgroundColor: '#ffffff',
    });

    // Enable snap to center
    fabricCanvas.on('object:moving', (e) => {
      const obj = e.target;
      if (!obj) return;

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

    setCanvas(fabricCanvas);

    // Load from localStorage
    loadFromStorage(fabricCanvas);

    return () => {
      fabricCanvas.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasSize]); // loadFromStorage is defined inside useEffect

  // Autosave functionality
  useEffect(() => {
    if (!canvas) return;

    const saveToStorage = () => {
      const designState: DesignState = {
        backgroundImage,
        textLayers,
        canvasWidth: canvasSize.width,
        canvasHeight: canvasSize.height,
      };
      localStorage.setItem('imageTextComposerDesign', JSON.stringify(designState));
    };

    const timer = setTimeout(saveToStorage, 1000);
    return () => clearTimeout(timer);
  }, [backgroundImage, textLayers, canvasSize, canvas]);

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

  const loadFromStorage = (fabricCanvas: fabric.Canvas) => {
    const saved = localStorage.getItem('imageTextComposerDesign');
    if (saved) {
      try {
        const designState: DesignState = JSON.parse(saved);
        setBackgroundImage(designState.backgroundImage);
        setCanvasSize({ width: designState.canvasWidth, height: designState.canvasHeight });
        
        if (designState.backgroundImage) {
          loadBackgroundImage(designState.backgroundImage, fabricCanvas);
        }
        
        // Restore text layers
        designState.textLayers.forEach(layer => {
          addTextToCanvas(layer, fabricCanvas);
        });
        
        setTextLayers(designState.textLayers);
      } catch (error) {
        console.error('Failed to load from storage:', error);
      }
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.includes('png')) {
      alert('Please upload a PNG file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      setBackgroundImage(imageUrl);
      loadBackgroundImage(imageUrl, canvas!);
      addToHistory();
    };
    reader.readAsDataURL(file);
  };

  const loadBackgroundImage = (imageUrl: string, fabricCanvas: fabric.Canvas) => {
    fabric.Image.fromURL(imageUrl).then((img) => {
      const canvasAspect = fabricCanvas.width! / fabricCanvas.height!;
      const imgAspect = img.width! / img.height!;
      
      let newWidth, newHeight;
      
      if (imgAspect > canvasAspect) {
        newWidth = Math.min(img.width!, 1200);
        newHeight = newWidth / imgAspect;
      } else {
        newHeight = Math.min(img.height!, 800);
        newWidth = newHeight * imgAspect;
      }

      setCanvasSize({ width: newWidth, height: newHeight });
      fabricCanvas.setDimensions({ width: newWidth, height: newHeight });
      
      img.set({
        left: 0,
        top: 0,
        scaleX: newWidth / img.width!,
        scaleY: newHeight / img.height!,
        selectable: false,
        evented: false,
      });
      
      fabricCanvas.backgroundImage = img;
      fabricCanvas.renderAll();
    });
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
    };

    addTextToCanvas(newLayer, canvas);
    setTextLayers([...textLayers, newLayer]);
    setSelectedTextLayer(newLayer.id);
    addToHistory();
  };

  const addTextToCanvas = (layer: TextLayer, fabricCanvas: fabric.Canvas) => {
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
    });

    (text as FabricObject).layerId = layer.id;
    layer.fabricObject = text;

    const handleTextChange = () => {
      updateTextLayer(layer.id, { text: text.text! });
    };
    text.on('changed', handleTextChange);

    const handleTextMove = () => {
      updateTextLayer(layer.id, { x: text.left!, y: text.top! });
    };
    text.on('moving', handleTextMove);

    const handleTextRotate = () => {
      updateTextLayer(layer.id, { rotation: text.angle! });
    };
    text.on('rotating', handleTextRotate);

    fabricCanvas.add(text);
    fabricCanvas.renderAll();
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
            });
            canvas?.renderAll();
          }
          
          return updatedLayer;
        }
        return layer;
      })
    );
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
    const layer = textLayers.find(l => l.id === layerId);
    if (layer?.fabricObject && canvas) {
      canvas.bringObjectForward(layer.fabricObject);
      canvas.renderAll();
    }
  };

  const moveLayerDown = (layerId: string) => {
    const layer = textLayers.find(l => l.id === layerId);
    if (layer?.fabricObject && canvas) {
      canvas.sendObjectBackwards(layer.fabricObject);
      canvas.renderAll();
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
  };

  const exportImage = () => {
    if (!canvas) return;

    const dataURL = canvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 1,
    });

    const link = document.createElement('a');
    link.download = 'image-text-composition.png';
    link.href = dataURL;
    link.click();
  };

  const resetDesign = () => {
    localStorage.removeItem('imageTextComposerDesign');
    setBackgroundImage(null);
    setTextLayers([]);
    setSelectedTextLayer(null);
    setHistory([]);
    setHistoryIndex(-1);
    setCanvasSize({ width: 800, height: 600 });
    
    if (canvas) {
      canvas.clear();
      canvas.setDimensions({ width: 800, height: 600 });
      canvas.backgroundColor = '#ffffff';
      canvas.renderAll();
    }
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
    <div className="flex h-screen bg-gray-100">
      {/* Toolbar */}
      <div className="w-80 bg-white shadow-lg p-4 overflow-y-auto">
        <h1 className="text-2xl font-bold mb-6">Image Text Composer</h1>
        
        {/* Upload Section */}
        <div className="mb-6">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            <Upload size={20} />
            Upload PNG Image
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".png"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className="flex items-center gap-1 px-3 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
          >
            <Undo size={16} />
            Undo
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="flex items-center gap-1 px-3 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
          >
            <Redo size={16} />
            Redo
          </button>
        </div>

        {/* Add Text */}
        <button
          onClick={addTextLayer}
          className="w-full flex items-center justify-center gap-2 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 mb-6"
        >
          <Type size={20} />
          Add Text Layer
        </button>

        {/* Text Layer Properties */}
        {selectedLayer && (
          <div className="mb-6 p-4 border rounded">
            <h3 className="font-semibold mb-3">Text Properties</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Text</label>
                <textarea
                  value={selectedLayer.text}
                  onChange={(e) => updateTextLayer(selectedLayer.id, { text: e.target.value })}
                  className="w-full p-2 border rounded"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Font Family</label>
                <select
                  value={selectedLayer.fontFamily}
                  onChange={(e) => updateTextLayer(selectedLayer.id, { fontFamily: e.target.value })}
                  className="w-full p-2 border rounded"
                >
                  {googleFonts.map(font => (
                    <option key={font} value={font}>{font}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Font Size</label>
                <input
                  type="number"
                  value={selectedLayer.fontSize}
                  onChange={(e) => updateTextLayer(selectedLayer.id, { fontSize: parseInt(e.target.value) })}
                  className="w-full p-2 border rounded"
                  min="8"
                  max="200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Font Weight</label>
                <select
                  value={selectedLayer.fontWeight}
                  onChange={(e) => updateTextLayer(selectedLayer.id, { fontWeight: e.target.value })}
                  className="w-full p-2 border rounded"
                >
                  <option value="normal">Normal</option>
                  <option value="bold">Bold</option>
                  <option value="lighter">Light</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Color</label>
                <div className="flex gap-2">
                  <div
                    className="w-8 h-8 border rounded cursor-pointer"
                    style={{ backgroundColor: selectedLayer.color }}
                    onClick={() => {
                      setCurrentColor(selectedLayer.color);
                      setShowColorPicker(!showColorPicker);
                    }}
                  />
                  <input
                    type="text"
                    value={selectedLayer.color}
                    onChange={(e) => updateTextLayer(selectedLayer.id, { color: e.target.value })}
                    className="flex-1 p-2 border rounded"
                  />
                </div>
                {showColorPicker && (
                  <div className="mt-2">
                    <HexColorPicker
                      color={currentColor}
                      onChange={(color) => {
                        setCurrentColor(color);
                        updateTextLayer(selectedLayer.id, { color });
                      }}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Opacity</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={selectedLayer.opacity}
                  onChange={(e) => updateTextLayer(selectedLayer.id, { opacity: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Alignment</label>
                <select
                  value={selectedLayer.alignment}
                  onChange={(e) => updateTextLayer(selectedLayer.id, { alignment: e.target.value })}
                  className="w-full p-2 border rounded"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Layers Panel */}
        <div className="mb-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Layers size={20} />
            Layers
          </h3>
          <div className="space-y-2">
            {textLayers.map((layer) => (
              <div
                key={layer.id}
                className={`p-2 border rounded cursor-pointer ${
                  selectedTextLayer === layer.id ? 'bg-blue-100 border-blue-500' : 'bg-gray-50'
                }`}
                onClick={() => setSelectedTextLayer(layer.id)}
              >
                <div className="flex justify-between items-center">
                  <span className="truncate flex-1">{layer.text || 'Empty Text'}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveLayerUp(layer.id);
                      }}
                      className="px-1 py-1 text-xs bg-gray-200 rounded"
                    >
                      ↑
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveLayerDown(layer.id);
                      }}
                      className="px-1 py-1 text-xs bg-gray-200 rounded"
                    >
                      ↓
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTextLayer(layer.id);
                      }}
                      className="px-1 py-1 text-xs bg-red-200 rounded text-red-700"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Export and Reset */}
        <div className="space-y-2">
          <button
            onClick={exportImage}
            disabled={!backgroundImage}
            className="w-full flex items-center justify-center gap-2 bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50"
          >
            <Download size={20} />
            Export PNG
          </button>
          <button
            onClick={resetDesign}
            className="w-full flex items-center justify-center gap-2 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            <RotateCcw size={20} />
            Reset Design
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="bg-white rounded-lg shadow-lg p-4">
          <canvas
            ref={canvasRef}
            className="border border-gray-300"
            style={{ maxWidth: '100%', maxHeight: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}
