const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const Post = require("../models/post.js");
const { isLoggedIn, isOwner, validatePost } = require("../middleware.js");
const mongoose = require("mongoose");

const postController = require("../controllers/posts.js");
const multer = require("multer");
const { storage } = require("../cloudConfig.js");
const upload = multer({ storage });

// Home + Create
router
  .route("/")
  .get(wrapAsync(postController.index))
  .post(
    isLoggedIn,
    upload.single("post[image]"),
    validatePost,
    wrapAsync(postController.createPost)
  );

// New Post Form
router.get("/new", isLoggedIn, postController.renderNewForm);

// Search + About
router.get("/search", wrapAsync(postController.searchPosts));
router.get("/about", (req, res) => {
  res.render("posts/about");
});

// Show, Update, Delete
router
  .route("/:id")
  .get(wrapAsync(postController.showPost))
  .put(
    isLoggedIn,
    isOwner,
    upload.single("post[image]"),
    validatePost,
    wrapAsync(postController.updatePost)
  )
  .delete(isLoggedIn, isOwner, wrapAsync(postController.destroyPost));

// Edit Form
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(postController.renderEditForm));

// Like/Dislike 

router.post("/:id/like", isLoggedIn, async (req, res) => {
  const { id } = req.params;

  // ✅ Only load fields needed for liking
  const post = await Post.findById(id).select("likes likedBy");
  if (!post) return res.status(404).json({ success: false });

  const userId = req.user?._id;
  if (!userId || typeof userId !== "object" || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ success: false, error: "Invalid user ID" });
  }

  const alreadyLiked = post.likedBy.some(uid => uid.equals(userId));

  if (alreadyLiked) {
    post.likedBy.pull(userId);
    post.likes = Math.max(post.likes - 1, 0);
  } else {
    post.likedBy.push(userId);
    post.likes = (post.likes || 0) + 1;
  }

  await post.save();
  res.json({ success: true });
});

router.delete("/:id/comments/:commentId", isLoggedIn, wrapAsync(async (req, res) => {
  const { id, commentId } = req.params;
  const post = await Post.findById(id);
  if (!post) {
    req.flash("error", "Post not found");
    return res.redirect("/posts");
  }

  post.comments = post.comments.filter(c => c._id.toString() !== commentId);
  await post.save();

  if (req.xhr || req.headers.accept?.includes("application/json")) {
  return res.json({ success: true });
  }

  res.redirect(`/posts/${id}#all-comments`);
}));



// Get all comments for a post
router.get("/:id/comments", wrapAsync(async (req, res) => {
  const post = await Post.findById(req.params.id).populate("comments.author");
  if (!post) return res.status(404).json({ error: "Post not found" });
  const currUserId = req.user?._id?.toString() || null;
  res.json({ comments: post.comments, currUserId });
}));

router.post("/:id/comments", isLoggedIn, async (req, res, next) => {
  const { text } = req.body;
  const { id } = req.params;

  const isJson = req.headers["content-type"]?.includes("application/json");

  if (!text || text.trim().length === 0) {
    if (isJson) return res.status(400).json({ error: "Comment cannot be empty" });
    req.flash("error", "Comment cannot be empty");
    return res.redirect(`/posts/${id}`);
  }

  const post = await Post.findById(id);
  if (!post) {
    if (isJson) return res.status(404).json({ error: "Post not found" });
    req.flash("error", "Post not found");
    return res.redirect("/posts");
  }

  post.comments = post.comments.filter(c => {
    return c.author && typeof c.author === "object" && c.author._bsontype === "ObjectId";
  });

  post.comments.push({ text, author: req.user._id });
  await post.save();
  await post.populate("comments.author");

  if (isJson) return res.json({ success: true, comments: post.comments });

  res.redirect(`/posts/${post._id}#all-comments`);
});



module.exports = router;