import { GraphQLError } from "graphql";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Saves a GraphQL Upload to disk and returns metadata
// Params: { file, subdir?: string, isPrivate?: boolean, maxSize?: number, verifySignature?: boolean }
// - file: the Upload promise/object
// - subdir: sub-directory inside public/ or private_uploads/ to store files
// - isPrivate: if true, stores files outside public/ web root
// - maxSize: maximum size limit in bytes (e.g. 10 * 1024 * 1024 for 10MB)
// - verifySignature: if true, validates file magic bytes (Excel/CSV)
// Returns: { filename, path, mimetype, encoding, originalName }
const saveUpload = async ({ 
  file, 
  subdir = "attachments", 
  isPrivate = false, 
  maxSize = null, 
  verifySignature = false 
}) => {
  let filePath = "";
  try {
    const upload = await file; // { filename, mimetype, encoding, createReadStream }
    if (!upload || typeof upload.createReadStream !== "function") {
      throw new GraphQLError("Invalid upload payload");
    }

    const { filename: originalName, mimetype, encoding, createReadStream } = upload;

    const ext = path.extname(originalName || "").toLowerCase();
    const id = uuidv4();
    const newFilename = `${id}${ext || ""}`;

    const baseDir = isPrivate ? "../private_uploads" : "../public";
    const folderPath = path.join(__dirname, baseDir, subdir);
    console.log("Saving upload to:", folderPath);
    await fs.promises.mkdir(folderPath, { recursive: true });

    filePath = path.join(folderPath, newFilename);
    const resultPath = isPrivate 
      ? path.posix.join("private_uploads", subdir, newFilename)
      : path.posix.join(subdir, newFilename);

    const stream = createReadStream();
    let bytesWritten = 0;

    await new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(filePath);
      
      stream.on("data", (chunk) => {
        bytesWritten += chunk.length;
        if (maxSize && bytesWritten > maxSize) {
          writeStream.destroy();
          stream.destroy();
          fs.unlink(filePath, () => {});
          reject(new GraphQLError(`File size exceeds the limit of ${maxSize / (1024 * 1024)}MB`));
        }
      });

      writeStream.on("finish", resolve);
      writeStream.on("error", (err) => {
        fs.unlink(filePath, () => {});
        reject(err);
      });
      stream.on("error", (err) => {
        fs.unlink(filePath, () => {});
        reject(err);
      });
      stream.pipe(writeStream);
    });

    // Magic Bytes/Signature validation for Excel / CSV
    if (verifySignature) {
      if (!fs.existsSync(filePath)) {
        throw new GraphQLError("Upload file was not written to disk");
      }

      // Read first 8 bytes
      const fd = await fs.promises.open(filePath, "r");
      const buffer = Buffer.alloc(8);
      await fd.read(buffer, 0, 8, 0);
      await fd.close();

      const hex = buffer.toString("hex").toUpperCase();
      const isXlsx = hex.startsWith("504B0304"); // PK ZIP
      const isXls = hex.startsWith("D0CF11E0A1B11AE1"); // Legacy compound binary

      let isCsv = false;
      if (!isXlsx && !isXls) {
        // Simple plain text validation (no null bytes in the first 1KB)
        const fdText = await fs.promises.open(filePath, "r");
        const textBuffer = Buffer.alloc(1024);
        const { bytesRead } = await fdText.read(textBuffer, 0, 1024, 0);
        await fdText.close();

        let hasNullByte = false;
        for (let i = 0; i < bytesRead; i++) {
          if (textBuffer[i] === 0) {
            hasNullByte = true;
            break;
          }
        }
        isCsv = !hasNullByte && bytesRead > 0;
      }

      let isValid = false;
      if (ext === ".xlsx" && isXlsx) isValid = true;
      else if (ext === ".xls" && isXls) isValid = true;
      else if (ext === ".csv" && isCsv) isValid = true;

      if (!isValid) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {}
        throw new GraphQLError("Invalid file content signature. Only genuine Excel (.xlsx, .xls) and CSV (.csv) files are allowed.");
      }
    }

    return {
      filename: newFilename,
      path: resultPath,
      mimetype,
      encoding,
      originalName: originalName || newFilename,
    };
  } catch (error) {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {}
    }
    if (error instanceof GraphQLError) {
      throw error;
    }
    throw new GraphQLError(error.message || "Failed to save upload");
  }
};

export default saveUpload;


