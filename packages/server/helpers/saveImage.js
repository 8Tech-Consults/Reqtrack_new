import { GraphQLError } from "graphql";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const saveImage = async ({ image }) => {
  try {
    // generate unique image name
    const imageId = uuidv4();
    const folderPath = path.join(__dirname, "../public/imgs");
    const newFilename = `${imageId}.jpeg`;
    const filePath = path.join(folderPath, newFilename);

    // Ensure the directory exists
    await fs.promises.mkdir(folderPath, { recursive: true });

    // Process file upload
    const _file = await image;
    const { createReadStream } = _file;

    // Remove existing image if present
    // const existingImage = findImageWithExtension(stdno, folderPath);
    // if (existingImage) {
    //   await fs.promises
    //     .unlink(path.join(folderPath, existingImage))
    //     .catch((err) =>
    //       console.error(`Failed to delete existing image: ${err.message}`)
    //     );
    // }

    // Process and optimize the image
    try {
      const stream = createReadStream();
      const chunks = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);

      await sharp(buffer)
        .jpeg({
          quality: 80,
          chromaSubsampling: "4:4:4",
        })
        .resize(300, 300)
        .toFile(filePath);

      return newFilename;
    } catch (processError) {
      throw new GraphQLError(`Error processing image: ${processError.message}`);
    }
  } catch (error) {
    console.error("saveStudentImage error:", error);
    throw new GraphQLError(error.message || "Failed to save student image");
  }
};

export default saveImage;
