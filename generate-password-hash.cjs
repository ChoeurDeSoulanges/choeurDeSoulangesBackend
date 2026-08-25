// 1) Modify passowrd
// 2) From the console, run node generate-password-hash.cjs
// 3) Copy the hash from the console
const bcrypt = require("bcryptjs");

const password = "Bonriens96"; // Modify password

bcrypt.hash(password, 12).then((hash) => {
	console.log(hash);
});
