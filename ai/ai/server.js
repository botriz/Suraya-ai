import { generateImage } from "./ai/imageGenerator.js";
import { generateVideo } from "./ai/videoGenerator.js";
app.post("/generate-image", async (req, res) => {
  try {
    const { prompt } = req.body;
    const url = await generateImage(prompt);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/generate-video", async (req, res) => {
  try {
    const { script } = req.body;
    const url = await generateVideo(script);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
