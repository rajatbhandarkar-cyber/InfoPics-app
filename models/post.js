const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review.js");

// Comment sub-schema with User reference
const commentSchema = new Schema({
  text: {
    type: String,
    required: [true, "Comment text is required"],
    trim: true,
    minlength: 1
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Post schema
const postSchema = new Schema({
  ownerUsername: { type: String, index: true }, 
  isPrivate: { type: Boolean, index: true }, 
  createdAt: { type: Date, default: Date.now, index: true },
  image: {
    url: String,
    filename: String
  },
  location: {
    type: String,
    required: [true, "Location is required"],
    validate: {
      validator: function (v) {
        return /^[A-Za-z\s]+$/.test(v);
      },
      message: props => `${props.value} is not a valid location. Only letters are allowed.`
    }
  },
  country: {
    type: String,
    required: [true, "Country is required"],
    validate: {
      validator: function (v) {
        return /^[A-Za-z\s]+$/.test(v);
      },
      message: props => `${props.value} is not a valid country. Only letters are allowed.`
    }
  },
  description: {
    type: String,
    required: [true, "Description is required"],
    validate: {
      validator: function (v) {
        return /[A-Za-z]/.test(v) && v.trim().length >= 3;
      },
      message: props => `Description must contain at least one alphabet and be meaningful.`
    }
  },

  // Reviews (referenced)
  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review"
    }
  ],

  // Owner reference (canonical)
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },

  // Denormalized username for fast filtering by username (keeps historical username)
  ownerUsername: {
    type: String,
    trim: true,
    index: true
  },

  // Like system
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

  // Privacy toggle 
  isPrivate: { 
    type: Boolean, 
    default: false // by default posts are public
  },
  comments: [commentSchema]
}, { timestamps: true });

// Cleanup reviews on post deletion
postSchema.post("findOneAndDelete", async (post) => {
  if (post) {
    await Review.deleteMany({ _id: { $in: post.reviews } });
  }
});

// Convenience static: find posts by username (denormalized)
postSchema.statics.findByOwnerUsername = function(username, opts = {}) {
  const query = { ownerUsername: username };
  return this.find(query).sort({ createdAt: -1 }).setOptions(opts);
};

const Post = mongoose.model("Post", postSchema);
module.exports = Post;
