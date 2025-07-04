const Post = require("../models/post");
const Review = require("../models/review");

module.exports.createReview = async(req,res) => {
  let post = await Post.findById(req.params.id);
  let newReview = new Review(req.body.review);
  newReview.author = req.user._id;
  
  post.reviews.push(newReview);

  await newReview.save();
  await post.save();
  req.flash("success","New Review Created");
  res.redirect(`/posts/${post._id}`);
};

module.exports.destroyReview = async(req,res) => {
    let {id,reviewId} = req.params;

    await Post.findByIdAndUpdate(id,{$pull:{reviews:reviewId}});
    await Review.findByIdAndDelete(reviewId);
    req.flash("success","Review Deleted");
    res.redirect(`/posts/${id}`)
};