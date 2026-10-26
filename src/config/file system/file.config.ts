import * as fs from 'fs';
import * as path from 'path';
export interface UploadLimits {
  fileSize?: number;
  fileTypes?: Record<string, string[]>;
}

export interface UploadConfig {
  basePath: string;           // absolute or relative to process.cwd()
  publicFolder: string;
  privateFolder: string;
  folders: Record<string, string>;
  limits: UploadLimits;
  publicUrlPrefix: string;
}
export default (): { upload: UploadConfig } => {
  const basePath = process.env.UPLOAD_BASE_PATH || path.join(process.cwd(), 'uploads');
  const publicFolder = process.env.UPLOAD_PUBLIC_FOLDER || 'public';
  const privateFolder = process.env.UPLOAD_PRIVATE_FOLDER || 'private';
  const jsonPath = path.join(process.cwd(), 'config', 'upload.config.json');

  let json: any = {};
  if (fs.existsSync(jsonPath)) {
    try {
      json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch (err) {
      console.warn('Could not parse upload.config.json, using defaults', err);
      json = {};
    }
  }

  const folders = json.folders ?? { images: 'images', documents: 'documents', temp: 'tmp' };
  const limits = json.limits ?? { fileSize: Number(process.env.UPLOAD_MAX_FILE_SIZE) || 5 * 1024 * 1024 };
  const publicUrlPrefix = process.env.UPLOAD_PUBLIC_URL_PREFIX || json.publicUrlPrefix || '/uploads';

  return {
    upload: {
      basePath,
      publicFolder,
      privateFolder,
      folders,
      limits,
      publicUrlPrefix,
    },
  };
};