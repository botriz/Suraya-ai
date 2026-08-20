import fs from "fs";
import { suraya } from "suraya-global-intelligence-core/suraya-master.js";

export function surayaBoot(rawKeyPath) {
  let keyBuf = null;
  if (rawKeyPath && fs.existsSync(rawKeyPath)) {
    keyBuf = fs.readFileSync(rawKeyPath);
  }

  const core = suraya(keyBuf);

  return core;
}
