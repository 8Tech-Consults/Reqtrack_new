// Generates a Seed Board Registration Number
// Example: "MAAIF/MER/1029/2025" -> "MAAIF/MER/{4 digit random}/{current year}"
// Optional params allow customizing prefix, digit length, and year.

function generateSeedBoardRegNo({
  prefix = "MAAIF/MER",
  digits = 4,
  year = new Date().getFullYear(),
} = {}) {
  // Ensure digits is at least 1
  const len = Math.max(1, Number(digits) || 4);

  // Generate a numeric code with the required length (no leading zero)
  const min = Math.pow(10, len - 1);
  const max = Math.pow(10, len) - 1;
  const code = Math.floor(min + Math.random() * (max - min + 1));

  return `${prefix}/${code}/${year}`;
}

export default generateSeedBoardRegNo;
