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
      'Dessert' // 🔧 הוספתי Dessert שחסר!
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
    min: 0 // 🔧 שינוי מ-1 ל-0
  },
  servings: {
    type: Number,
    required: true,
    min: 1
  },
  // 🖼️ תמונה
  image: {
    type: String,
    maxlength: 10000000, // 🔧 הוספתי maxlength לbase64
    default: null
  },
  // 🎥 וידאו - שדה חדש!
  video: {
    type: String,
    maxlength: 50000000, // גדול יותר לוידאו
    default: null
  },
  // 📱 סוג מדיה - שדה חדש!
  mediaType: {
    type: String,
    enum: ['image', 'video', 'none'],
    default: 'none'
  },
  // 🔧 שינוי userId ל-String במקום ObjectId
  userId: {
    type: String, // שינוי מ-ObjectId
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
    type: String // 🔧 שינוי מ-ObjectId ל-String
  }],
  comments: [{
    userId: {
      type: String, // 🔧 שינוי מ-ObjectId ל-String
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