function tryParseJSON(value) {
  try {
    return JSON.parse(value);
  } catch (e) {
    return value; // Return as-is if not valid JSON
  }
}

export default tryParseJSON;
