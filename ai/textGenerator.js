import axios from "axios";
import { OPENAI_KEY } from "../config/apiKeys.js";

export async function generateScript(topic) {
  const prompt = `
  موضوع: ${topic}
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
  `;

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`
      }
    }
  );

  return JSON.parse(response.data.choices[0].message.content);
}
