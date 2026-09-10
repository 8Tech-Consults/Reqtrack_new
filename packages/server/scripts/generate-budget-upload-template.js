import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "..", "public", "templates", "budget-upload-template.xlsx");

// Header wording matches the client's own budget sheet vocabulary (Cost Type / Unit Cost)
// even though the underlying fields are still budgetLineName / unitPrice internally.
const HEADERS = ["Outcome", "Output", "Activity", "Cost Type", "Quantity", "Frequency", "Unit Cost", "Units"];

const EXAMPLE_ROWS = [
  ["Component 1", "Training", "Workshop", "Venue hire", 2, 1, 500000, "days"],
  ["Component 1", "Training", "Workshop", "Facilitator fees", 1, 3, 300000, "days"],
  ["Component 1", "Training", "Refresher", "Transport refund", 20, 1, 50000, "pax"],
  ["", "", "Office Supplies", "Printer paper", 10, 1, 25000, "reams"],
];

async function main() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Reqtrack";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Budget Lines", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Outcome", key: "outcome", width: 22 },
    { header: "Output", key: "output", width: 22 },
    { header: "Activity", key: "activity", width: 22 },
    { header: "Cost Type", key: "budgetLine", width: 26 },
    { header: "Quantity", key: "quantity", width: 12 },
    { header: "Frequency", key: "frequency", width: 12 },
    { header: "Unit Cost", key: "unitPrice", width: 14 },
    { header: "Units", key: "units", width: 14 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };
  headerRow.eachCell((cell) => {
    cell.border = { bottom: { style: "thin", color: { argb: "FF94A3B8" } } };
  });

  EXAMPLE_ROWS.forEach((values) => {
    const row = sheet.addRow(values);
    row.font = { italic: true, color: { argb: "FF64748B" } };
  });

  ["quantity", "frequency", "unitPrice"].forEach((key) => {
    const col = sheet.getColumn(key);
    col.numFmt = "#,##0.00";
  });

  const instructions = workbook.addWorksheet("Instructions");
  instructions.columns = [{ width: 100 }];
  const lines = [
    "How to fill in this template",
    "",
    "1. This file is used to upload the ENTIRE budget for ONE program. Uploading replaces that",
    "   program's current budget structure — anything not in the file will be removed.",
    "",
    "2. Delete the example rows on the 'Budget Lines' sheet (rows shown in italics) before filling",
    "   in your own data. One row = one budget line.",
    "",
    "3. Required columns for every row: Activity, Cost Type, Quantity, Frequency, Unit Cost, Units.",
    "",
    "4. Outcome and Output:",
    "   - Fill these in if the program has the full Outcome > Output > Activity structure.",
    "   - Leave them blank if this is a simple/Admin-type program (Activity + Cost Type lines only).",
    "",
    "5. Quantity and Frequency must be greater than 0. Unit Cost must be 0 or greater.",
    "",
    "6. Units is free text, e.g. 'days', 'pax', 'reams', 'trip'.",
    "",
    "7. Do not add a Total Amount column — the total for each line (Quantity x Frequency x",
    "   Unit Cost) is calculated automatically when the file is uploaded.",
    "",
    "8. Rows that belong to the same Outcome / Output / Activity should repeat that name exactly",
    "   (matching is not case-sensitive, but keep spelling consistent) so they're grouped correctly.",
    "",
    "9. Save the file as .xlsx and upload it from the program's budget page.",
  ];
  lines.forEach((line, idx) => {
    const row = instructions.addRow([line]);
    if (idx === 0) row.font = { bold: true, size: 13 };
  });

  await workbook.xlsx.writeFile(outPath);
  console.log(`Template written to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
