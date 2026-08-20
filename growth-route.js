import { analyzeGrowth } from "suraya-global-growth-engine/growth-engine.js";

export function growthRoute(app) {
  app.get("/suraya/growth/:id", (req, res) => {
    const result = analyzeGrowth(req.params.id);
    res.json(result);
  });
}
