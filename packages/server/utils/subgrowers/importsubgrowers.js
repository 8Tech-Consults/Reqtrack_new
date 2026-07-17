import xlsx from "xlsx"; // To read Excel files
import { db } from "../../config/config.js";

// // Function to insert SubGrower into MySQL
// async function insertSubGrower(sub) {
//   const query = `
//     INSERT INTO subgrowers (field_name, name, size, crop, seed_class, lot_number, source_of_seed, planting_date, quantity_planted, expected_yield, phone_number, gps_latitude, gps_longitude, district, subcounty, village, planting_return_id, administrator_id)
//     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//   `;

//   const values = [
//     sub.field_name,
//     sub.name,
//     sub.size,
//     sub.crop,
//     sub.seed_class,
//     sub.lot_number,
//     sub.source_of_seed,
//     sub.planting_date,
//     sub.quantity_planted,
//     sub.expected_yield,
//     sub.phone_number,
//     sub.gps_latitude,
//     sub.gps_longitude,
//     sub.district,
//     sub.subcounty,
//     sub.village,
//     sub.planting_return_id,
//     sub.administrator_id
//   ];

//   return new Promise((resolve, reject) => {
//     db.execute(query, values, (err, result) => {
//       if (err) {
//         console.error('Error inserting sub-grower:', err);
//         reject(err);
//       } else {
//         console.log('Inserted sub-grower:', result);
//         resolve(result);
//       }
//     });
//   });
// }

export async function importSubGrowers(sub_growers_file) {
  console.log("importSubGrowers");

  if (!sub_growers_file) {
    console.log("sub_growers_file is missing or too short");
    return;
  }

  const file = `./public/Subgrower_files/${sub_growers_file}`; // Adjust path to your file storage
  console.log("File path:", file);

  try {
    const workbook = xlsx.readFile(file);
    const sheet = workbook.Sheets[workbook.SheetNames[1]]; // Getting second sheet (index 1)

    if (!sheet) {
      console.log("No sheet 2 found");
      return;
    }

    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }).slice(1); // Skip header row
    console.log("Sheet 2 found");

    const fields = {
      field_name: 0,
      name: 1,
      size: 2,
      crop: 3,
      seed_class: 4,
      lot_number: 5,
      source_of_seed: 6,
      planting_date: 7,
      quantity_planted: 8,
      expected_yield: 9,
      phone_number: 10,
      gps_latitude: 11,
      gps_longitude: 12,
      district: 13,
      subcounty: 14,
      village: 15,
    };

    // Process each row from the Excel sheet
    /* for (let index = 0; index < array.length; index++) {
        const element = array[index];
        
    } */
    const subgrowers = [];
    for (const row of rows) {
      if (row.every((cell) => !cell)) continue; // Skip empty rows

      // Process each field
      const sub = {};

      for (const [field, index] of Object.entries(fields)) {
        if (row[index] && row[index].toString().trim().length > 0) {
          if (field === "planting_date") {
            let excelDate = row[index];

            if (typeof excelDate === "number") {
              // Excel stores days since 1900-01-01
              const baseDate = new Date(1900, 0, 1);
              // Excel incorrectly treats 1900 as leap year, so adjust by -1
              baseDate.setDate(baseDate.getDate() + excelDate - 1);
              sub[field] = baseDate.toISOString().split("T")[0]; // e.g. '2025-01-02'
            } else if (typeof excelDate === "string") {
              // Try parsing manually
              const [month, day, year] = excelDate.split(/[\/\-]/); // handle 1/2/2025 or 1-2-2025
              const parsedDate = new Date(
                `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
              );
              if (!isNaN(parsedDate.getTime())) {
                sub[field] = parsedDate.toISOString().split("T")[0];
              } else {
                console.warn(`Invalid date format: ${excelDate}`);
              }
            }
          } else if (field === "crop") {
            console.log("Processing crop field:", row[index]);
            const cropDetails = row[index].match(
              /CROP:\s*(.*?),\s*VARIETY:\s*(.*)/i
            );
            if (cropDetails) {
              const cropName = cropDetails[1].trim();
              const varietyName = cropDetails[2].trim();
              const cropQuery = "SELECT id FROM crops WHERE name = ?";
              const varietyQuery =
                "SELECT id FROM crop_varieties WHERE name = ?";

              const [cropResult] = await db
                .promise()
                .query(cropQuery, [cropName]);
              const [varietyResult] = await db
                .promise()
                .query(varietyQuery, [varietyName]);

              if (cropResult.length > 0 && varietyResult.length > 0) {
                sub.crop = cropResult[0].id;
                sub.variety = varietyResult[0].id;
              } else {
                console.warn(
                  `Crop or variety not found: ${cropName}, ${varietyName}`
                );
                continue; // Skip if crop or variety is not found
              }
            }
          } else if (field === "seed_class") {
            const input = row[index].toString().trim().toLowerCase();
            const seedClassMap = {
              "pre-basic": "Pre-Basic",
              certified: "Certified seed",
              basic: "Basic seed",
              qds: "Qds",
            };

            if (seedClassMap[input]) {
              sub.seed_class = seedClassMap[input];
            } else {
              console.warn(`Unknown seed class: ${row[index]}`);
              continue; // Skip if seed class is unknown
            }
          } else {
            sub[field] = row[index];
          }
        }
      }

      subgrowers.push(sub);
    }

    // console.log('Processed sub-grower:', subgrowers);
    return subgrowers;
  } catch (error) {
    console.error("Error processing file:", error);
  }
}

export default importSubGrowers;
