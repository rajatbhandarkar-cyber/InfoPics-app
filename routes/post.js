const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const Post = require("../models/post.js");
const { isLoggedIn, isOwner, validatePost } = require("../middleware.js");

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
  const post = await Post.findById(id);
  if (!post) return res.status(404).json({ success: false });

  const userId = req.user._id;
  const alreadyLiked = post.likedBy.includes(userId);

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

// Get all comments for a post
router.get("/:id/comments", wrapAsync(async (req, res) => {
  const post = await Post.findById(req.params.id).populate("comments.author");
  res.json({ comments: post.comments });
}));

router.post("/:id/comments", isLoggedIn, wrapAsync(async (req, res) => {
  const post = await Post.findById(req.params.id);
  const { text } = req.body;

  post.comments.push({ text, author: req.user._id });
  await post.save();

  // ✅ Re-fetch and populate after saving
  const updatedPost = await Post.findById(req.params.id).populate("comments.author");
  res.json({ comments: updatedPost.comments });
}));


module.exports = router;
