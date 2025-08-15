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
import { cn } from '@/lib/utils';

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
  const hasLoadedFromStorage = useRef(false);
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

    return () => {
      fabricCanvas.dispose();
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

  const loadBackgroundImage = useCallback((imageUrl: string, fabricCanvas: fabric.Canvas) => {
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
  }, []);

  const addTextToCanvas = useCallback((layer: TextLayer, fabricCanvas: fabric.Canvas) => {
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
    layer.fabricObject = text;

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
  }, []);



  // Load from localStorage once when canvas is ready
  useEffect(() => {
    if (!canvas || hasLoadedFromStorage.current) return;
    
    const saved = localStorage.getItem('imageTextComposerDesign');
    if (saved) {
      try {
        const designState: DesignState = JSON.parse(saved);
        
        // Set canvas dimensions first
        if (designState.canvasWidth && designState.canvasHeight) {
          canvas.setDimensions({ 
            width: designState.canvasWidth, 
            height: designState.canvasHeight 
          });
          setCanvasSize({ width: designState.canvasWidth, height: designState.canvasHeight });
        }
        
        setBackgroundImage(designState.backgroundImage);
        
        if (designState.backgroundImage) {
          loadBackgroundImage(designState.backgroundImage, canvas);
        }
        
        // Restore text layers
        designState.textLayers.forEach(layer => {
          addTextToCanvas(layer, canvas);
        });
        
        setTextLayers(designState.textLayers);
      } catch (error) {
        console.error('Failed to load from storage:', error);
      }
    }
    
    hasLoadedFromStorage.current = true;
  }, [canvas, loadBackgroundImage, addTextToCanvas]);

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
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose PNG File
              </Button>
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
                  <CardDescription>Organize and control your text layers</CardDescription>
                </CardHeader>
                <CardContent>
                  {textLayers.length > 0 ? (
                    <div className="space-y-2">
                      {textLayers.map((layer) => (
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
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {layer.text || 'Empty Text'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {layer.fontFamily} • {layer.fontSize}px
                              </p>
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleLayerVisibility(layer.id);
                                }}
                              >
                                {layer.visible ? (
                                  <Eye className="w-3 h-3" />
                                ) : (
                                  <EyeOff className="w-3 h-3" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveLayerUp(layer.id);
                                }}
                              >
                                <ChevronUp className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveLayerDown(layer.id);
                                }}
                              >
                                <ChevronDown className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteTextLayer(layer.id);
                                }}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No text layers yet</p>
                      <p className="text-xs">Add your first text layer to get started</p>
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
        <Card className="p-4 shadow-lg">
          <canvas
            ref={canvasRef}
            className="border border-border rounded-md"
            style={{ maxWidth: '100%', maxHeight: '100%' }}
          />
        </Card>
      </div>
    </div>
  );
}