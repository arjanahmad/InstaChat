/**
 * Cloudinary Media Storage Service for INSTAChat
 * Uses unsigned upload preset 'battlechat_upload' under cloud 'jdkg4l75'
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'jdkg4l75';
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'battlechat_upload';

export const MAX_FILE_SIZES = {
  IMAGE: 15 * 1024 * 1024,      // 15 MB
  VIDEO: 50 * 1024 * 1024,      // 50 MB
  VOICE: 20 * 1024 * 1024,      // 20 MB
  DOCUMENT: 30 * 1024 * 1024,   // 30 MB
};

export const ALLOWED_EXTENSIONS = {
  IMAGE: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'],
  VIDEO: ['mp4', 'webm', 'mov', 'mkv', 'avi'],
  VOICE: ['webm', 'wav', 'ogg', 'mp3', 'm4a', 'aac'],
  DOCUMENT: ['pdf', 'doc', 'docx', 'txt', 'zip', 'rar', 'csv', 'xlsx', 'pptx'],
};

/**
 * Uploads a file or blob to Cloudinary using unsigned preset.
 * 
 * @param {File|Blob} file - The file or blob to upload
 * @param {'image'|'video'|'raw'|'auto'} resourceType - Cloudinary resource type
 * @param {Function} [onProgress] - Optional progress callback (percent: number)
 * @returns {Promise<{ url: string, secure_url: string, public_id: string, format: string, bytes: number }>}
 */
export async function uploadToCloudinary(file, resourceType = 'auto', onProgress = null) {
  if (!file) {
    throw new Error('No file provided for upload.');
  }

  // Determine appropriate endpoint based on resourceType
  // For audio recorded blobs or raw docs, 'video' or 'raw' or 'auto' works
  let endpointType = resourceType;
  if (file.type && file.type.startsWith('audio/')) {
    endpointType = 'video'; // Cloudinary treats audio files as video resource_type
  } else if (resourceType === 'document' || resourceType === 'raw') {
    endpointType = 'raw';
  } else if (resourceType === 'image') {
    endpointType = 'image';
  } else if (resourceType === 'video') {
    endpointType = 'video';
  } else {
    endpointType = 'auto';
  }

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${endpointType}/upload`;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve({
            url: response.secure_url || response.url,
            secure_url: response.secure_url,
            public_id: response.public_id,
            format: response.format,
            bytes: response.bytes || file.size || 0,
            original_filename: response.original_filename || file.name || 'file',
          });
        } catch (e) {
          reject(new Error(`Failed to parse Cloudinary response: ${e.message}`));
        }
      } else {
        let errorMsg = `Upload failed with HTTP ${xhr.status}`;
        try {
          const errRes = JSON.parse(xhr.responseText);
          if (errRes.error && errRes.error.message) {
            errorMsg = `Cloudinary Error: ${errRes.error.message}`;
          }
        } catch (_) {}
        reject(new Error(errorMsg));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during Cloudinary upload. Please check your connection.'));
    };

    xhr.ontimeout = () => {
      reject(new Error('Cloudinary upload timed out. Please try again.'));
    };

    xhr.send(formData);
  });
}
