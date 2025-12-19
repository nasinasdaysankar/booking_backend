import bcrypt from "bcryptjs";

const plain = "ANA@01";
const hash = "$2a$10$u4LIozYco1lUoo/goAgUKe2firHNE3QQpIr.f3wMMSeSkjuyBWFQu";

const result = await bcrypt.compare(plain, hash);
console.log("MATCH:", result);


