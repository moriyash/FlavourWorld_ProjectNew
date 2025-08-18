const mongoose = require('mongoose');

const recipeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  ingredients: {
    type: String,
    required: true
  },
  instructions: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'Asian', 'Italian', 'Mexican', 'Indian', 'Mediterranean', 
      'American', 'French', 'Chinese', 'Japanese', 'Thai', 
      'Middle Eastern', 'Greek', 'Spanish', 'Korean', 'Vietnamese', 
      'Dessert' 
    ]
  },
  meatType: {
    type: String,
    required: true,
    enum: [
      'Vegetarian', 'Vegan', 'Chicken', 'Beef', 'Pork', 
      'Fish', 'Seafood', 'Lamb', 'Turkey', 'Mixed'
    ]
  },
  prepTime: {
    type: Number,
    required: true,
    min: 0 
  },
  servings: {
    type: Number,
    required: true,
    min: 1
  },
  image: {
    type: String,
    maxlength: 10000000, 
    default: null
  },
  video: {
    type: String,
    maxlength: 50000000, 
    default: null
  },
  mediaType: {
    type: String,
    enum: ['image', 'video', 'none'],
    default: 'none'
  },
  userId: {
    type: String, 
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  userAvatar: {
    type: String,
    default: null
  },
  likes: [{
    type: String 
  }],
  comments: [{
    userId: {
      type: String, 
      required: true
    },
    userName: {
      type: String,
      required: true
    },
    userAvatar: {
      type: String,
      default: null
    },
    text: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Recipe', recipeSchema);