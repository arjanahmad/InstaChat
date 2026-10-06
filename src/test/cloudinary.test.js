import { describe, it, expect } from 'vitest';
import { MAX_FILE_SIZES, ALLOWED_EXTENSIONS, uploadToCloudinary } from '../config/cloudinary';

describe('Cloudinary Media Service', () => {
  it('enforces maximum file size thresholds', () => {
    expect(MAX_FILE_SIZES.IMAGE).toBe(15 * 1024 * 1024);
    expect(MAX_FILE_SIZES.VIDEO).toBe(50 * 1024 * 1024);
    expect(MAX_FILE_SIZES.VOICE).toBe(20 * 1024 * 1024);
    expect(MAX_FILE_SIZES.DOCUMENT).toBe(30 * 1024 * 1024);
  });

  it('allows expected media extensions', () => {
    expect(ALLOWED_EXTENSIONS.IMAGE).toContain('png');
    expect(ALLOWED_EXTENSIONS.IMAGE).toContain('jpg');
    expect(ALLOWED_EXTENSIONS.VIDEO).toContain('mp4');
    expect(ALLOWED_EXTENSIONS.VOICE).toContain('webm');
    expect(ALLOWED_EXTENSIONS.DOCUMENT).toContain('pdf');
  });

  it('rejects upload when file is missing', async () => {
    await expect(uploadToCloudinary(null)).rejects.toThrow('No file provided for upload.');
  });
});
