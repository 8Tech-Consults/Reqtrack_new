import bcrypt from "bcrypt";

// generate unique password for employee
const salt = await bcrypt.genSalt();
const hashedPwd = await bcrypt.hash("12345", salt);

console.log(hashedPwd);
