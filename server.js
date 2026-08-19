import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { generateScript } from "./ai/textGenerator.js";

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post("/generate-text", async (req, res) => {
  try {
    const { topic } = req.body;
    const result = await generateScript(topic);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log("Suraya AI Text Engine running on port 3000");
});
