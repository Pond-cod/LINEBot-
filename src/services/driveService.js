const { drive, driveFolderId } = require('../config/google');
const { isGasConfigured, callGas } = require('./gasService');
const stream = require('stream');

/**
 * อัปโหลดไฟล์รูปภาพ Stream ขึ้น Google Drive
 */
async function uploadSlipStream(imageStream, fileName, mimeType = 'image/jpeg', userId = '', debtId = '', amount = 0) {
  if (isGasConfigured()) {
    // แปลง Readable Stream เป็น Buffer เพื่อส่งไปที่ Google Apps Script
    const chunks = [];
    for await (const chunk of imageStream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const base64 = buffer.toString('base64');

    const result = await callGas('uploadSlip', {
      userId,
      debtId,
      amount,
      imageBase64: base64,
      mimeType,
      fileName
    });

    return {
      fileId: result.driveFileId,
      webViewLink: result.slipViewUrl,
      paymentId: result.paymentId
    };
  }

  // โหมด GCP Service Account
  if (!drive || !driveFolderId) {
    throw new Error('Google Drive API is not configured or folder ID is missing');
  }

  try {
    const fileMetadata = {
      name: fileName,
      parents: [driveFolderId]
    };

    const media = {
      mimeType,
      body: imageStream
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id, name, webViewLink, webContentLink'
    });

    const fileId = response.data.id;
    let webViewLink = response.data.webViewLink;

    try {
      await drive.permissions.create({
        fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });
    } catch (permError) {
      console.warn('Could not set public permission on drive file:', permError.message);
    }

    if (!webViewLink) {
      webViewLink = `https://drive.google.com/file/d/${fileId}/view?usp=drivesdk`;
    }

    console.log(`✅ Uploaded slip to Google Drive: ${fileName} (ID: ${fileId})`);
    return {
      fileId,
      webViewLink
    };
  } catch (error) {
    console.error('❌ Failed to upload slip to Google Drive:', error.message);
    throw error;
  }
}

/**
 * อัปโหลด Buffer/Base64 ขึ้น Google Drive
 */
async function uploadSlipBuffer(buffer, fileName, mimeType = 'image/jpeg', userId = '', debtId = '', amount = 0) {
  if (isGasConfigured()) {
    const base64 = buffer.toString('base64');
    const result = await callGas('uploadSlip', {
      userId,
      debtId,
      amount,
      imageBase64: base64,
      mimeType,
      fileName
    });

    return {
      fileId: result.driveFileId,
      webViewLink: result.slipViewUrl,
      paymentId: result.paymentId
    };
  }

  const bufferStream = new stream.PassThrough();
  bufferStream.end(buffer);
  return await uploadSlipStream(bufferStream, fileName, mimeType, userId, debtId, amount);
}

module.exports = {
  uploadSlipStream,
  uploadSlipBuffer
};
