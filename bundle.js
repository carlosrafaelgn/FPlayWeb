const fs = require("fs");

const files = JSON.parse(fs.readFileSync("scripts/tsconfig.json", "utf8")).files;

const out = ['"use strict";'];

for (let f = 0; f < files.length; f++) {
	const t = fs.readFileSync("temp/" + files[f].replace(".ts", ".js"), "utf8");
	// Remove the "use strict"; from the beginning of each file
	const i = t.indexOf("\n");
	out.push(i < 0 ? t : t.substring(i + 1));
}

fs.writeFileSync("temp/scripts.js", out.join("\n"));
