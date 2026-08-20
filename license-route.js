import { checkLicense } from "suraya-global-license-layer/license-layer.js";

export function licenseRoute(app) {
  app.get("/suraya/license", (req, res) => {
    const domain = req.hostname;
    const result = checkLicense(domain);
    res.json(result);
  });
}
