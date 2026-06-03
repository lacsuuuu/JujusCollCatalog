const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    if (!url.startsWith('data:') && !url.startsWith('blob:')) {
      image.setAttribute('crossOrigin', 'anonymous');
    }
    image.src = url;
  });

export async function getCroppedImg(imageSrc, pixelCrop, field) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const targetWidth = field === 'bannerUrl' ? 1000 : 300;
  const targetHeight = field === 'bannerUrl' ? 250 : 300;
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, targetWidth, targetHeight
  );
  return canvas.toDataURL('image/jpeg', 0.8);
}