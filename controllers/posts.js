const { model } = require("mongoose");
const Post = require("../models/post");

module.exports.index = async (req, res) => {
  // ✅ Show only public posts on homepage
  const allPosts = await Post.find({ isPrivate: { $ne: true } })
    .sort({ _id: -1 })
    .populate("owner")
    .lean();
  res.render("posts/index.ejs", { allPosts, currUser: req.user });
};

module.exports.renderNewForm = (req, res) => {
  res.render("posts/new.ejs");
};

module.exports.showPost = async (req, res) => {
  let { id } = req.params;
  const post = await Post.findById(id)
    .populate({
      path: "reviews",
      populate: {
        path: "author",
      },
    })
    .populate("owner")
    .populate("comments.author");
  if (!post) {
    req.flash("error", "Post you requested for does not exist!");
    return res.redirect("/posts");
  }
  res.render("posts/show.ejs", { post, currUser: req.user });
};

module.exports.createPost = async (req, res, next) => {
  const url = req.file.path;
  const filename = req.file.filename;
  const newPost = new Post(req.body.post);

  // canonical owner reference
  newPost.owner = req.user._id;

  // denormalized username to enable username filtering
  if (req.user.username) {
    newPost.ownerUsername = req.user.username;
  }

  newPost.image = { url, filename };

  // ✅ Ensure isPrivate is saved as Boolean
  newPost.isPrivate = req.body.post.isPrivate === "true";

  await newPost.save();
  req.flash("success", "New Post Created!");
  res.redirect("/posts");
};

module.exports.searchPosts = async (req, res) => {
  const { q } = req.query;
  // ✅ Search only public posts
  const posts = await Post.find({ location: new RegExp(q, "i"), isPrivate: false }).lean();
  res.render("posts/index.ejs", { allPosts: posts, currUser: req.user });
};

module.exports.renderEditForm = async (req, res) => {
  let { id } = req.params;
  const post = await Post.findById(id);
  if (!post) {
    req.flash("error", "Post you requested for does not exist!");
    return res.redirect("/posts");
  }

  let originalImageUrl = post.image.url;
  originalImageUrl = originalImageUrl.replace("/upload", "/upload/w_250");
  res.render("posts/edit.ejs", { post, originalImageUrl, currUser: req.user });
};

module.exports.updatePost = async (req, res) => {
  let { id } = req.params;
  const updates = { ...req.body.post };

  // ✅ Ensure isPrivate is updated correctly
  updates.isPrivate = req.body.post.isPrivate === "true";

  const post = await Post.findByIdAndUpdate(id, updates, { new: true });

  if (typeof req.file !== "undefined") {
    const url = req.file.path;
    const filename = req.file.filename;
    post.image = { url, filename };
    await post.save();
  }

  res.redirect(`/posts/${id}`);
};

module.exports.destroyPost = async (req, res) => {
  let { id } = req.params;
  let deletedPost = await Post.findByIdAndDelete(id);
  console.log(deletedPost);
  req.flash("success", "Post Deleted!");
  res.redirect("/posts");
};

module.exports.getComments = async (req, res) => {
  const { id } = req.params;
  const post = await Post.findById(id).populate("comments.author");
  if (!post) return res.status(404).json({ error: "Post not found" });

  res.json({ comments: post.comments });
};

module.exports.createComment = async (req, res) => {
  const { id } = req.params;
  const post = await Post.findById(id);
  if (!post) return res.status(404).json({ error: "Post not found" });

  post.comments.push({
    text: req.body.text,
    author: req.user._id,
  });

  await post.save();
  await post.populate("comments.author");

  const latestComment = post.comments[post.comments.length - 1];
  res.json(latestComment);
};

module.exports.deleteComment = async (req, res) => {
  const { id, commentId } = req.params;
  const post = await Post.findById(id);
  if (!post) {
    if (req.xhr || req.headers.accept?.includes("application/json")) {
      return res.status(404).json({ error: "Post not found" });
    }
    req.flash("error", "Post not found");
    return res.redirect("/posts");
  }

  post.comments = post.comments.filter((c) => c._id.toString() !== commentId);
  await post.save();

  if (req.xhr || req.headers.accept?.includes("application/json")) {
    return res.json({ success: true });
  }

  res.redirect(`/posts/${id}#all-comments`);
};

module.exports.likePost = async (req, res) => {
  const { id } = req.params;
  const post = await Post.findById(id);
  const userId = req.user._id;

  // Prevent duplicate likes
  if (post.likedBy.includes(userId)) {
    req.flash("error", "You've already liked this post.");
    return res.redirect(`/posts/${id}`);
  }

  post.likes += 1;
  post.likedBy.push(userId);
  await post.save();

  req.flash("success", "You liked this post!");
  res.redirect(`/posts/${id}`);
};

/**
 * New: show only posts created by the logged-in user
 * Split into public and private
 */
module.exports.showMyPosts = async (req, res, next) => {
  try {
    const username = req.user && req.user.username;
    if (!username) {
      req.flash && req.flash("error", "Unable to identify current user");
      return res.redirect("/posts");
    }

    const publicPosts = await Post.find({ ownerUsername: username, isPrivate: false })
      .sort({ createdAt: -1 })
      .populate("owner")
      .lean();

    const privatePosts = await Post.find({ ownerUsername: username, isPrivate: true })
      .sort({ createdAt: -1 })
      .populate("owner")
      .lean();

    res.render("posts/my-posts", { publicPosts, privatePosts, currUser: req.user });
  } catch (err) {
    next(err);
  }
};
