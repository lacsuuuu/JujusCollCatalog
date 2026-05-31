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

export const deleteCloudinaryImage = async (url) => {
  console.log("Image unlinked from Firebase. File remains in Cloudinary.");
  return true; 
};