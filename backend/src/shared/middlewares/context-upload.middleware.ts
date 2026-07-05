import multer from "multer";
import path from "path";
import fs from "fs";
import { env } from "../config/env";

const contextUploadsDir = path.join(env.upload.dir, "orchestrator-context");
if (!fs.existsSync(contextUploadsDir)) {
  fs.mkdirSync(contextUploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, contextUploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `ctx-${uniqueSuffix}${ext}`);
  },
});

const allowedMimes = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith(".md")) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type for context upload."));
  }
};

export const contextUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.upload.maxFileSize },
});

export const uploadContextSingle = contextUpload.single("file");
