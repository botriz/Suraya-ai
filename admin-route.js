import { adminStatus } from "suraya-global-admin-panel/admin-panel.js";

export function adminRoute(app) {
  app.get("/suraya/admin/status", (req, res) => {
    const result = adminStatus();
    res.json(result);
  });
}
