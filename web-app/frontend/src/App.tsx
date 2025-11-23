import { useState, useRef } from 'react';
import type { ChangeEvent, SyntheticEvent } from 'react';
import ReactCrop, { 
  centerCrop, 
  makeAspectCrop, 
} from 'react-image-crop';
import type { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import './App.css';

interface SnakeData {
  species: string;
  venom_status: string;
  confidence: string;
  scientific_name: string;
  description?: string;
}

interface PredictionResult {
  main: SnakeData;
  others: SnakeData[];
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number) {
  return centerCrop(
    makeAspectCrop(
      { unit: '%', width: 90 }, 
      1,
      mediaWidth, 
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  )
}

export default function App() {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [croppedImagePreview, setCroppedImagePreview] = useState<string>('');
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function onSelectFile(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined);
      setResult(null);
      setCroppedImagePreview('');
      const reader = new FileReader();
      reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''));
      reader.readAsDataURL(e.target.files[0]);
    }
  }

  function onImageLoad(e: SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height));
  }

  async function handlePredict() {
    if (!completedCrop || !imgRef.current) return;

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
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

    canvas.toBlob((blob) => {
      if(blob) setCroppedImagePreview(URL.createObjectURL(blob));
    });

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
        alert("Server error. Ensure backend is running.");
      } finally {
        setLoading(false);
      }
    }, 'image/jpeg');
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span></span>Python Eye
        </div>
        
        <nav className="nav-menu">
          <div className="nav-item">
            <span>Learn</span>
          </div>
          <div className="nav-item active">
            <span> Identify</span>
          </div>
          <div className="nav-item">
            <span>Rescuer Details</span>
          </div>
        </nav>

        <div className="user-profile">
          <div className="user-avatar"></div>
          <span>User Profile</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-header">
          Desktop
        </header>

        <div className="content-wrapper">
          
          {!result && (
            <>
              <div className="upload-card" onClick={handleUploadClick}>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={onSelectFile} 
                  ref={fileInputRef} 
                  hidden 
                />
                <span className="upload-icon">📤</span>
                <div className="upload-text">
                  Drag & Drop or <strong>Click to Upload Image</strong> <br/>
                  to begin classification
                </div>
              </div>

              {imgSrc && (
                <div className="crop-workspace">
                  <p style={{marginBottom: '1rem', color: '#64748b'}}>
                    Adjust box to frame the snake head
                  </p>
                  <ReactCrop 
                    crop={crop} 
                    aspect={1} 
                    onChange={(c) => setCrop(c)} 
                    onComplete={(c) => setCompletedCrop(c)}
                  >
                    <img ref={imgRef} alt="Upload" src={imgSrc} onLoad={onImageLoad} style={{maxHeight: '400px'}} />
                  </ReactCrop>
                  
                  <button 
                    onClick={handlePredict} 
                    disabled={loading} 
                    className="action-btn"
                  >
                    {loading ? "Analyzing..." : "Identify Species"}
                  </button>
                </div>
              )}
            </>
          )}

          {result && (
            <div className="results-grid">
              <div className="result-box">
                <h3>Primary Identification</h3>
                
                <div className="detail-row">
                  <span className="detail-label">Snake Name</span>
                  <div className="detail-value">{result.main.species}</div>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Scientific Name</span>
                  <div className="detail-value" style={{fontStyle:'italic', fontSize: '1rem', color: '#64748b'}}>
                    {result.main.scientific_name}
                  </div> 
                </div>

                <div className="detail-row">
                  <span className="detail-label">Venom Status</span>
                  <span className={`venom-tag ${result.main.venom_status.toLowerCase().split(' ')[0]}`}>
                    {result.main.venom_status}
                  </span>
                </div>
                
                <div className="detail-row">
                  <span className="detail-label">Confidence Match</span>
                  <div style={{color: '#64748b'}}>{result.main.confidence}</div>
                </div>

                <hr style={{margin: '1.5rem 0', border: '0', borderTop: '1px solid #e2e8f0'}} />

                <div className="others-list">
                  <h4 style={{margin: '0 0 10px 0', fontSize: '0.9rem', color: '#64748b'}}>Other Possibilities:</h4>
                  {result.others.map((snake, idx) => (
                    <div key={idx} style={{marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <span style={{color: '#0f172a', fontWeight: 500}}>{snake.species}</span>
                        <span style={{color: '#64748b', fontSize: '0.85rem'}}>{snake.confidence}</span>
                      </div>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px'}}>
                        <span style={{fontStyle: 'italic', fontSize: '0.85rem', color: '#94a3b8'}}>{snake.scientific_name}</span>
                        <span className={`venom-tag ${snake.venom_status.toLowerCase().split(' ')[0]}`} style={{fontSize: '0.7rem', padding: '2px 8px'}}>
                          {snake.venom_status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => {setResult(null); setImgSrc('');}} 
                  style={{marginTop: '1.5rem', background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0, fontWeight: 500}}
                >
                  ← Identify Another
                </button>
              </div>

              <div className="learn-box">
                <h3>Learn More</h3>
                
                <div className="snake-preview">
                  {croppedImagePreview ? (
                    <img src={croppedImagePreview} alt="Snake Preview" />
                  ) : (
                    <span style={{color: '#cbd5e1'}}>Image Preview</span>
                  )}
                </div>

                <p style={{color: '#64748b', fontSize: '0.9rem', lineHeight: '1.6'}}>
                  {result.main.description ? (
                    result.main.description
                  ) : (
                    <>
                      Our AI is <strong>{result.main.confidence}</strong> sure this is a {result.main.species}. 
                      Always maintain a safe distance regardless of the identification.
                    </>
                  )}
                </p>

                <a 
                  href={`https://www.google.com/search?q=${result.main.species} snake Sri Lanka`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="learn-link"
                >
                  Read Full Wiki &rarr;
                </a>
              </div>

            </div>
          )}

        </div>
      </main>
    </div>
  )
}