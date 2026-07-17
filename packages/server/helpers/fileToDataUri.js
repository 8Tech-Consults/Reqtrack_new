import fs from "fs";
import path from "path";

const MIME_MAP = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

export default function fileToDataUri(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_MAP[ext] || "application/octet-stream";
    const data = fs.readFileSync(filePath);
    const base64 = data.toString("base64");
    return `data:${mime};base64,${base64}`;
  } catch (e) {
    return ""; // return empty if not found or unreadable
  }
}

