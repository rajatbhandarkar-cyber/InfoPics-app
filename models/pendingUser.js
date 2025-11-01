const mongoose = require("mongoose");

const pendingUserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    username: {
      type: String,
      trim: true,
      minlength: 3,
    },
    // Store a placeholder or hashed password if created from manual signup
    passwordHash: String,
    googleId: {
      type: String,
      index: true,
      sparse: true,
    },
    profilePic: {
      type: String,
      default: "/images/default-avatar.png",
    },
    code: {
      type: String,
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ["google", "manual"],
      required: true,
    },
    meta: {
      // optional free-form object for any extra data you want to preserve
      type: Object,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Auto-expire pending records after 1 hour (3600 seconds)
pendingUserSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

module.exports = mongoose.model("PendingUser", pendingUserSchema);
