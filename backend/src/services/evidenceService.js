const Evidence = require('../models/Evidence');
const Grievance = require('../models/Grievance');
const { generatePresignedUploadUrl } = require('../config/s3');
const { haversineDistance } = require('../utils/haversine');
const { GPS_THRESHOLD_METERS } = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * Generate a presigned URL for the field officer to upload evidence.
 */
async function getUploadUrl(grievanceId, fileName, fileType) {
  const key = `evidence/${grievanceId}/${Date.now()}_${fileName}`;
  const result = await generatePresignedUploadUrl(key, fileType);
  return result;
}

/**
 * Confirm evidence upload and validate GPS coordinates.
 */
async function confirmEvidenceUpload({ grievanceId, imageKey, latitude, longitude, userId }) {
  const grievance = await Grievance.findById(grievanceId);
  if (!grievance) throw new Error('Grievance not found');

  // Calculate distance from grievance location
  const grvLat = grievance.location.coordinates[1];
  const grvLon = grievance.location.coordinates[0];
  const distance = haversineDistance(grvLat, grvLon, latitude, longitude);
  const isGpsValid = distance <= GPS_THRESHOLD_METERS;

  const imageUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${imageKey}`;

  const evidence = await Evidence.create({
    grievance: grievanceId,
    imageUrl,
    imageKey,
    latitude,
    longitude,
    distanceFromGrievance: Math.round(distance),
    isGpsValid,
    isImageValid: true, // MVP: assume valid (AI check can be added later)
    uploadedBy: userId,
    timestamp: new Date(),
  });

  logger.info(`Evidence uploaded for grievance ${grievanceId}: distance=${Math.round(distance)}m, gpsValid=${isGpsValid}`);

  return {
    evidence,
    gpsValid: isGpsValid,
    distance: Math.round(distance),
    threshold: GPS_THRESHOLD_METERS,
  };
}

module.exports = { getUploadUrl, confirmEvidenceUpload };
