const mongoose = require("mongoose");
const Post = require("./models/post");
const Review = require("./models/review");
const ExpressError = require("./utils/ExpressError.js");
const { postSchema, reviewSchema } = require("./schema.js");

// Ensure user is authenticated
module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.redirectUrl = req.originalUrl;
    req.flash("error", "You must be logged in to perform this action!");
    return res.redirect("/login");
  }
  next();
};

// Expose any saved redirect URL to templates
module.exports.saveRedirectUrl = (req, res, next) => {
  if (req.session && req.session.redirectUrl) {
    res.locals.redirectUrl = req.session.redirectUrl;
  }
  next();
};

// Ensure the current user owns the post
module.exports.isOwner = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      req.flash("error", "Invalid post id");
      return res.redirect("/posts");
    }

    const post = await Post.findById(id);
    if (!post) {
      req.flash("error", "Post not found");
      return res.redirect("/posts");
    }

    const currentUserId = req.user && req.user._id;
    if (!currentUserId) {
      req.flash("error", "You must be logged in");
      return res.redirect("/login");
    }

    // owner is an ObjectId reference on the Post
    if (!post.owner || !post.owner.equals(currentUserId)) {
      req.flash("error", "You are not the owner of this post!");
      return res.redirect(`/posts/${id}`);
    }

    next();
  } catch (err) {
    next(err);
  }
};

// Validate post payload against Joi schema
module.exports.validatePost = (req, res, next) => {
  const { error } = postSchema.validate(req.body);
  if (error) {
    const errMsg = error.details.map((el) => el.message).join(", ");
    throw new ExpressError(400, errMsg);
  }
  next();
};

// Validate review payload against Joi schema
module.exports.validateReview = (req, res, next) => {
  const { error } = reviewSchema.validate(req.body);
  if (error) {
    const errMsg = error.details.map((el) => el.message).join(", ");
    throw new ExpressError(400, errMsg);
  }
  next();
};

// Ensure the current user authored the review
module.exports.isReviewAuthor = async (req, res, next) => {
  try {
    const { id, reviewId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      req.flash("error", "Invalid review id");
      return res.redirect(`/posts/${id}`);
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      req.flash("error", "Review not found");
      return res.redirect(`/posts/${id}`);
    }

    const currentUserId = req.user && req.user._id;
    if (!currentUserId) {
      req.flash("error", "You must be logged in");
      return res.redirect("/login");
    }

    if (!review.author.equals(currentUserId)) {
      req.flash("error", "You are not the author of this review!");
      return res.redirect(`/posts/${id}`);
    }

    next();
  } catch (err) {
    next(err);
  }
};
