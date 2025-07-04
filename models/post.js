const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review.js");

const postSchema = new Schema({
    image: {
       url: String,
       filename: String,
    },
    location: {
      type: String,
      required: [true, "Location is required"],
      validate: {
        validator: function (v) {
            return /^[A-Za-z\s]+$/.test(v);
        },
        message: props => `${props.value} is not a valid location. Only letters are allowed.`,
      }
    },
    country: {
      type: String,
      required: [true, "Country is required"],
      validate: {
        validator: function (v) {
            return /^[A-Za-z\s]+$/.test(v);
        },
        message: props => `${props.value} is not a valid country. Only letters are allowed.`,
      }
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      validate: {
        validator: function (v) {
            return /[A-Za-z]/.test(v) && v.trim().length >= 3;
        },
        message: props => `Description must contain at least one alphabet and be meaningful.`,
      }
    },
    reviews:[
      {
        type:Schema.Types.ObjectId,
        ref:"Review",
      },
    ],
    owner:{
      type:Schema.Types.ObjectId,
      ref:"User",
    },
});


postSchema.post("findOneAndDelete",async(post) => {
  if(post){
   await Review.deleteMany({_id:{$in: post.reviews}});
  }
});

const Post = mongoose.model("Post", postSchema);
module.exports = Post;
