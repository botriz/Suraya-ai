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
