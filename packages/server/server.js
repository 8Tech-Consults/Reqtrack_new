// npm install @apollo/server @as-integrations/express5 express graphql cors
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { expressMiddleware } from "@as-integrations/express5";
import express from "express";
import http from "http";
import { randomUUID } from "node:crypto";
import cors from "cors";
import path from "path";
import ExcelJS from "exceljs";
import { typeDefs, resolvers } from "./schema/index.js";
import { host, port, db } from "./config/config.js";
import authenticateUser from "./middleware/auth.js";
import {
  hasUsableBearerToken,
  isPublicGraphqlOperation,
} from "./utils/graphqlPublicAccess.js";
import { logError, requestLogContext } from "./utils/logger.js";
import graphqlUploadExpress from "graphql-upload/graphqlUploadExpress.mjs";
import {
  chat as aiChat,
  explainError as aiExplainError,
  suggestActions as aiSuggestActions,
  summarize as aiSummarize,
} from "./services/pwdAiAssistantService.js";


import dotenv from "dotenv";
dotenv.config();

// Required logic for integrating with Express
const app = express();
// Our httpServer handles incoming requests to our Express app.
// Below, we tell Apollo Server to "drain" this httpServer,
// enabling our servers to shut down gracefully.

app.use((req, res, next) => {
  const incomingRequestId = req.headers["x-request-id"];
  req.requestId =
    typeof incomingRequestId === "string" &&
    /^[a-zA-Z0-9._:-]{1,128}$/.test(incomingRequestId)
      ? incomingRequestId
      : randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
});

app.use(express.static("public"));
app.use(cors({ origin: "*", exposedHeaders: ["x-request-id"] }));
app.use(express.json());
const httpServer = http.createServer(app);

const PWD_TEMPLATE_FILE = "Pwd_Profiling_EightTech.xlsx";
const PWD_TEMPLATE_SOURCE_SHEET = "_pwd_dropdowns_source";
const DISTRICT_TEMPLATE_HEADERS = new Set([
  "district",
  "district_of_origin",
  "district_of_residence",
]);
const GENDER_TEMPLATE_HEADERS = new Set(["gender", "sex"]);
const PHONE_TEMPLATE_HEADERS = new Set([
  "phone_number",
  "phone",
  "phone_no",
  "mobile",
  "telephone",
]);
const ALT_PHONE_TEMPLATE_HEADERS = new Set([
  "alternative_phone_no",
  "alternative_phone_number",
  "alternative_phone",
  "alt_phone_no",
  "alt_phone",
]);
const ID_NUMBER_TEMPLATE_HEADERS = new Set([
  "id_number",
  "identification_number",
  "national_id",
]);
const EMPLOYMENT_TEMPLATE_HEADERS = new Set([
  "employment",
  "employment_status",
  "employed",
  "is_employed",
]);
const DOB_TEMPLATE_HEADERS = new Set(["date_of_birth", "dob", "birth_date"]);
const AGE_TEMPLATE_HEADERS = new Set(["age"]);
const DISABILITY_TEMPLATE_HEADERS = new Set([
  "select_the_disability",
  "disability",
  "disabilities",
  "disability_1",
  "disability_2",
  "disability_3",
]);
const TEMPLATE_DISABILITY_COLUMN_COUNT = 3;

const normalizeTemplateHeader = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

const findTemplateColumnNumber = (worksheet, headerSet) => {
  let resolvedColumn = null;
  const headerRow = worksheet.getRow(1);

  headerRow.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
    if (resolvedColumn) return;
    const normalizedHeader = normalizeTemplateHeader(cell.value);
    if (headerSet.has(normalizedHeader)) {
      resolvedColumn = columnNumber;
    }
  });

  return resolvedColumn;
};

