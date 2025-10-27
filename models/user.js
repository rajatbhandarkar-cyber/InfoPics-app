const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true
  },
  googleId: String,
  profilePic: String,
  verified: {
    type: Boolean,
    default: false
  },
  verificationCode: String
});

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);
