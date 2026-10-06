// Direct Cloudinary upload verification script
import fs from 'fs';

const CLOUD_NAME = 'jdkg4l75';
const PRESET = 'battlechat_upload';

async function testUpload(resourceType, fileName, content, mime) {
  console.log(`\nTesting Cloudinary upload: resourceType=${resourceType}, file=${fileName}...`);
  const blob = new Blob([content], { type: mime });
  const formData = new FormData();
  formData.append('file', blob, fileName);
  formData.append('upload_preset', PRESET);

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    const json = await res.json();
    if (res.ok) {
      console.log(`[PASS] Cloudinary ${resourceType} upload successful:`);
      console.log(`       Secure URL: ${json.secure_url}`);
      console.log(`       Public ID: ${json.public_id}`);
      console.log(`       Bytes: ${json.bytes}`);
      return { success: true, url: json.secure_url };
    } else {
      console.error(`[FAIL] Cloudinary error (HTTP ${res.status}):`, json.error?.message || json);
      return { success: false, error: json.error?.message || json };
    }
  } catch (err) {
    console.error(`[FAIL] Network error during Cloudinary upload:`, err.message);
    return { success: false, error: err.message };
  }
}

async function run() {
  // 1. Tiny 1x1 transparent PNG image data
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const pngBuffer = Buffer.from(pngBase64, 'base64');
  const imgRes = await testUpload('image', 'test_sample.png', pngBuffer, 'image/png');

  // 2. Sample document
  const docContent = 'INSTAChat Test Document Content\nMade by Arjan\nVerification Timestamp: ' + new Date().toISOString();
  const docRes = await testUpload('raw', 'test_doc.txt', docContent, 'text/plain');

  // 3. Audio/Voice test with valid 44-byte WAV audio buffer
  const sampleRate = 8000;
  const numSamples = 8000; // 1 second of silence
  const wavBuffer = Buffer.alloc(44 + numSamples * 2);
  wavBuffer.write('RIFF', 0);
  wavBuffer.writeUInt32LE(36 + numSamples * 2, 4);
  wavBuffer.write('WAVE', 8);
  wavBuffer.write('fmt ', 12);
  wavBuffer.writeUInt32LE(16, 16);
  wavBuffer.writeUInt16LE(1, 20); // PCM
  wavBuffer.writeUInt16LE(1, 22); // Mono
  wavBuffer.writeUInt32LE(sampleRate, 24);
  wavBuffer.writeUInt32LE(sampleRate * 2, 28);
  wavBuffer.writeUInt16LE(2, 32);
  wavBuffer.writeUInt16LE(16, 34);
  wavBuffer.write('data', 36);
  wavBuffer.writeUInt32LE(numSamples * 2, 40);

  const audioRes = await testUpload('video', 'test_voice.wav', wavBuffer, 'audio/wav');

  // 4. Video upload test (small sample or auto endpoint)
  const autoRes = await testUpload('auto', 'test_voice_auto.wav', wavBuffer, 'audio/wav');

  console.log('\n--- CLOUDINARY TEST SUMMARY ---');
  console.log('Image upload:', imgRes.success ? 'PASS' : 'FAIL');
  console.log('Document upload:', docRes.success ? 'PASS' : 'FAIL');
  console.log('Audio/Voice upload (video endpoint):', audioRes.success ? 'PASS' : 'FAIL');
  console.log('Audio/Voice upload (auto endpoint):', autoRes.success ? 'PASS' : 'FAIL');
}

run();
