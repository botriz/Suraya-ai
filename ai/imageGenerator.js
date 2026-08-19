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
        Authorization: `Bearer ${OPENAI_KEY}`
      }
    }
  );

  return response.data.data[0].url;
}
