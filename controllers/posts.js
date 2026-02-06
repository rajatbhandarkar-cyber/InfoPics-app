const { model } = require("mongoose");
const Post = require("../models/post");

module.exports.index = async (req, res) => {
  console.time("indexQuery");
  const allPosts = await Post.find({ isPrivate: { $ne: true } })
    .sort({ _id: -1 })
    .populate("owner")
    .lean();
  console.timeEnd("indexQuery");

  console.time("renderIndex");
  res.render("posts/index.ejs", { allPosts, currUser: req.user });
  console.timeEnd("renderIndex");
};

module.exports.renderNewForm = (req, res) => {
  res.render("posts/new.ejs");
};

module.exports.showPost = async (req, res) => {
  console.time("showPostQuery");
  let { id } = req.params;
  const post = await Post.findById(id)
    .populate({
      path: "reviews",
      populate: { path: "author" },
    })
    .populate("owner")
    .populate("comments.author");
  console.timeEnd("showPostQuery");

  if (!post) {
    req.flash("error", "Post you requested for does not exist!");
    return res.redirect("/posts");
  }

  res.render("posts/show.ejs", { post, currUser: req.user });
};

module.exports.createPost = async (req, res, next) => {
  try {
    console.time("createPost");

    const newPost = new Post(req.body.post);
    newPost.owner = req.user._id;
    if (req.user.username) newPost.ownerUsername = req.user.username;
    newPost.isPrivate = req.body.post.isPrivate === "true";

    await newPost.save();
    console.timeEnd("createPost");

    // ✅ Redirect immediately after save
    console.time("redirect");
    req.flash("success", "New Post Created!");
    res.redirect("/posts");
    console.timeEnd("redirect");

    // 🔧 Handle image upload/update asynchronously
    if (req.file) {
      const url = req.file.path;
      const filename = req.file.filename;
      console.time("imageUpdate");
      Post.findByIdAndUpdate(newPost._id, { image: { url, filename } }).exec();
      console.timeEnd("imageUpdate");
    }
  } catch (err) {
    next(err);
  }
};

module.exports.searchPosts = async (req, res) => {
  console.time("searchPostsQuery");
  const { q } = req.query;
  const posts = await Post.find({ location: new RegExp(q, "i"), isPrivate: false }).lean();
  console.timeEnd("searchPostsQuery");

  res.render("posts/index.ejs", { allPosts: posts, currUser: req.user });
};

module.exports.renderEditForm = async (req, res) => {
  let { id } = req.params;
  const post = await Post.findById(id);
  if (!post) {
    req.flash("error", "Post you requested for does not exist!");
    return res.redirect("/posts");
  }

  let originalImageUrl = post.image.url.replace("/upload", "/upload/w_250");
  res.render("posts/edit.ejs", { post, originalImageUrl, currUser: req.user });
};

module.exports.updatePost = async (req, res) => {
  console.time("updatePost");
  let { id } = req.params;
  const updates = { ...req.body.post };
  updates.isPrivate = req.body.post.isPrivate === "true";

  const post = await Post.findByIdAndUpdate(id, updates, { new: true });

  if (req.file) {
    const url = req.file.path;
    const filename = req.file.filename;
    post.image = { url, filename };
    await post.save();
  }
  console.timeEnd("updatePost");

  res.redirect(`/posts/${id}`);
};

module.exports.destroyPost = async (req, res) => {
  console.time("destroyPost");
  let { id } = req.params;
  let deletedPost = await Post.findByIdAndDelete(id);
  console.timeEnd("destroyPost");

  console.log(deletedPost);
  req.flash("success", "Post Deleted!");
  res.redirect("/posts");
};
