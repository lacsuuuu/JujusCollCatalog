import imageCompression from 'browser-image-compression';

const URL_ENDPOINT = import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT;
const PUBLIC_KEY = import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY;
const PRIVATE_KEY = import.meta.env.VITE_IMAGEKIT_PRIVATE_KEY; // NEW: Added private key

// ---------------------------------------------------------------------------
// getPublicIdFromUrl
// ---------------------------------------------------------------------------
export const getPublicIdFromUrl = (url) => {
  if (!url || !url.includes('ik.imagekit.io')) return null;
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.replace(/^\/tr:[^/]+\//, '/');
    return pathname.replace(/^\//, '');
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// optimizeUrl
// ---------------------------------------------------------------------------
export const optimizeUrl = (url, width = 300) => {
  if (!url) return url;

  // --- IMAGEKIT ROUTING ---
  if (url.includes('ik.imagekit.io')) {
    // Prevent double-transforming
    if (url.includes('/tr:')) return url; 
    
    // Insert ImageKit transformation syntax
    return url.replace(
      /(https:\/\/ik\.imagekit\.io\/[^/]+\/)/,
      `$1tr:w-${width},q-auto,f-auto/`
    );
  }

  // --- CLOUDINARY ROUTING ---
  if (url.includes('cloudinary.com')) {
    // Prevent double-transforming (basic check)
    if (url.includes('/upload/w_') || url.includes('/upload/q_')) return url;
    
    // Insert Cloudinary transformation syntax
    return url.replace('/upload/', `/upload/w_${width},q_auto,f_auto/`);
  }

  // --- FALLBACK ---
  // Returns legacy local assets untouched (e.g., '/bunny.png')
  return url;
};

// ---------------------------------------------------------------------------
// generateImageKitAuth (NEW)
// Generates the HMAC-SHA1 signature required by ImageKit for client uploads
// ---------------------------------------------------------------------------
const generateImageKitAuth = async () => {
  if (!PRIVATE_KEY) {
    throw new Error("Missing VITE_IMAGEKIT_PRIVATE_KEY in your .env file!");
  }

  // Create a random token and an expiration time (30 mins from now)
  const token = window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2);
  const expire = Math.floor(Date.now() / 1000) + 60 * 30; 
  const textToSign = token + expire;

  // Use the browser's native Web Crypto API to sign the string
  const encoder = new TextEncoder();
  const keyData = encoder.encode(PRIVATE_KEY);
  const dataToSign = encoder.encode(textToSign);

  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signatureBuffer = await window.crypto.subtle.sign('HMAC', cryptoKey, dataToSign);
  
  // Convert buffer to hex string
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const signature = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return { token, expire, signature };
};

// ---------------------------------------------------------------------------
// uploadToImageKit (UPDATED)
// Now intercepts the file and applies the required signature before sending
// ---------------------------------------------------------------------------
export const uploadToImageKit = async (file, fileName = null) => {
  // Generate the auth params on the fly
  const { token, expire, signature } = await generateImageKitAuth();

  const formData = new FormData();
  formData.append('file', file);
  formData.append('publicKey', PUBLIC_KEY);
  formData.append('signature', signature); // REQUIRED
  formData.append('expire', expire);       // REQUIRED
  formData.append('token', token);         // REQUIRED
  formData.append('fileName', fileName || file.name || `upload_${Date.now()}`);

  const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'ImageKit upload failed');
  return data.url; 
};

// ---------------------------------------------------------------------------
// deleteImageKitImage
// ---------------------------------------------------------------------------
export const deleteImageKitImage = async (url) => {
  console.log('Image unlinked from Firebase. File remains in ImageKit (deletion requires server-side logic).');
  return true;
};

// ---------------------------------------------------------------------------
// compressAndUpload
// ---------------------------------------------------------------------------
const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.15,
  maxWidthOrHeight: 800,
  useWebWorker: true,
};

export const compressAndUpload = async (file) => {
  const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
  return uploadToImageKit(compressed);
};