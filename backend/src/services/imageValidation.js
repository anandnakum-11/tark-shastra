const crypto = require('crypto');
const jpeg = require('jpeg-js');
const { PNG } = require('pngjs');

const MIN_FILE_SIZE_BYTES = 10 * 1024;
const MIN_BRIGHTNESS = 18;
const MAX_BRIGHTNESS = 245;
const MIN_VARIANCE = 120;

function parseImage(buffer, mimeType) {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return jpeg.decode(buffer, { useTArray: true });
  }

  if (mimeType === 'image/png') {
    return PNG.sync.read(buffer);
  }

  throw new Error('Unsupported image format. Use JPEG or PNG.');
}

function analyzeImage(buffer, mimeType) {
  const parsed = parseImage(buffer, mimeType);
  const { data, width, height } = parsed;

  if (!width || !height || !data || !data.length) {
    throw new Error('Invalid image data.');
  }

  let sum = 0;
  let sumSq = 0;
  let visiblePixels = 0;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    if (alpha === 0) continue;

    const gray = (0.299 * data[index]) + (0.587 * data[index + 1]) + (0.114 * data[index + 2]);
    sum += gray;
    sumSq += gray * gray;
    visiblePixels += 1;
  }

  if (!visiblePixels) {
    throw new Error('Image appears blank.');
  }

  const mean = sum / visiblePixels;
  const variance = Math.max(0, (sumSq / visiblePixels) - (mean * mean));

  return {
    width,
    height,
    brightnessScore: Number(mean.toFixed(2)),
    blurScore: Number(variance.toFixed(2)),
    isTooDark: mean < MIN_BRIGHTNESS,
    isTooBright: mean > MAX_BRIGHTNESS,
    isBlurry: variance < MIN_VARIANCE,
  };
}

function createImageHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function validateBasicPhoto(buffer, mimeType) {
  if (!buffer || !buffer.length) {
    return {
      isValid: false,
      reasons: ['Invalid photo: empty file.'],
      blurScore: 0,
      brightnessScore: 0,
      imageHash: '',
    };
  }

  if (buffer.length <= MIN_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      reasons: ['Invalid photo: file is too small.'],
      blurScore: 0,
      brightnessScore: 0,
      imageHash: createImageHash(buffer),
    };
  }

  const imageHash = createImageHash(buffer);

  try {
    const analysis = analyzeImage(buffer, mimeType);
    const reasons = [];

    if (analysis.isBlurry) reasons.push('Invalid photo: image is too blurry.');
    if (analysis.isTooDark || analysis.isTooBright) reasons.push('Invalid photo: image is too dark, too bright, or blank.');

    return {
      isValid: reasons.length === 0,
      reasons,
      blurScore: analysis.blurScore,
      brightnessScore: analysis.brightnessScore,
      imageHash,
    };
  } catch (error) {
    return {
      isValid: false,
      reasons: [`Invalid photo: ${error.message}`],
      blurScore: 0,
      brightnessScore: 0,
      imageHash,
    };
  }
}

module.exports = {
  MIN_FILE_SIZE_BYTES,
  createImageHash,
  validateBasicPhoto,
};
