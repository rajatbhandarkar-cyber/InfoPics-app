const Post = require("./models/post");
const Review = require("./models/review");
const ExpressError = require("./utils/ExpressError.js");
const {postSchema,reviewSchema} = require("./schema.js");

module.exports.isLoggedIn = (req,res,next) => {
    if(!req.isAuthenticated()){
        req.session.redirectUrl = req.originalUrl;
        req.flash("error","you must be logged in to create post!");
        return res.redirect("/login");
    }
    next();
};

module.exports.saveRedirectUrl = (req,res,next) => {
    if(req.session.redirectUrl){
        res.locals.redirectUrl = req.session.redirectUrl;
    }
    next();
};
 
module.exports.isOwner = async (req,res,next) => {
    let {id} = req.params;
    let post = await Post.findById(id);
    if(!post.owner.equals(res.locals.currUser._id)){
       req.flash("error","You are not the owner of this post!");
       return res.redirect(`/posts/${id}`);
    }
    next();
};

module.exports.validatePost = (req,res,next) => {
    let {error} = postSchema.validate(req.body);
    if(error) {
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400,errMsg);
    }else{
        next();
    }  
};

module.exports.validateReview = (req,res,next) => {
    let {error} = reviewSchema.validate(req.body);
    if(error) {
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400,errMsg);
    }else{
        next();
    }  
};

module.exports.isReviewAuthor = async (req,res,next) => {
    let {id, reviewId} = req.params;
    let review = await Review.findById(reviewId);
    if(!review.author.equals(res.locals.currUser._id)){
       req.flash("error","You are not the author of this review!");
       return res.redirect(`/posts/${id}`);
    }
    next();
};