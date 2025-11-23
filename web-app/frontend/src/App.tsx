import { useState, useRef } from 'react'
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import './App.css' 

// Helper to center the crop initially
function centerAspectCrop(mediaWidth, mediaHeight, aspect) {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight
  )
}

export default function App() {
  const [imgSrc, setImgSrc] = useState('')
  const [crop, setCrop] = useState()
  const [completedCrop, setCompletedCrop] = useState()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const imgRef = useRef(null)

  // 1. Handle File Upload
  function onSelectFile(e) {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined) // Reset crop
      setResult(null)    // Reset previous results
      const reader = new FileReader()
      reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''))
      reader.readAsDataURL(e.target.files[0])
    }
  }

  // 2. Initialize Crop Area
  function onImageLoad(e) {
    const { width, height } = e.currentTarget
    setCrop(centerAspectCrop(width, height, 16 / 9))
  }

  // 3. Generate the cropped image Blob and send to API
  async function handlePredict() {
    if (!completedCrop || !imgRef.current) return;

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');

    // Draw the cropped area onto a canvas
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

    // Convert canvas to blob and send to backend
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      setLoading(true);
      
      const formData = new FormData();
      formData.append('file', blob, 'snake_crop.jpg');

      try {
        // NOTE: Ensure your backend is running on localhost:8000
        const response = await fetch('http://127.0.0.1:8000/predict', {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();
        setResult(data);
      } catch (error) {
        console.error("Error identifying snake:", error);
        alert("Failed to connect to the server.");
      } finally {
        setLoading(false);
      }
    }, 'image/jpeg');
  }

  return (
    <div className="app-container">
      <header>
        <h1>🐍 Python Eye</h1>
        <p>AI Snake Identification & Safety System</p>
      </header>

      <div className="upload-section">
        <input type="file" accept="image/*" onChange={onSelectFile} />
      </div>

      {/* Cropper View */}
      {imgSrc && (
        <div className="crop-container">
          <ReactCrop crop={crop} onChange={(_, percentCrop) => setCrop(percentCrop)} onComplete={(c) => setCompletedCrop(c)}>
            <img ref={imgRef} alt="Upload" src={imgSrc} onLoad={onImageLoad} style={{ maxHeight: '400px' }} />
          </ReactCrop>
          <button onClick={handlePredict} disabled={loading} className="predict-btn">
            {loading ? "Analyzing..." : "Identify Snake"}
          </button>
        </div>
      )}

      {/* Results View */}
      {result && (
        <div className={`result-card ${result.venom_status.toLowerCase()}`}>
          <h2>{result.species}</h2>
          <div className="badge">{result.venom_status} Venom</div>
          <p>Confidence: {result.confidence}</p>
        </div>
      )}
    </div>
  )
}