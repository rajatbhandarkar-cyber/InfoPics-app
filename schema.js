const Joi = require("joi");

module.exports.postSchema = Joi.object({
   post:Joi.object({
     location:Joi.string().required(),
     country:Joi.string().required(),
     description:Joi.string().required(),
     image:Joi.string().allow("",null),
   }).required()
});

module.exports.reviewSchema = Joi.object({
    review:Joi.object({
      rating:Joi.number().required().min(1).max(5),
      comment:Joi.string().required(),
    }).required()
});