/**
 * Image and Document Optimization Utility
 * Automatically compresses, organizes, and scales down uploaded photos,
 * receipts, and survey pictures to reduce storage consumption by up to 98%
 * while preserving high visual clarity.
 */

export interface OptimizedFileResult {
  url: string;
  name: string;
  type: 'image' | 'pdf';
  size: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  uploadedAt: string;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Compresses an image file client-side using HTML5 Canvas.
 * Scales down large mobile/DSLR photos (e.g. 4000x3000, 8-15MB)
 * to max 1280px on the longest dimension at 80% JPEG quality,
 * yielding an organized ~80-160KB payload instead of 10MB!
 */
export async function optimizeAndCompressImage(
  file: File | Blob,
  fileName?: string,
  maxDimension: number = 1280,
  quality: number = 0.8
): Promise<OptimizedFileResult> {
  const name = fileName || (file instanceof File ? file.name : 'attached_photo.jpg');
  const isPdf =
    name.toLowerCase().endsWith('.pdf') ||
    file.type === 'application/pdf';

  if (isPdf) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        resolve({
          url,
          name,
          type: 'pdf',
          size: formatBytes(file.size),
          sizeBytes: file.size,
          uploadedAt: new Date().toISOString(),
        });
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  // Handle Image compression via Canvas
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      const img = new Image();

      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // If dimensions exceed maxDimension, scale down proportionally
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback if canvas context fails
          resolve({
            url: rawDataUrl,
            name,
            type: 'image',
            size: formatBytes(file.size),
            sizeBytes: file.size,
            uploadedAt: new Date().toISOString(),
          });
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to optimized JPEG data URL
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

        // Calculate approximate size in bytes from base64
        const head = 'data:image/jpeg;base64,';
        const base64Len = compressedDataUrl.length - head.length;
        const approxBytes = Math.round((base64Len * 3) / 4);

        resolve({
          url: compressedDataUrl,
          name: name.replace(/\.[^/.]+$/, '') + '.jpg',
          type: 'image',
          size: formatBytes(approxBytes),
          sizeBytes: approxBytes,
          width,
          height,
          uploadedAt: new Date().toISOString(),
        });
      };

      img.onerror = () => {
        // Fallback to raw data if image decoding fails
        resolve({
          url: rawDataUrl,
          name,
          type: 'image',
          size: formatBytes(file.size),
          sizeBytes: file.size,
          uploadedAt: new Date().toISOString(),
        });
      };

      img.src = rawDataUrl;
    };

    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
