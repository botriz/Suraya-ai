import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

for (const name of ["setup.js", "suraya-master-setup.js", "setup-revenue.js"]) {
  test(`${name} cannot overwrite the active application`, () => {
    const source = fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
    assert.match(source, /disabled/i);
    assert.doesNotMatch(source, /writeFileSync\s*\(/);
    assert.doesNotMatch(source, /createWriteStream\s*\(/);
  });
}
