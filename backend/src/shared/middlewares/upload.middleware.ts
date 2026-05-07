import multer from "multer";
import path from "path";
import fs from "fs";
import { env } from "../config/env";

const diskDir = env.upload.dir;
if (!env.objectStorage.enabled && !fs.existsSync(diskDir)) {
  fs.mkdirSync(diskDir, { recursive: true });
}

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, diskDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `blog-${uniqueSuffix}${ext}`);
  },
});

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed."));
  }
};

const storage = env.objectStorage.enabled ? multer.memoryStorage() : diskStorage;

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.upload.maxFileSize,
  },
});

export const uploadSingle = upload.single("image");

export const uploadMultiple = upload.array("images", 10);
