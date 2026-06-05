import { useState, useRef, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../../utils/imageUtils';
import { optimizeUrl, uploadToImageKit } from '../../utils/imagekitUtils';

export default function ProfileHeader({
  user,
  profileData,
  editForm,
  setEditForm,
  isEditing,
  setIsEditing,
  isOwnProfile,
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [croppingField, setCroppingField] = useState(null);
  const fileInputRef = useRef(null);

  const handleImageClick = (field) => {
    if (!isEditing) return;
    setCroppingField(field === 'avatar' ? 'avatarUrl' : 'bannerUrl');
    fileInputRef.current.click();
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setImageToCrop(URL.createObjectURL(file));
      e.target.value = '';
    }
  };

  const onCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleSaveCrop = async () => {
    if (!croppedAreaPixels) return;
    try {
      const base64 = await getCroppedImg(imageToCrop, croppedAreaPixels, croppingField);
      const blob = await (await fetch(base64)).blob();

      const url = await uploadToCloudinary(blob);

      setEditForm(prev => ({ ...prev, [croppingField]: url }));
      setImageToCrop(null);
      setCroppingField(null);
    } catch (e) {
      console.error('Crop upload failed:', e);
      alert('Failed to process image.');
    }
  };

  const handleImageError = (e, fallback) => {
    if (fallback) {
      e.target.src = fallback;
    } else {
      e.target.style.display = 'none';
    }
  };

  const overlayStyle = {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(49,37,39,0.6)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', color: '#FFFFFF', fontWeight: 'bold',
    cursor: 'pointer', opacity: 0, transition: 'opacity 0.2s', zIndex: 10,
  };

  const activeData = isEditing ? editForm : profileData;

  return (
    <>
      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} />

      {/* Crop modal */}
      {imageToCrop && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(49,37,39,0.9)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: '80%', height: '60%', backgroundColor: '#D4C4C7' }}>
            <Cropper
              image={imageToCrop}
              crop={crop}
              zoom={zoom}
              aspect={croppingField === 'avatarUrl' ? 1 : 1000 / 250}
              cropShape={croppingField === 'avatarUrl' ? 'round' : 'rect'}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', alignItems: 'center', width: '80%', maxWidth: '400px' }}>
            <span style={{ color: '#E6DADD' }}>Zoom:</span>
            <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(e.target.value)} style={{ flex: 1 }} />
          </div>
          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
            <button onClick={handleSaveCrop} style={{ padding: '0.8rem 2rem', backgroundColor: '#8D6E73', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Crop & Apply</button>
            <button onClick={() => { setImageToCrop(null); setCroppingField(null); }} style={{ padding: '0.8rem 2rem', backgroundColor: '#C2B0B4', color: '#312527', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Banner */}
      <div className="profile-banner-container" style={{ position: 'relative', marginBottom: '4rem', height: '250px', backgroundColor: '#D4C4C7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', borderRadius: '12px', backgroundColor: '#C2B0B4' }}>
          {activeData.bannerUrl && (
            <img
              key={activeData.bannerUrl}
              src={optimizeUrl(activeData.bannerUrl, 1000)}
              alt="Banner"
              onError={(e) => handleImageError(e)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}
          {isEditing && editForm.bannerUrl && (
            <button
              className="del-btn"
              onClick={(e) => { e.stopPropagation(); setEditForm(prev => ({ ...prev, bannerUrl: "" })); }}
              style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: 'rgba(49,37,39,0.65)', backdropFilter: 'blur(4px)', color: 'white', border: 'none', borderRadius: '50%', width: '38px', height: '38px', cursor: 'pointer', zIndex: 20, display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.2s' }}
              title="Remove Banner"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          )}
        </div>

        {/* SECURITY FIX: Only the profile owner sees the Edit Profile button */}
        {user && isOwnProfile && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            style={{ position: 'absolute', right: '1rem', top: '1rem', padding: '0.5rem 1.2rem', backgroundColor: 'rgba(230,218,221,0.8)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '6px', color: '#312527', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', whiteSpace: 'nowrap', zIndex: 30 }}
          >
            Edit Profile
          </button>
        )}

        {/* Avatar */}
        <div style={{ position: 'absolute', bottom: '-60px', left: '1rem', zIndex: 20 }}>
          <div className="profile-avatar-container" style={{ width: '120px', height: '120px', borderRadius: '50%', border: '4px solid #E6DADD', backgroundColor: '#E6DADD', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
            <img
              key={activeData.avatarUrl}
              src={optimizeUrl(activeData.avatarUrl || '/bunny.png')}
              alt="Avatar"
              onError={(e) => handleImageError(e, '/bunny.png')}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {isEditing && editForm.avatarUrl && editForm.avatarUrl !== '/bunny.png' && (
              <button
                className="del-btn"
                onClick={(e) => { e.stopPropagation(); setEditForm(prev => ({ ...prev, avatarUrl: '/bunny.png' })); }}
                style={{ position: 'absolute', top: '0px', right: '0px', backgroundColor: '#8D6E73', border: '2px solid #E6DADD', color: 'white', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer', zIndex: 30, display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.2s', padding: 0 }}
                title="Remove Avatar"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}