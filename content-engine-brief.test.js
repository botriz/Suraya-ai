import test from "node:test";
import assert from "node:assert/strict";
import { createContentEngine } from "./ai/content-engine.js";

test("content engine includes campaign audience, objective and brand voice as untrusted brief data", async () => {
  let request;
  const engine = createContentEngine({
    apiKey: "test-key",
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          title: "عنوان",
          caption: "کپشن",
          hashtags: "#ثریا",
          script: "سناریو",
          cta: "اقدام"
        }) } }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  });

  const draft = await engine.generate({
    topic: "معرفی محصول جدید",
    audience: "صاحبان کسب‌وکار کوچک",
    objective: "leads",
    brandVoice: "شفاف و بدون اغراق",
    platform: "instagram",
    tone: "professional",
    language: "fa"
  });

  assert.equal(draft.title, "عنوان");
  const prompt = request.messages.map(message => message.content).join("\n");
  assert.match(prompt, /صاحبان کسب‌وکار کوچک/);
  assert.match(prompt, /شفاف و بدون اغراق/);
  assert.match(prompt, /leads/);
  assert.match(prompt, /untrusted data/i);
});
