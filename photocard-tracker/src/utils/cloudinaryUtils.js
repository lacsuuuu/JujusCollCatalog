import imageCompression from 'browser-image-compression';

export const getPublicIdFromUrl = (url) => {
  if (!url || !url.includes('cloudinary.com')) return null;
  const parts = url.split('/');
  const filename = parts.pop();
  const publicId = filename.split('.')[0];
  const folder = parts.pop();
  if (folder && folder !== 'upload' && !folder.startsWith('v')) {
    return `${folder}/${publicId}`;
  }
  return publicId;
};

export const optimizeUrl = (url, width = 300) => {
  if (!url || !url.includes('cloudinary.com')) return url;
  return url.replace('/upload/', `/upload/w_${width},q_auto,f_auto/`);
};

export const deleteCloudinaryImage = async (url) => {
  console.log("Image unlinked from Firebase. File remains in Cloudinary.");
  return true;
};

export const uploadToCloudinary = async (file) => {
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Cloudinary upload failed');
  return data.secure_url;
};

const COMPRESSION_OPTIONS = { maxSizeMB: 0.15, maxWidthOrHeight: 800, useWebWorker: true };

export const compressAndUpload = async (file) => {
  const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
  return uploadToCloudinary(compressed);
};