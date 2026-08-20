import { analyzeBehavior } from "suraya-global-behavior-engine/behavior-engine.js";

export function behaviorRoute(app) {
  app.get("/suraya/behavior/:id", (req, res) => {
    const result = analyzeBehavior(req.params.id);
    res.json(result);
  });
}
