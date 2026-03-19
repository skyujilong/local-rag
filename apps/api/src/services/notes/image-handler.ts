/**
 * 图片处理服务
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { generateId } from '@local-rag/shared/utils';
import type { NoteImage } from '@local-rag/shared/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(__dirname, '../../../uploads');

/**
 * 保存图片
 */
export async function saveImage(file: Express.Multer.File): Promise<NoteImage> {
  const imageId = generateId('img');

  const imageData: NoteImage = {
    id: imageId,
    filename: file.filename,
    path: `/uploads/${file.filename}`,
    size: file.size,
    mimeType: file.mimetype,
  };

  return imageData;
}

/**
 * 删除图片
 */
export async function deleteImage(imageId: string): Promise<boolean> {
  try {
    // 从文件名中查找图片
    const files = await fs.readdir(UPLOADS_DIR);
    const imageFile = files.find(f => f.startsWith(imageId));

    if (imageFile) {
      await fs.unlink(path.join(UPLOADS_DIR, imageFile));
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * 获取图片 URL
 */
export function getImageUrl(filename: string): string {
  return `/uploads/${filename}`;
}
