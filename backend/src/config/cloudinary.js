const crypto = require('crypto');
const https = require('https');
const querystring = require('querystring');

function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

function buildSignature(params) {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return crypto
    .createHash('sha1')
    .update(`${payload}${process.env.CLOUDINARY_API_SECRET}`)
    .digest('hex');
}

function postForm(pathname, body) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: 'api.cloudinary.com',
        path: pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (response) => {
        let responseBody = '';

        response.on('data', (chunk) => {
          responseBody += chunk;
        });

        response.on('end', () => {
          const parsed = responseBody ? JSON.parse(responseBody) : {};
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(parsed);
            return;
          }

          reject(new Error(parsed.error?.message || `Cloudinary upload failed with status ${response.statusCode}.`));
        });
      }
    );

    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

async function uploadEvidenceImage({ buffer, mimeType, grievanceId, imageHash }) {
  if (!isCloudinaryConfigured()) {
    return null;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = process.env.CLOUDINARY_FOLDER || 'sakshyaai/evidence';
  const publicId = `grievance-${grievanceId}-${imageHash.slice(0, 16)}`;
  const signatureParams = {
    folder,
    public_id: publicId,
    resource_type: 'image',
    timestamp,
  };

  const signature = buildSignature(signatureParams);
  const body = querystring.stringify({
    ...signatureParams,
    api_key: process.env.CLOUDINARY_API_KEY,
    signature,
    file: `data:${mimeType};base64,${buffer.toString('base64')}`,
  });

  return postForm(`/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`, body);
}

module.exports = {
  isCloudinaryConfigured,
  uploadEvidenceImage,
};
