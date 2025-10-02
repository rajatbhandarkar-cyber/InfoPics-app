const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review.js");

// Comment sub-schema
const commentSchema = new Schema({
  text: {
    type: String,
    required: [true, "Comment text is required"],
    trim: true,
    minlength: 1
  },
  author: {
    type: String,
    default: "Anonymous"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

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
  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review",
    },
  ],
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },

  // ✅ Like system
  likes: {
    type: Number,
    default: 0
  },
  likedBy: [
    {
      type: Schema.Types.ObjectId,
      ref: "User"
    }
  ],

  comments: [commentSchema]
});

// Cleanup reviews on post deletion
postSchema.post("findOneAndDelete", async (post) => {
  if (post) {
    await Review.deleteMany({ _id: { $in: post.reviews } });
  }
});

const Post = mongoose.model("Post", postSchema);
module.exports = Post;
