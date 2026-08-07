const express = require('express');
const Queue = require('bull');

const router = express.Router();

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const uploadQueue = new Queue('uploadQueue', redisUrl);

// Simple upload enqueue endpoint
// Body: { title, description, tags, privacy, video_url }
router.post('/upload', async (req, res) => {
  const { title, description, tags, privacy, video_url, scheduled_at } = req.body;
  if (!title || !video_url) return res.status(400).send('title and video_url required');

  // basic topic check can be integrated here
  await uploadQueue.add({ title, description, tags, privacy, video_url, scheduled_at });
  res.status(202).send({ status: 'queued' });
});

module.exports = router;
