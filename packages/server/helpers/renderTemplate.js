import fs from "fs";

// Very simple template renderer that replaces {{key}} with value
// Usage: renderTemplate({ templatePath, data }) -> string
const renderTemplate = ({ templatePath, data = {} }) => {
  let tpl = fs.readFileSync(templatePath, "utf8");
  // Replace all {{key}} placeholders. Values are stringified.
  Object.entries(data).forEach(([key, value]) => {
    const safe = value === undefined || value === null ? "" : String(value);
    const re = new RegExp(`\\{{\\s*${key}\\s*\\}}`, "g");
    tpl = tpl.replace(re, safe);
  });
  // Remove any unreplaced placeholders to keep it tidy
  tpl = tpl.replace(/\\{\\{[^}]+\\}\\}/g, "");
  return tpl;
};

export default renderTemplate;

