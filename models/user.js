const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    verificationCode: String,
    profilePic: {
      type: String,
      default: "/images/default-avatar.png",
    },
    googleId: {
      type: String,
      index: true,
      sparse: true,
    },
  },
  { timestamps: true }
);

// Use username as the authentication field so users log in with username + password
userSchema.plugin(passportLocalMongoose, { usernameField: "username" });

// Optional: clean JSON output (remove __v)
userSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("User", userSchema);
