const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const crypto = require('crypto');

const CREDS_PATH = path.join(__dirname, 'computer-vision-437518-880b6948fe95.json');
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];


async function authenticateGoogleDrive() {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDS_PATH,
    scopes: SCOPES,
  });
  const driveService = google.drive({ version: 'v3', auth });
  return driveService;
}

async function uploadFileToDrive(driveService, filePath, folderId) {
  const fileMetadata = {
    name: path.basename(filePath),
    parents: [folderId],
  };
  const media = {
    mimeType: 'image/jpeg',
    body: fs.createReadStream(filePath),
  };
  try {
    const file = await driveService.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id',
    });
    return file.data.id;
  } catch (error) {
    console.error('Error uploading file:', error);
    return null;
  }
}

async function listImagesInFolder(driveService, folderId) {
  try {
    const response = await driveService.files.list({
      q: `'${folderId}' in parents and mimeType contains 'image/'`,
      spaces: 'drive',
      fields: 'nextPageToken, files(id, name, webViewLink)',
    });
    const files = response.data.files;
    if (files.length === 0) {
      console.log('No images found in the specified folder.');
      return [];
    }
    console.log('Images in the folder:');
    files.forEach(file => {
      console.log(`File: ${file.name}`);
      console.log(`ID: ${file.id}`);
      console.log(`View Link: ${file.webViewLink}`);
      console.log(`MIME Type: ${file.mimeType}`);
      console.log(`Created Time: ${file.createdTime}`);
      console.log(`Modified Time: ${file.modifiedTime}`);
      console.log(`Size: ${file.size}`);
      console.log(`Icon Link: ${file.iconLink}`);
      console.log(`Thumbnail Link: ${file.thumbnailLink}`);
      console.log(`Original Filename: ${file.originalFilename}`);
      console.log(`Md5Checksum: ${file.md5Checksum}`);
      console.log(`Mime Type: ${file.mimeType}`);
      console.log(`Full File Extension: ${file.fullFileExtension}`);
      console.log(`File Extension: ${file.fileExtension}`);
      console.log(`Head Revision Id: ${file.headRevisionId}`);
      console.log(`Thumbnail Version Id: ${file.thumbnailVersionId}`);
      console.log(`Video Media Metadata: ${file.videoMediaMetadata}`);
      
      console.log('---');
    });
    return files;
  } catch (error) {
    console.error('Error listing images:', error);
    return [];
  }
}

async function listAllItemsInFolder(driveService, folderId) {
  let allItems = [];
  let nextPageToken = null;

  do {
    try {
      const response = await driveService.files.list({
        q: `'${folderId}' in parents`,
        spaces: 'drive',
        fields: 'nextPageToken, files(id, name, mimeType, webViewLink, createdTime, modifiedTime, size, description, thumbnailLink, md5Checksum)',
        pageToken: nextPageToken
      });

      const items = response.data.files;
      allItems = allItems.concat(items);

      nextPageToken = response.data.nextPageToken;

    } catch (error) {
      console.error('Error listing items:', error);
      return allItems;
    }
  } while (nextPageToken);

  return allItems;
}

async function uploadFileIfNotDuplicate(driveService, filePath, folderId) {
  const localMd5 = await calculateMd5(filePath);
  const existingFiles = await listAllItemsInFolder(driveService, folderId);
  
  const duplicate = existingFiles.find(file => file.md5Checksum === localMd5);
  
  if (duplicate) {
    console.log(`File ${path.basename(filePath)} already exists (md5Checksum: ${duplicate.md5Checksum}). Skipping upload.`);
    return null;
  }
  
  return uploadFileToDrive(driveService, filePath, folderId);
}

function calculateMd5(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', error => reject(error));
  });
}

async function main() {
  const driveService = await authenticateGoogleDrive();

  GDRIVE_FOLDER_ID = '129pSgu94S_KTAmo-WQVyN76hnOQ1V4k2';
  IMAGE_FOLDER = path.join(__dirname, 'images');
  
  const imageFiles = fs.readdirSync(IMAGE_FOLDER).filter(file => 
    /\.(jpg|jpeg|png|gif|bmp)$/i.test(file)
  );

  for (const filename of imageFiles) {
    const filePath = path.join(IMAGE_FOLDER, filename);
    const uploadedFileId = await uploadFileIfNotDuplicate(driveService, filePath, GDRIVE_FOLDER_ID);
    if (uploadedFileId) {
      console.log(`Uploaded file ${filename} with ID: ${uploadedFileId}`);
    }
  }

  // Uncomment the following line to list images in the folder
  // await listImagesInFolder(driveService, GDRIVE_FOLDER_ID);
  const items = await listAllItemsInFolder(driveService, GDRIVE_FOLDER_ID);
  // items.forEach(item => {
  //   const itemType = item.mimeType === 'application/vnd.google-apps.folder' ? 'Folder' : 'File';
  //   console.log(`${itemType}: ${item.name} (ID: ${item.id})`);
  //   console.log(`  View Link: ${item.webViewLink}`);
  //   console.log(`  Created at: ${item.createdTime}`);
  //   console.log(`  Modified at: ${item.modifiedTime}`);
  //   if (item.size) console.log(`  Size: ${item.size} bytes`);
  //   if (item.description) console.log(`  Description: ${item.description}`);
  //   if (item.thumbnailLink) console.log(`  Thumbnail: ${item.thumbnailLink}`);
  //   console.log(`  MD5 Checksum: ${item.md5Checksum}`);
  //   console.log('---');
  // });  
}

module.exports = {
  authenticateGoogleDrive,
  uploadFileIfNotDuplicate,
  // ... (other functions you might want to export)
};