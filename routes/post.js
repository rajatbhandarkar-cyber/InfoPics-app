const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const Post = require("../models/post.js");
const {isLoggedIn,isOwner,validatePost} = require("../middleware.js");

const postController = require("../controllers/posts.js");
const multer = require("multer");
const {storage} = require("../cloudConfig.js");
const upload = multer({storage});
// const upload = multer({ dest: 'uploads/'});

router
 .route("/")
 .get(wrapAsync(postController.index))
 .post(
    isLoggedIn,
    upload.single("post[image]"),
    validatePost,
    wrapAsync(postController.createPost)
);


//New Route
router.get("/new",isLoggedIn,postController.renderNewForm);

//search Route
router.get("/search", wrapAsync(postController.searchPosts));

router.get("/about", (req, res) => {
    res.render("posts/about");
});

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
 .delete(isLoggedIn, isOwner,wrapAsync(postController.destroyPost));    


//Edit Route
router.get("/:id/edit",isLoggedIn, isOwner,wrapAsync(postController.renderEditForm));

// Like a post (only once per user)
router.post('/:id/like', isLoggedIn, wrapAsync(async (req, res) => {
  const post = await Post.findById(req.params.id);
  const userId = req.user._id;

  // Check if user already liked the post
  if (post.likedBy.includes(userId)) {
    return res.status(400).json({ message: 'You have already liked this post.', likes: post.likes });
  }

  // Add like
  post.likes += 1;
  post.likedBy.push(userId);
  await post.save();

  res.json({ likes: post.likes });
}));

// Get all comments for a post
router.get('/:id/comments', wrapAsync(async (req, res) => {
  const post = await Post.findById(req.params.id);
  res.json({ comments: post.comments });
}));

// Add a new comment to a post
router.post('/:id/comments', wrapAsync(async (req, res) => {
  const post = await Post.findById(req.params.id);
  const { text, author } = req.body;
  console.log("Incoming comment body:", req.body);
  post.comments.push({ text, author: author || 'Anonymous' });
  await post.save();
  res.json({ comments: post.comments });
}));



module.exports = router;  