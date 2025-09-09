const cloudinary = require('cloudinary').v2;
const {CloudinaryStorage} = require('multer-storage-cloudinary');

cloudinary.config ({
   cloud_name:process.env.CLOUDINARY_CLOUD_NAME,
   api_key:process.env.CLOUDINARY_API_KEY,
   api_secret:process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'infopics_DEV',
    allowed_formats: ["png","jpg","jpeg"],
  },
});

module.exports = {
    cloudinary,
    storage,
};

// require("dotenv").config();
// const cloudinary = require("cloudinary").v2;

// // Configure cloudinary
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });

// // Test upload
// async function testUpload() {
//   try {
//     const result = await cloudinary.uploader.upload("https://picsum.photos/300", {
//       folder: "infopics_DEV",
//     });
//     console.log("✅ Upload successful!");
//     console.log("Image URL:", result.secure_url);
//   } catch (err) {
//     console.error("❌ Upload failed:", err);
//   }
// }

// testUpload();