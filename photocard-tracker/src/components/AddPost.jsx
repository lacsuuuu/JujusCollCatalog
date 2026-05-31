import { useState, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import imageCompression from 'browser-image-compression';
import ThemeAlert from './ThemeAlert';

const inputStyle = {
  padding: '0.7rem 1rem',
  borderRadius: '6px',
  border: '1px solid #D4C4C7',
  backgroundColor: '#FFFFFF',
  color: '#312527',
  fontSize: '0.95rem',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const arrowStyle = {
  position: 'absolute', top: '50%', transform: 'translateY(-50%)',
  background: 'rgba(49, 37, 39, 0.4)', backdropFilter: 'blur(4px)',
  color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px',
  cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center',
  transition: 'background 0.2s', zIndex: 10
};

export default function AddPost() {
  const [photos, setPhotos] = useState([]); 
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);
  
  const fileInputRef = useRef(null);

  const handleFiles = (files) => {
    if (!files || files.length === 0) return;
    const newPhotos = Array.from(files).map(file => ({
      url: URL.createObjectURL(file),
      file: file 
    }));
    setPhotos(prev => [...prev, ...newPhotos]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  const handleNextPhoto = (e) => {
    e.stopPropagation();
    setCurrentPhotoIndex(prev => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  const handlePrevPhoto = (e) => {
    e.stopPropagation();
    setCurrentPhotoIndex(prev => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const handleDeletePhoto = (e) => {
    e.stopPropagation();
    setPhotos(prev => {
      const updatedPhotos = [...prev];
      updatedPhotos.splice(currentPhotoIndex, 1);
      return updatedPhotos;
    });
    setCurrentPhotoIndex(prev => (prev >= photos.length - 1 ? Math.max(0, prev - 1) : prev));
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (photos.length === 0) return setAlertMsg("Please select at least one image!");
    setLoading(true);

    try {
      const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true };
      let uploadedUrls = [];

      for (let i = 0; i < photos.length; i++) {
        const compressedFile = await imageCompression(photos[i].file, options);
        const formData = new FormData();
        formData.append('file', compressedFile);
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
        
        const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: formData });
        const cloudinaryData = await cloudinaryRes.json();
        
        if (!cloudinaryRes.ok) throw new Error(cloudinaryData.error.message);
        uploadedUrls.push(cloudinaryData.secure_url);
      }

      await addDoc(collection(db, "posts"), { 
        caption, 
        imageUrls: uploadedUrls, 
        timestamp: new Date() 
      });

      setAlertMsg("Post published to feed!");
      setPhotos([]); 
      setCurrentPhotoIndex(0);
      setCaption('');

    } catch (error) {
      console.error("Upload failed:", error);
      setAlertMsg(`Something went wrong: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '480px', width: '100%', margin: '2rem auto', padding: '1rem', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #D4C4C7', boxShadow: '0 2px 8px rgba(49, 37, 39, 0.08)' }}>
      
      <style>{`
        .theme-input { transition: box-shadow 0.2s ease; outline: none; }
        .theme-input:focus { box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px #8D6E73 !important; }

        .themed-textarea::-webkit-scrollbar { width: 10px; }
        .themed-textarea::-webkit-scrollbar-track { background: transparent; }
        .themed-textarea::-webkit-scrollbar-thumb { background: #C2B0B4; border-radius: 6px; border: 2px solid #FFFFFF; }
        .themed-textarea::-webkit-scrollbar-thumb:hover { background: #8D6E73; }

        .icon-btn:hover { background: rgba(49, 37, 39, 0.7) !important; }
        .del-btn:hover { filter: brightness(0.8); transform: scale(1.05); }
      `}</style>

      <ThemeAlert message={alertMsg} onClose={() => setAlertMsg(null)} />
      <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#312527' }}>Post to Feed</h2>
      
      <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <textarea 
            className="themed-textarea theme-input"
            placeholder="Write a caption..." 
            value={caption} 
            onChange={(e) => setCaption(e.target.value)} 
            required 
            maxLength={256}
            style={{ ...inputStyle, minHeight: '100px', resize: 'none', fontFamily: 'inherit', lineHeight: '1.5' }} 
          />
          <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#6A585B', fontWeight: '500' }}>
            {caption.length}/256
          </div>
        </div>

        <div 
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }} 
          onDragLeave={() => setDragging(false)} 
          onDrop={handleDrop} 
          onClick={() => fileInputRef.current.click()}
          style={{ position: 'relative', border: photos.length > 0 ? 'none' : '2px dashed #D4C4C7', borderRadius: '8px', padding: photos.length > 0 ? 0 : '1.5rem', textAlign: 'center', cursor: 'pointer', backgroundColor: '#FFFFFF', transition: 'all 0.2s', overflow: 'hidden' }}
        >
          {/* THE CUT-OUT OVERLAY */}
          {dragging && (
            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(141, 110, 115, 0.85)', zIndex: 30, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#FFF', fontSize: '1.2rem', fontWeight: 'bold', border: '4px dashed #FFF', margin: '1rem', borderRadius: '12px', pointerEvents: 'none' }}>
              Drop photos here
            </div>
          )}

          {photos.length > 0 ? (
            <div style={{ position: 'relative', width: '100%', height: '350px', backgroundColor: '#D4C4C7' }}>
              <img src={photos[currentPhotoIndex].url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              
              <button 
                className="del-btn" 
                onClick={handleDeletePhoto} 
                style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: '#6A585B', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', zIndex: 15, display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.2s', backdropFilter: 'blur(4px)' }}
                title="Delete Photo"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>

              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '1rem', background: 'linear-gradient(transparent, rgba(49,37,39,0.85))', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', color: '#FFF' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '600', backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.3rem 0.8rem', borderRadius: '20px', backdropFilter: 'blur(4px)' }}>
                  Add more photos
                </span>
                
                {photos.length > 1 && (
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', backgroundColor: 'rgba(49, 37, 39, 0.6)', padding: '0.3rem 0.7rem', borderRadius: '20px', backdropFilter: 'blur(4px)' }}>
                    {currentPhotoIndex + 1} / {photos.length}
                  </span>
                )}
              </div>
              
              {photos.length > 1 && (
                <>
                  <button className="icon-btn" onClick={handlePrevPhoto} style={{...arrowStyle, left: '10px'}}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  </button>
                  <button className="icon-btn" onClick={handleNextPhoto} style={{...arrowStyle, right: '10px'}}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </button>
                </>
              )}
            </div>
          ) : (
            <div style={{ pointerEvents: 'none' }}>
              <p style={{ margin: 0 }}><img src="/frame.svg" alt="Frame" width="35" height="35" style={{ opacity: 0.7 }} /></p>
              <p style={{ margin: '0.5rem 0 0.25rem', color: '#312527', fontSize: '0.9rem', fontWeight: '600' }}>Drop images here</p>
              <p style={{ margin: 0, color: '#6A585B', fontSize: '0.8rem' }}>or click to browse (Multiple allowed)</p>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={e => handleFiles(e.target.files)} style={{ display: 'none' }} />
        </div>

        <button type="submit" disabled={loading} style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: loading ? '#E6DADD' : '#8D6E73', color: loading ? '#6A585B' : '#FFFFFF', border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '0.9rem' }}>
          {loading ? "Posting..." : "Post to Feed"}
        </button>
      </form>
    </div>
  );
}