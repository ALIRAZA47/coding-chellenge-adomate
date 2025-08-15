# Image Text Composer - Adomate Coding Assignment

A powerful desktop image editing tool that enables users to upload PNG images and overlay them with fully customizable text layers. Built with Next.js, TypeScript, and Fabric.js.

## Features

### Core Functionality
- ✅ **PNG Image Upload**: Upload PNG images with automatic canvas aspect ratio matching
- ✅ **Multi-layer Text Editing**: Add multiple text layers with independent styling
- ✅ **Comprehensive Text Properties**:
  - Font family selection (Google Fonts integration)
  - Font size, weight, color, opacity
  - Text alignment (left, center, right)
  - Multi-line text support
- ✅ **Transform Controls**: Drag, resize, and rotate text layers
- ✅ **Layer Management**: Reorder layers with visual layer panel
- ✅ **Canvas UX**: Snap-to-center guides and arrow key nudging
- ✅ **Undo/Redo**: 20-step history with keyboard shortcuts (Ctrl/Cmd+Z)
- ✅ **Autosave**: Automatic saving to localStorage with restoration on page reload
- ✅ **Export**: PNG export maintaining original image dimensions
- ✅ **Reset**: Clear saved design and return to blank state

### User Experience
- Intuitive drag-and-drop interface
- Real-time visual feedback
- Keyboard shortcuts for common actions
- Responsive toolbar with organized controls
- Visual layer management with up/down/delete controls

## Tech Stack

- **Framework**: Next.js 14 with TypeScript
- **Canvas Library**: Fabric.js for advanced canvas manipulation
- **Styling**: Tailwind CSS for responsive design
- **Color Picker**: react-colorful for color selection
- **Icons**: Lucide React for consistent iconography
- **Fonts**: Google Fonts API integration
- **Export**: Native HTML5 Canvas toDataURL for PNG generation

## Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd image-text-composer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Google Fonts API (Optional)**
   - Create a `.env.local` file in the root directory
   - Add your Google Fonts API key:
     ```
     NEXT_PUBLIC_GOOGLE_FONTS_API_KEY=your_api_key_here
     ```
   - Get your API key from: https://developers.google.com/fonts/docs/developer_api
   - Note: The app works with fallback fonts if no API key is provided

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open the application**
   - Navigate to `http://localhost:3000`
   - Start creating your image compositions!

## Architecture Overview

### Component Structure
```
src/
├── app/
│   ├── layout.tsx          # Root layout with metadata
│   ├── page.tsx            # Main page component
│   └── globals.css         # Global styles
└── components/
    └── ImageEditor.tsx     # Main editor component
```

### Key Architecture Decisions

1. **Fabric.js Integration**: Chosen for robust canvas manipulation, built-in transform controls, and excellent TypeScript support. Provides smooth dragging, resizing, and rotation out of the box.

2. **State Management**: Uses React hooks for local state management with careful separation of concerns:
   - Canvas state (Fabric.js objects)
   - Layer metadata (TypeScript interfaces)
   - History management (array-based undo/redo)
   - Auto-save to localStorage

3. **Type Safety**: Full TypeScript implementation with interfaces for:
   - `TextLayer`: Text layer properties and metadata
   - `DesignState`: Complete design state for history/autosave
   - Fabric.js object extensions for layer ID tracking

4. **Performance Optimizations**:
   - Debounced auto-save (1-second delay)
   - Efficient re-rendering with React.useCallback
   - Canvas event handlers for real-time updates
   - Lazy loading of Google Fonts

### Data Flow
1. User interactions trigger Fabric.js events
2. Events update React state via defined handlers
3. State changes trigger React re-renders
4. Auto-save mechanism persists to localStorage
5. History system tracks state changes for undo/redo

## Technology Choices & Trade-offs

### Fabric.js vs Alternatives
- **Chosen**: Fabric.js
- **Alternatives Considered**: Konva.js, native Canvas API
- **Reasoning**: 
  - Mature ecosystem with excellent documentation
  - Built-in transform controls reduce development time
  - Strong TypeScript support
  - Active community and maintenance
- **Trade-offs**: Larger bundle size vs native Canvas, but significant development speed gains

### Google Fonts Integration
- **Approach**: Direct API integration with fallback fonts
- **Benefits**: Access to 1000+ font families
- **Trade-offs**: Requires API key for full functionality, but graceful degradation

### State Management
- **Approach**: React hooks + localStorage
- **Benefits**: Simple, predictable, no external dependencies
- **Trade-offs**: Not suitable for complex multi-user scenarios, but perfect for single-user desktop app

## Bonus Features Implemented

- ✅ **Layer Management**: Visual layer panel with reordering controls
- ✅ **Keyboard Shortcuts**: Undo/Redo (Ctrl/Cmd+Z/Y) and arrow key nudging
- ✅ **Smart Canvas UX**: Snap-to-center guides for precise alignment
- ✅ **Enhanced Color Control**: Visual color picker with hex input
- ✅ **Multi-line Text Support**: Textarea input for complex text content
- ✅ **Visual Feedback**: Real-time property updates and selection indicators

## Known Limitations

1. **Google Fonts API**: Requires API key for full font selection (falls back to system fonts)
2. **Browser Compatibility**: Tested on modern browsers (Chrome, Firefox, Safari, Edge)
3. **File Size**: Large images may impact performance on lower-end devices
4. **Export Quality**: Limited to Canvas API capabilities (96 DPI)
5. **Undo/Redo**: Limited to 20 steps to prevent memory issues

## Performance Considerations

- Auto-save debounced to prevent excessive localStorage writes
- Font loading optimized with Google Fonts preconnect
- Canvas rendering optimized with Fabric.js built-in optimizations
- Component re-renders minimized with React.useCallback and proper dependency arrays

## Future Enhancements

Potential improvements for production use:
- Cloud storage integration for design persistence
- Vector export formats (SVG)
- Advanced text effects (shadows, outlines, gradients)
- Collaborative editing capabilities
- Performance optimizations for large canvases
- Accessibility improvements (ARIA labels, keyboard navigation)

---

Built with ❤️ for the Adomate coding challenge