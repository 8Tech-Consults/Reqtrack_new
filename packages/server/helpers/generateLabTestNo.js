
function generateLabTestNo({
  prefix = "lab_test",
  digits = 4,
  year = new Date().getFullYear(),
} = {}) {
  const len = Math.max(1, Number(digits) || 4);
  const min = Math.pow(10, len - 1);
  const max = Math.pow(10, len) - 1;
  const code = Math.floor(min + Math.random() * (max - min + 1));
  
  return `${prefix}/${year}/${code}`;
}

export default generateLabTestNo;