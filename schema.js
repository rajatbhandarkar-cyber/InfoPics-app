const Joi = require("joi");

module.exports.postSchema = Joi.object({
  post: Joi.object({
    location: Joi.string().required(),
    country: Joi.string().required(),
    description: Joi.string().required(),
    image: Joi.string().allow("", null),
    isPrivate: Joi.boolean().default(false),
    categories: Joi.array().items(
      Joi.string().valid(
        "Adventure",
        "Forts",
        "Beaches",
        "Temples",
        "Mountains",
        "Culture",
        "Food",
        "Hidden Gems"
      )
    ).default([])
  }).required()
});