const findTemplateColumnNumbers = (worksheet, matcher) => {
  const columns = [];
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
    const normalizedHeader = normalizeTemplateHeader(cell.value);
    if (matcher(normalizedHeader)) {
      columns.push(columnNumber);
    }
  });
  return columns;
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildVerificationPage = ({ isValid, message, label }) => {
  const statusClass = isValid ? "status-valid" : "status-invalid";
  const details = label
    ? [
        ["Label ID", label.id],
        ["Status", label.status?.toUpperCase() ?? "—"],
        ["Crop", label.crop_name ?? "—"],
        ["Variety", label.variety_name ?? "—"],
        ["Quantity", label.quantity ? `${label.quantity} kgs` : "—"],
        ["Package", label.label_package ?? "—"],
        ["Applicant", label.applicant_name ?? label.username ?? "—"],
        ["Location", label.location ?? "—"],
        [
          "Issued",
          label.created_at
            ? new Date(label.created_at).toLocaleDateString("en-GB")
            : "—",
        ],
      ]
        .map(
          ([title, value]) => `
        <div class="row">
          <dt>${escapeHtml(title)}</dt>
          <dd>${escapeHtml(value ?? "—")}</dd>
        </div>`
        )
        .join("")
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <title>Seed Label Verification</title>
    <style>
      body {
        margin: 0;
        padding: 32px 16px;
        font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: #f1f5f9;
        color: #0f172a;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .card {
        width: 100%;
        max-width: 520px;
        background: #fff;
        border-radius: 18px;
        padding: clamp(20px, 5vw, 32px);
        box-shadow: 0 20px 40px rgba(15, 23, 42, 0.12);
        border: 1px solid #e2e8f0;
      }
      h1 {
        margin: 0;
        font-size: 28px;
        letter-spacing: 0.02em;
      }
      p.message {
        margin: 12px 0 24px;
        font-size: 16px;
        color: #475569;
      }
      .status-valid {
        color: #0f766e;
      }
      .status-invalid {
        color: #b91c1c;
      }
      .details {
        display: grid;
        gap: 12px;
      }
      .row {
        display: flex;
        justify-content: space-between;
        border-bottom: 1px dashed #e2e8f0;
        padding-bottom: 8px;
      }
      dt {
        font-weight: 600;
        text-transform: uppercase;
        font-size: 12px;
        letter-spacing: 0.08em;
        color: #64748b;
        flex: 1;
      }
      dd {
        margin: 0;
        flex: 1.3;
        text-align: right;
        font-weight: 600;
        color: #0f172a;
      }
      .footer-note {
        margin-top: 24px;
        font-size: 13px;
        color: #94a3b8;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1 class="${statusClass}">${
        isValid ? "Seed Label Verified" : "Invalid Seed Label"
      }</h1>
      <p class="message">${escapeHtml(message)}</p>
      <section class="details">
        ${details}
      </section>
    </main>
  </body>
</html>`;
};

app.get("/templates/pwd-profiling-template.xlsx", async (_req, res) => {
  try {
    const templatePath = path.join(
      process.cwd(),
      "public",
      "templates",
      PWD_TEMPLATE_FILE
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(500).json({ error: "Template worksheet not found" });
    }

    let districtColumn = findTemplateColumnNumber(
      worksheet,
      DISTRICT_TEMPLATE_HEADERS
    );
    let genderColumn = findTemplateColumnNumber(
      worksheet,
      GENDER_TEMPLATE_HEADERS
    );
    let phoneColumn = findTemplateColumnNumber(
      worksheet,
      PHONE_TEMPLATE_HEADERS
    );
    let alternativePhoneColumn = findTemplateColumnNumber(
      worksheet,
      ALT_PHONE_TEMPLATE_HEADERS
    );
    let idNumberColumn = findTemplateColumnNumber(
      worksheet,
      ID_NUMBER_TEMPLATE_HEADERS
    );
    let employmentColumn = findTemplateColumnNumber(
      worksheet,
      EMPLOYMENT_TEMPLATE_HEADERS
    );
    let dobColumn = findTemplateColumnNumber(worksheet, DOB_TEMPLATE_HEADERS);
    let ageColumn = findTemplateColumnNumber(worksheet, AGE_TEMPLATE_HEADERS);
    let disabilityColumns = findTemplateColumnNumbers(
      worksheet,
      (header) =>
        DISABILITY_TEMPLATE_HEADERS.has(header) ||
        /^disability(_\d+)?$/.test(header) ||
        /^select_the_disability(_\d+)?$/.test(header)
    );

    const missingColumns = [];
    if (!districtColumn) missingColumns.push("District");
    if (!genderColumn) missingColumns.push("Gender");
    if (!phoneColumn) missingColumns.push("Phone Number");
    if (!disabilityColumns.length) missingColumns.push("Disabilities");

    if (missingColumns.length > 0) {
      return res
        .status(500)
        .json({
          error: `Template column(s) not found: ${missingColumns.join(", ")}`,
        });
    }

    if (!alternativePhoneColumn && phoneColumn) {
      const insertAt = phoneColumn + 1;
      worksheet.spliceColumns(insertAt, 0, [""]);
      worksheet.getCell(1, insertAt).value = "Alternative Phone No";

      // Re-resolve shifted columns after insertion.
      districtColumn = findTemplateColumnNumber(
        worksheet,
        DISTRICT_TEMPLATE_HEADERS
      );
      genderColumn = findTemplateColumnNumber(
        worksheet,
        GENDER_TEMPLATE_HEADERS
      );
      phoneColumn = findTemplateColumnNumber(worksheet, PHONE_TEMPLATE_HEADERS);
      alternativePhoneColumn = findTemplateColumnNumber(
        worksheet,
        ALT_PHONE_TEMPLATE_HEADERS
      );
      idNumberColumn = findTemplateColumnNumber(
        worksheet,
        ID_NUMBER_TEMPLATE_HEADERS
      );
      employmentColumn = findTemplateColumnNumber(
        worksheet,
        EMPLOYMENT_TEMPLATE_HEADERS
      );
      dobColumn = findTemplateColumnNumber(worksheet, DOB_TEMPLATE_HEADERS);
      ageColumn = findTemplateColumnNumber(worksheet, AGE_TEMPLATE_HEADERS);
      disabilityColumns = findTemplateColumnNumbers(
        worksheet,
        (header) =>
          DISABILITY_TEMPLATE_HEADERS.has(header) ||
          /^disability(_\d+)?$/.test(header) ||
          /^select_the_disability(_\d+)?$/.test(header)
      );
    }

    if (!idNumberColumn) {
      const anchorColumn = alternativePhoneColumn || phoneColumn;
      const insertAt = anchorColumn
        ? anchorColumn + 1
        : districtColumn || worksheet.columnCount + 1;
      worksheet.spliceColumns(insertAt, 0, [""]);
      worksheet.getCell(1, insertAt).value = "ID Number";

      // Re-resolve shifted columns after insertion.
      districtColumn = findTemplateColumnNumber(
        worksheet,
        DISTRICT_TEMPLATE_HEADERS
      );
      genderColumn = findTemplateColumnNumber(
        worksheet,
        GENDER_TEMPLATE_HEADERS
      );
      phoneColumn = findTemplateColumnNumber(worksheet, PHONE_TEMPLATE_HEADERS);
      alternativePhoneColumn = findTemplateColumnNumber(
        worksheet,
        ALT_PHONE_TEMPLATE_HEADERS
      );
      idNumberColumn = findTemplateColumnNumber(
        worksheet,
        ID_NUMBER_TEMPLATE_HEADERS
      );
      employmentColumn = findTemplateColumnNumber(
        worksheet,
        EMPLOYMENT_TEMPLATE_HEADERS
      );
      dobColumn = findTemplateColumnNumber(worksheet, DOB_TEMPLATE_HEADERS);
      ageColumn = findTemplateColumnNumber(worksheet, AGE_TEMPLATE_HEADERS);
      disabilityColumns = findTemplateColumnNumbers(
        worksheet,
        (header) =>
          DISABILITY_TEMPLATE_HEADERS.has(header) ||
          /^disability(_\d+)?$/.test(header) ||
          /^select_the_disability(_\d+)?$/.test(header)
      );
    }

    if (!employmentColumn) {
      const anchorColumn = idNumberColumn || alternativePhoneColumn || phoneColumn;
      const insertAt = anchorColumn
        ? anchorColumn + 1
        : districtColumn || worksheet.columnCount + 1;
      worksheet.spliceColumns(insertAt, 0, [""]);
      worksheet.getCell(1, insertAt).value = "Employment";

      // Re-resolve shifted columns after insertion.
      districtColumn = findTemplateColumnNumber(
        worksheet,
        DISTRICT_TEMPLATE_HEADERS
      );
      genderColumn = findTemplateColumnNumber(
        worksheet,
        GENDER_TEMPLATE_HEADERS
      );
      phoneColumn = findTemplateColumnNumber(worksheet, PHONE_TEMPLATE_HEADERS);
      alternativePhoneColumn = findTemplateColumnNumber(
        worksheet,
        ALT_PHONE_TEMPLATE_HEADERS
      );
      idNumberColumn = findTemplateColumnNumber(
        worksheet,
        ID_NUMBER_TEMPLATE_HEADERS
      );
      employmentColumn = findTemplateColumnNumber(
        worksheet,
        EMPLOYMENT_TEMPLATE_HEADERS
      );
      dobColumn = findTemplateColumnNumber(worksheet, DOB_TEMPLATE_HEADERS);
      ageColumn = findTemplateColumnNumber(worksheet, AGE_TEMPLATE_HEADERS);
      disabilityColumns = findTemplateColumnNumbers(
        worksheet,
        (header) =>
          DISABILITY_TEMPLATE_HEADERS.has(header) ||
          /^disability(_\d+)?$/.test(header) ||
          /^select_the_disability(_\d+)?$/.test(header)
      );
    }

    const [districtRows] = await db.execute(
      "SELECT name FROM districts WHERE name IS NOT NULL AND TRIM(name) <> '' ORDER BY name ASC"
    );
    const [disabilityRows] = await db.execute(
      "SELECT name FROM disabilities WHERE deleted = 0 AND name IS NOT NULL AND TRIM(name) <> '' ORDER BY name ASC"
    );

    const districtNames = Array.from(
      new Set(
        districtRows
          .map((row) => String(row?.name ?? "").trim())
          .filter(Boolean)
      )
    );
    const disabilityNames = Array.from(
      new Set(
        disabilityRows
          .map((row) => String(row?.name ?? "").trim())
          .filter(Boolean)
      )
    );
    const genderValues = ["M", "F"];

    if (districtNames.length === 0) {
      return res.status(500).json({ error: "No districts found in database" });
    }
    if (disabilityNames.length === 0) {
      return res
        .status(500)
        .json({ error: "No disabilities found in database" });
    }

    if (disabilityColumns.length < TEMPLATE_DISABILITY_COLUMN_COUNT) {
      const anchorColumn = disabilityColumns[0];
      const toAdd = TEMPLATE_DISABILITY_COLUMN_COUNT - disabilityColumns.length;
      const insertAt = anchorColumn + 1;
      worksheet.spliceColumns(insertAt, 0, ...new Array(toAdd).fill([""]));

      for (let i = 2; i <= TEMPLATE_DISABILITY_COLUMN_COUNT; i += 1) {
        worksheet.getCell(1, anchorColumn + i - 1).value = `Disability ${i}`;
      }

      disabilityColumns = findTemplateColumnNumbers(
        worksheet,
        (header) =>
          DISABILITY_TEMPLATE_HEADERS.has(header) ||
          /^disability(_\d+)?$/.test(header) ||
          /^select_the_disability(_\d+)?$/.test(header)
      );

      // Column insertions can shift downstream columns (including district/gender).
      districtColumn = findTemplateColumnNumber(
        worksheet,
        DISTRICT_TEMPLATE_HEADERS
      );
      genderColumn = findTemplateColumnNumber(
        worksheet,
        GENDER_TEMPLATE_HEADERS
      );
      phoneColumn = findTemplateColumnNumber(worksheet, PHONE_TEMPLATE_HEADERS);
      alternativePhoneColumn = findTemplateColumnNumber(
        worksheet,
        ALT_PHONE_TEMPLATE_HEADERS
      );
      idNumberColumn = findTemplateColumnNumber(
        worksheet,
        ID_NUMBER_TEMPLATE_HEADERS
      );
      employmentColumn = findTemplateColumnNumber(
        worksheet,
        EMPLOYMENT_TEMPLATE_HEADERS
      );
      dobColumn = findTemplateColumnNumber(worksheet, DOB_TEMPLATE_HEADERS);
      ageColumn = findTemplateColumnNumber(worksheet, AGE_TEMPLATE_HEADERS);
    }

    if (!dobColumn || !ageColumn) {
      const columnsToInsert = [];
      if (!dobColumn) columnsToInsert.push([""]);
      if (!ageColumn) columnsToInsert.push([""]);

      const insertAt = phoneColumn
        ? phoneColumn + 1
        : districtColumn || worksheet.columnCount + 1;
      worksheet.spliceColumns(insertAt, 0, ...columnsToInsert);

      let cursor = insertAt;
      if (!dobColumn) {
        worksheet.getCell(1, cursor).value = "Date of Birth";
        dobColumn = cursor;
        cursor += 1;
      }
      if (!ageColumn) {
        worksheet.getCell(1, cursor).value = "Age";
        ageColumn = cursor;
      }

      // Re-resolve shifted columns after insertion.
      districtColumn = findTemplateColumnNumber(
        worksheet,
        DISTRICT_TEMPLATE_HEADERS
      );
      genderColumn = findTemplateColumnNumber(
        worksheet,
        GENDER_TEMPLATE_HEADERS
      );
      phoneColumn = findTemplateColumnNumber(worksheet, PHONE_TEMPLATE_HEADERS);
      alternativePhoneColumn = findTemplateColumnNumber(
        worksheet,
        ALT_PHONE_TEMPLATE_HEADERS
      );
      idNumberColumn = findTemplateColumnNumber(
        worksheet,
        ID_NUMBER_TEMPLATE_HEADERS
      );
      employmentColumn = findTemplateColumnNumber(
        worksheet,
        EMPLOYMENT_TEMPLATE_HEADERS
      );
      dobColumn = findTemplateColumnNumber(worksheet, DOB_TEMPLATE_HEADERS);
      ageColumn = findTemplateColumnNumber(worksheet, AGE_TEMPLATE_HEADERS);
      disabilityColumns = findTemplateColumnNumbers(
        worksheet,
        (header) =>
          DISABILITY_TEMPLATE_HEADERS.has(header) ||
          /^disability(_\d+)?$/.test(header) ||
          /^select_the_disability(_\d+)?$/.test(header)
      );
    }

    const existingSource = workbook.getWorksheet(PWD_TEMPLATE_SOURCE_SHEET);
    if (existingSource) {
      workbook.removeWorksheet(existingSource.id);
    }

    const districtSourceSheet = workbook.addWorksheet(PWD_TEMPLATE_SOURCE_SHEET);
    districtNames.forEach((name, index) => {
      districtSourceSheet.getCell(index + 1, 1).value = name;
    });
    disabilityNames.forEach((name, index) => {
      districtSourceSheet.getCell(index + 1, 2).value = name;
    });
    genderValues.forEach((name, index) => {
      districtSourceSheet.getCell(index + 1, 3).value = name;
    });
    districtSourceSheet.state = "veryHidden";

    const districtFormula = `='${PWD_TEMPLATE_SOURCE_SHEET}'!$A$1:$A$${districtNames.length}`;
    const disabilityFormula = `='${PWD_TEMPLATE_SOURCE_SHEET}'!$B$1:$B$${disabilityNames.length}`;
    const genderFormula = `='${PWD_TEMPLATE_SOURCE_SHEET}'!$C$1:$C$${genderValues.length}`;
    const validationEndRow = 5000;
    if (phoneColumn) {
      worksheet.getColumn(phoneColumn).numFmt = "@";
    }
    if (alternativePhoneColumn) {
      worksheet.getColumn(alternativePhoneColumn).numFmt = "@";
    }
    if (idNumberColumn) {
      worksheet.getColumn(idNumberColumn).numFmt = "@";
    }
    if (employmentColumn) {
      worksheet.getColumn(employmentColumn).numFmt = "@";
    }

    for (let row = 2; row <= validationEndRow; row += 1) {
      const districtCell = worksheet.getCell(row, districtColumn);
      districtCell.dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: [districtFormula],
        showErrorMessage: true,
        errorStyle: "error",
        errorTitle: "Invalid District",
        error: "Please select a district from the dropdown list.",
      };

      const genderCell = worksheet.getCell(row, genderColumn);
      genderCell.dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: [genderFormula],
        showErrorMessage: true,
        errorStyle: "error",
        errorTitle: "Invalid Gender",
        error: "Please select gender as M or F.",
      };

      if (dobColumn) {
        const dobCell = worksheet.getCell(row, dobColumn);
        dobCell.numFmt = "yyyy-mm-dd";
        dobCell.dataValidation = {
          type: "date",
          allowBlank: true,
          operator: "between",
          formulae: ["DATE(1900,1,1)", "TODAY()"],
          showErrorMessage: true,
          errorStyle: "error",
          errorTitle: "Invalid Date of Birth",
          error: "Enter a valid date of birth in the past.",
        };
      }

      if (ageColumn) {
        const ageCell = worksheet.getCell(row, ageColumn);
        ageCell.numFmt = "0";
      }

      disabilityColumns.forEach((columnNumber) => {
        const disabilityCell = worksheet.getCell(row, columnNumber);
        disabilityCell.dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [disabilityFormula],
          showErrorMessage: true,
          errorStyle: "error",
          errorTitle: "Invalid Disability",
          error: "Please select a disability from the dropdown list.",
        };
      });
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${PWD_TEMPLATE_FILE}"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Failed to generate PWD import template:", error);
    return res
      .status(500)
      .json({ error: "Failed to generate PWD import template" });
  }
});

app.get("/verify/seed-label/:id", async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).send(
      buildVerificationPage({
        isValid: false,
        message: "Invalid request. Label identifier is missing.",
      })
    );
  }

  try {
    const [rows] = await db.execute(
      `SELECT
        sl.id,
        sl.status,
        sl.label_package,
        sl.quantity,
        sl.created_at,
        u.name AS applicant_name,
        u.username,
        COALESCE(NULLIF(CONCAT_WS(', ', u.premises_location, u.district), ''), NULL) AS location,
        cv.name AS variety_name,
        c.name AS crop_name
      FROM seed_labels sl
      LEFT JOIN users u ON u.id = sl.user_id
      LEFT JOIN crop_varieties cv ON cv.id = sl.crop_variety_id
      LEFT JOIN crops c ON c.id = cv.crop_id
      WHERE sl.deleted = 0 AND sl.id = ?
      LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).send(
        buildVerificationPage({
          isValid: false,
          message: "Seed label not found or has been revoked.",
        })
      );
    }

    const label = rows[0];
    const normalizedStatus = String(label.status || "").toLowerCase();
    const isValid = ["printed", "approved"].includes(normalizedStatus);

    const message = isValid
      ? "This seed label matches a printed record in the national tracking system."
      : "This record exists but is not currently marked as a valid printed label.";

    return res
      .status(isValid ? 200 : 400)
      .send(buildVerificationPage({ isValid, message, label }));
  } catch (error) {
    console.error("Seed label verification error:", error);
    return res.status(500).send(
      buildVerificationPage({
        isValid: false,
        message:
          "Unable to verify this label right now. Please try again later.",
      })
    );
  }
});

