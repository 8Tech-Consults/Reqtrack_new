// Generates an Import Permit Number
// Example format: "MAAIF/IMP/1234/2025" -> "{prefix}/{4 digit code}/{current year}"
// Optional params allow customizing prefix, digit length, and year.

function generateImportPermitNo({
  prefix = "MAAIF/IMP",
  digits = 4,
  year = new Date().getFullYear(),
} = {}) {
  const len = Math.max(1, Number(digits) || 4);
  const min = Math.pow(10, len - 1);
  const max = Math.pow(10, len) - 1;
  const code = Math.floor(min + Math.random() * (max - min + 1));
  // return `${prefix}/${code}/${year}`;
  return code;
}

export default generateImportPermitNo;
