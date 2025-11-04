const express = require("express");
const router = express.Router();
const User = require("../models/user");
const fetch = global.fetch || require("node-fetch"); // node 18+ has fetch built-in

// Simple in-memory cache (optional, resets on restart). Replace with Redis for production.
const LRU = (() => {
  const map = new Map();
  return {
    get(key) {
      const entry = map.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expires) {
        map.delete(key);
        return null;
      }
      return entry.value;
    },
    set(key, value, ttlMs = 60 * 60 * 1000) {
      map.set(key, { value, expires: Date.now() + ttlMs });
    },
  };
})();

router.get("/:id", async (req, res, next) => {
  try {
    const userId = req.params.id;
    if (!userId) return res.status(400).send("Missing id");

    // Lookup user and profilePic URL
    const user = await User.findById(userId).lean();
    if (!user || !user.profilePic) return res.status(404).send("No avatar");

    const upstreamUrl = String(user.profilePic);

    // Optional: Use cache key per user URL
    const cached = LRU.get(upstreamUrl);
    if (cached) {
      res.set("Content-Type", cached.contentType || "image/jpeg");
      res.set("Cache-Control", cached.cacheControl || "public, max-age=86400");
      return res.send(Buffer.from(cached.buffer, "base64"));
    }

    // Fetch upstream image
    const upstream = await fetch(upstreamUrl, { method: "GET" });

    // If upstream didn't return image bytes, forward a friendly error or fallback
    const contentType = upstream.headers.get("content-type") || "";
    if (!upstream.ok || !contentType.startsWith("image/")) {
      // upstream returned HTML/error (429, 403, redirect etc.)
      // Respond with 204 (no content) so browser doesn't display broken image, or serve default image
      // Here we return 204 to let the client use its onerror fallback
      return res.status(204).end();
    }

    // Stream bytes while also caching the response body (small images are fine)
    const buffer = await upstream.arrayBuffer();
    const buf = Buffer.from(buffer);

    // Cache base64 buffer for a short ttl
    LRU.set(upstreamUrl, {
      buffer: buf.toString("base64"),
      contentType,
      cacheControl: upstream.headers.get("cache-control") || "public, max-age=86400",
    }, 60 * 60 * 1000); // cache 1 hour (adjust as needed)

    res.set("Content-Type", contentType);
    res.set("Cache-Control", upstream.headers.get("cache-control") || "public, max-age=86400");
    res.send(buf);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
