const fs = require('fs');
const path = require('path');
const Evidence = require('../models/Evidence');
const Grievance = require('../models/Grievance');
const { haversineDistance } = require('../utils/haversine');
const { GPS_THRESHOLD_METERS } = require('../utils/constants');
const { validateBasicPhoto } = require('./imageValidation');
const { uploadEvidenceImage, isCloudinaryConfigured } = require('../config/cloudinary');
const logger = require('../utils/logger');

const uploadsDir = path.join(__dirname, '../../uploads/evidence');

function ensureUploadsDir() {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function buildStoredPath(grievanceId, imageHash, extension) {
  ensureUploadsDir();
  const safeExtension = extension || '.jpg';
  return path.join(uploadsDir, `${grievanceId}-${imageHash}${safeExtension}`);
}

function normalizeTimestamp(timestamp) {
  const capturedAt = new Date(timestamp);
  return Number.isNaN(capturedAt.getTime()) ? null : capturedAt;
}

async function confirmEvidenceUpload({ grievanceId, file, latitude, longitude, timestamp, userId }) {
  const grievance = await Grievance.findByPk(grievanceId);
  if (!grievance) {
    throw new Error('Grievance not found');
  }

  if (!file) {
    throw new Error('Photo file is required.');
  }

  const capturedAt = normalizeTimestamp(timestamp);
  if (!capturedAt) {
    throw new Error('Valid capture timestamp is required.');
  }

  const photoValidation = validateBasicPhoto(file.buffer, file.mimetype);
  const reasons = [...photoValidation.reasons];
  const grievanceLat = Number(grievance.locationLat);
  const grievanceLng = Number(grievance.locationLng);
  const distance = haversineDistance(grievanceLat, grievanceLng, latitude, longitude);
  const isGpsValid = distance <= GPS_THRESHOLD_METERS;
  const hasPhotoIssue = reasons.length > 0;

  if (!isGpsValid) {
    reasons.push(`GPS mismatch: ${Math.round(distance)}m away from the complaint location.`);
  }

  if (!grievance.resolvedAt) {
    reasons.push('Resolution time missing for grievance.');
  } else if (capturedAt < new Date(grievance.resolvedAt)) {
    reasons.push('Invalid timestamp: photo was captured before the grievance was marked resolved.');
  }

  const duplicate = await Evidence.findOne({
    where: { imageHash: photoValidation.imageHash },
    order: [['timestamp', 'DESC']],
  });
  if (duplicate) {
    reasons.push('Duplicate image detected: this photo hash was already used.');
  }

  let verificationStatus = 'valid';
  if (!isGpsValid) {
    verificationStatus = 'suspicious';
  } else if (hasPhotoIssue || duplicate || (!grievance.resolvedAt || capturedAt < new Date(grievance.resolvedAt))) {
    verificationStatus = 'invalid';
  }

  const isValid = verificationStatus === 'valid';
  const extension = path.extname(file.originalname || '').toLowerCase() || (file.mimetype === 'image/png' ? '.png' : '.jpg');
  let storedPath = buildStoredPath(grievanceId, photoValidation.imageHash, extension);
  let imageUrl = `/uploads/evidence/${path.basename(storedPath)}`;

  if (isCloudinaryConfigured()) {
    try {
      const uploaded = await uploadEvidenceImage({
        buffer: file.buffer,
        mimeType: file.mimetype,
        grievanceId,
        imageHash: photoValidation.imageHash,
      });

      if (uploaded?.secure_url) {
        storedPath = uploaded.public_id || storedPath;
        imageUrl = uploaded.secure_url;
      } else {
        fs.writeFileSync(storedPath, file.buffer);
      }
    } catch (uploadError) {
      logger.warn(`Cloudinary upload failed for grievance ${grievanceId}: ${uploadError.message}. Falling back to local storage.`);
      fs.writeFileSync(storedPath, file.buffer);
    }
  } else {
    fs.writeFileSync(storedPath, file.buffer);
  }

  const evidence = await Evidence.create({
    grievanceId,
    officerId: userId,
    imageUrl,
    photoPath: storedPath,
    imageHash: photoValidation.imageHash,
    verificationStatus,
    verificationReason: isValid ? 'Valid Evidence' : reasons.join(' '),
    fileSizeBytes: file.size,
    lat: latitude,
    lng: longitude,
    gpsMatch: isGpsValid,
    gpsDistanceM: Math.round(distance),
    timestamp: new Date(),
    capturedAt,
    blurScore: photoValidation.blurScore,
    brightnessScore: photoValidation.brightnessScore,
  });

  logger.info(
    `Evidence uploaded for grievance ${grievanceId}: hash=${photoValidation.imageHash}, gps=(${latitude},${longitude}), distance=${Math.round(distance)}m, status=${verificationStatus}, storage=${isCloudinaryConfigured() ? 'cloudinary' : 'local'}`
  );

  if (!isValid) {
    logger.warn(`Evidence validation failed for grievance ${grievanceId}: ${reasons.join(' | ')}`);
  }

  return {
    evidence,
    isValid,
    verificationStatus: evidence.verificationStatus,
    verificationReason: evidence.verificationReason,
    distance: Math.round(distance),
    threshold: GPS_THRESHOLD_METERS,
    imageHash: photoValidation.imageHash,
    validationFailures: reasons,
    checks: {
      gpsValid: isGpsValid,
      duplicate: !!duplicate,
      timestampValid: !!grievance.resolvedAt && capturedAt >= new Date(grievance.resolvedAt),
      blurScore: photoValidation.blurScore,
      brightnessScore: photoValidation.brightnessScore,
      fileSizeBytes: file.size,
    },
  };
}

module.exports = { confirmEvidenceUpload };
