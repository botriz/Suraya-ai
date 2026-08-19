import axios from "axios";
import { OPENAI_KEY } from "../config/apiKeys.js";

export async function generateVideo(script) {
  const response = await axios.post(
    "https://api.openai.com/v1/videos/generations",
    {
      model: "gpt-video-1",
      prompt: script,
      duration: 10
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`
      }
    }
  );

  return response.data.data[0].url;
}
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
