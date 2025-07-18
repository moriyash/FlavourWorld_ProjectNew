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
      'Middle Eastern', 'Greek', 'Spanish', 'Korean', 'Vietnamese', 'sweets'
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
    min: 1
  },
  servings: {
    type: Number,
    required: true,
    min: 1
  },
  image: {
    type: String, // URL של התמונה
    default: null
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    userName: {
      type: String,
      required: true
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

module.exports = mongoose.model('Recipe', recipeSchema);