// cointries api
app.get("/countries", async (req, res) => {
  try {
    const response = await fetch("https://www.apicountries.com/countries");
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

const apiSuccess = (res, data, message = "OK") =>
  res.json({ code: 1, status: 1, message, data });

const apiError = (res, message, status = 400) =>
  res.status(status).json({ code: 0, status: 0, message, data: null });

app.post("/api/ai/chat", async (req, res) => {
  const message = String(req.body?.message || "").trim();
  if (!message || message.length > 2000) {
    return apiError(
      res,
      "Message is required and must be 2000 characters or fewer."
    );
  }

  try {
    const data = await aiChat(message, req.body?.context || {});
    return apiSuccess(res, data, "AI response generated.");
  } catch (error) {
    console.error("AI chat route error:", error);
    return apiError(
      res,
      "AI assistant is temporarily unavailable. Please try again.",
      500
    );
  }
});

app.post("/api/ai/suggest-actions", async (req, res) => {
  try {
    const data = await aiSuggestActions(req.body?.goal || "", req.body?.context || {});
    return apiSuccess(res, data, "AI actions generated.");
  } catch (error) {
    console.error("AI suggest actions route error:", error);
    return apiError(res, "Unable to suggest actions right now.", 500);
  }
});

app.post("/api/ai/explain-error", async (req, res) => {
  try {
    const data = await aiExplainError(
      req.body?.error || "",
      req.body?.context || {}
    );
    return apiSuccess(res, data, "AI error explanation generated.");
  } catch (error) {
    console.error("AI explain error route error:", error);
    return apiError(res, "Unable to explain this error right now.", 500);
  }
});

app.post("/api/ai/summarize", async (req, res) => {
  try {
    const data = await aiSummarize(req.body?.text || "", req.body?.mode || "simple");
    return apiSuccess(res, data, "AI summary generated.");
  } catch (error) {
    console.error("AI summarize route error:", error);
    return apiError(res, "Unable to summarize this content right now.", 500);
  }
});

// Same ApolloServer initialization as before, plus the drain plugin
// for our httpServer.
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    {
      async requestDidStart() {
        return {
          async didEncounterErrors(requestContext) {
            const req = requestContext.contextValue?.req;
            for (const error of requestContext.errors) {
              logError("graphql_request_failed", error, {
                ...requestLogContext(req),
                operation_name: requestContext.request.operationName || null,
              });
            }
          },
        };
      },
    },
  ],
  csrfPrevention: true,
  includeStacktraceInErrorResponses: process.env.NODE_ENV !== "production",
});
// Ensure we wait for our server to start
await server.start();

// Set up our Express middleware to handle CORS, body parsing,
// and our expressMiddleware function.
app.use(
  "/graphql",
  cors({ origin: "*", exposedHeaders: ["x-request-id"] }),
  express.json(),
  graphqlUploadExpress(),
  // expressMiddleware accepts the same arguments:
  // an Apollo Server instance and optional configuration options
  expressMiddleware(server, {
    context: async ({ req, res }) => {
      const publicOperation = isPublicGraphqlOperation({
        operationName: req.body?.operationName || req.query?.operationName,
        query: req.body?.query || req.query?.query,
      });
      const hasUsableCredentials = hasUsableBearerToken(req.headers.authorization);

      if (hasUsableCredentials || !publicOperation) {
        await authenticateUser({ req });
      }

      return {
        req,
        res,
        // loaders: createLoaders(),
        // logUserAction: (params) =>
        //   logUserAction({
        //     ...params,
        //     ip_address: req.ip,
        //     user_agent: req.headers["user-agent"],
        //   }),
      };
    },
  })
);

// Modified server startup
await new Promise((resolve) => httpServer.listen({ port }, resolve));
console.log(`🚀 Server ready at http://${host}:${port}`);
