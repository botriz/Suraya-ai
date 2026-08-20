import fs from "fs";

// ساخت پوشه‌ها
fs.mkdirSync("ai", { recursive: true });
fs.mkdirSync("config", { recursive: true });
fs.mkdirSync("public", { recursive: true });

// package.json
fs.writeFileSync("package.json", `
{
  "name": "suraya-ai-content-engine",
  "version": "1.0.0",
  "main": "server.js",
  "type": "module",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "body-parser": "^1.20.2",
    "axios": "^1.6.0",
    "fluent-ffmpeg": "^2.1.2"
  }
}
`);

// apiKeys.js
fs.writeFileSync("config/apiKeys.js", `
export const OPENAI_KEY = "اینجا کلید مدل هوش مصنوعی";
`);

// textGenerator.js
fs.writeFileSync("ai/textGenerator.js", `
import axios from "axios";
import { OPENAI_KEY } from "../config/apiKeys.js";

export async function generateScript(topic) {
  const prompt = \`
  موضوع: \${topic}
  یک سناریوی کامل برای یک ویدیو کوتاه بساز.
  کپشن، عنوان، هشتگ و CTA هم تولید کن.
  خروجی را در قالب JSON بده:
  {
    "title": "",
    "caption": "",
    "hashtags": "",
    "script": "",
    "cta": ""
  }
  \`;

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: \`Bearer \${OPENAI_KEY}\`
      }
    }
  );

  return JSON.parse(response.data.choices[0].message.content);
}
`);

// imageGenerator.js
fs.writeFileSync("ai/imageGenerator.js", `
import axios from "axios";
import { OPENAI_KEY } from "../config/apiKeys.js";

export async function generateImage(prompt) {
  const response = await axios.post(
    "https://api.openai.com/v1/images/generations",
    {
      model: "gpt-image-1",
      prompt: prompt,
      size: "1024x1024"
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: \`Bearer \${OPENAI_KEY}\`
      }
    }
  );

  return response.data.data[0].url;
}
`);

// videoGenerator.js
fs.writeFileSync("ai/videoGenerator.js", `
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
        Authorization: \`Bearer \${OPENAI_KEY}\`
      }
    }
  );

  return response.data.data[0].url;
}
`);

// videoComposer.js
fs.writeFileSync("ai/videoComposer.js", `
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";

export async function composeVideo(imagePath, text, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(imagePath)
      .inputOptions(["-loop 1"])
      .outputOptions([
        "-c:v libx264",
        "-t 10",
        "-pix_fmt yuv420p",
        "-vf drawtext=text='\${text}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2"
      ])
      .save(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(err));
  });
}
`);

// index.html
fs.writeFileSync("public/index.html", `
<!DOCTYPE html>
<html lang="fa">
<head>
  <meta charset="UTF-8" />
  <title>Suraya AI – تولید خودکار محتوا</title>
</head>
<body>
  <h1>Suraya AI</h1>
  <p>سیستم تولید متن، تصویر و ویدیو آماده است.</p>
</body>
</html>
`);

// server.js
fs.writeFileSync("server.js", `
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import axios from "axios";

import { generateScript } from "./ai/textGenerator.js";
import { generateImage } from "./ai/imageGenerator.js";
import { generateVideo } from "./ai/videoGenerator.js";
import { composeVideo } from "./ai/videoComposer.js";

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

app.post("/generate-text", async (req, res) => {
  try {
    const { topic } = req.body;
    const result = await generateScript(topic);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

app.post("/compose-video", async (req, res) => {
  try {
    const { imageUrl, text } = req.body;

    const imagePath = "temp_image.jpg";
    const outputPath = "final_video.mp4";

    const img = await axios.get(imageUrl, { responseType: "arraybuffer" });
    fs.writeFileSync(imagePath, img.data);

    const result = await composeVideo(imagePath, text, outputPath);

    res.json({ video: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log("Suraya AI Content Engine running on port 3000");
});
`);

console.log("تمام فایل‌ها ساخته شد. حالا فقط npm install و سپس node server.js را اجرا کن.");
