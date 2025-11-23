import { useState, useRef, ChangeEvent, SyntheticEvent } from 'react'
import ReactCrop, { 
  centerCrop, 
  makeAspectCrop, 
} from 'react-image-crop'
import type { Crop, PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import './App.css' 

interface PredictionResult {
  species: string;
  venom_status: string;
  confidence: string;
}

// Helper: Centers the crop and forces 1:1 Aspect Ratio
function centerAspectCrop(mediaWidth: number, mediaHeight: number) {
  return centerCrop(
    makeAspectCrop(
      { unit: '%', width: 90 }, 
      1, // <--- 1 = 1:1 Aspect Ratio (Square)
      mediaWidth, 
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  )
}

export default function App() {
  const [imgSrc, setImgSrc] = useState<string>('')
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [result, setResult] = useState<PredictionResult | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const imgRef = useRef<HTMLImageElement>(null)

  function onSelectFile(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined)
      setResult(null)
      const reader = new FileReader()
      reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''))
      reader.readAsDataURL(e.target.files[0])
    }
  }

  function onImageLoad(e: SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget
    // Initialize with 1:1 Aspect Ratio
    setCrop(centerAspectCrop(width, height))
  }

  async function handlePredict() {
    if (!completedCrop || !imgRef.current) return;

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    // Canvas will be the size of the crop
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height
    );

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      setLoading(true);
      const formData = new FormData();
      formData.append('file', blob, 'snake_crop.jpg');

      try {
        const response = await fetch('http://127.0.0.1:8001/predict', {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        setResult(data);
      } catch (error) {
        console.error("Error:", error);
        alert("Server error. Check terminal.");
      } finally {
        setLoading(false);
      }
    }, 'image/jpeg');
  }

  return (
    <div className="main-wrapper">
      <div className="app-card">
        <header className="app-header">
          <h1>🐍 Python Eye</h1>
          <p>AI-Powered Snake Identification</p>
        </header>

        {/* Upload Area */}
        <div className="upload-container">
          <label className="file-upload-label">
            <input type="file" accept="image/*" onChange={onSelectFile} />
            <span>{imgSrc ? "Choose a different photo" : "📁 Upload Snake Photo"}</span>
          </label>
        </div>

        {/* Workspace: Crop & Predict */}
        {imgSrc && (
          <div className="workspace">
            <div className="cropper-wrapper">
              <p className="instruction">Adjust box to frame the snake head</p>
              <ReactCrop 
                crop={crop} 
                aspect={1} // <--- FORCE 1:1 RATIO HERE
                onChange={(c) => setCrop(c)} 
                onComplete={(c) => setCompletedCrop(c)}
              >
                <img ref={imgRef} alt="Upload" src={imgSrc} onLoad={onImageLoad} />
              </ReactCrop>
            </div>
            
            <button onClick={handlePredict} disabled={loading} className="action-btn">
              {loading ? (
                <span className="loader">Analyzing...</span>
              ) : (
                "Identify Species 🔍"
              )}
            </button>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className={`result-card ${result.venom_status.toLowerCase().split(' ')[0]}`}>
            <div className="result-header">
              <span className="confidence-pill">{result.confidence} Match</span>
            </div>
            <h2>{result.species}</h2>
            <div className="venom-badge">
              ⚠️ {result.venom_status} Venom
            </div>
          </div>
        )}
      </div>
    </div>
  )
}