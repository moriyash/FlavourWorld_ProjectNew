const express = require('express');
const router = express.Router();
const Recipe = require('../models/Recipe');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');

// Middleware לאימות טוקן
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// הגדרת multer לטיפול בתמונות
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/recipes/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'recipe-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// יצירת מתכון חדש
router.post('/', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const {
      title,
      description,
      ingredients,
      instructions,
      category,
      meatType,
      prepTime,
      servings
    } = req.body;

    // בדיקת תקינות
    if (!title || !description || !ingredients || !instructions || !category || !meatType || !prepTime || !servings) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // יצירת אובייקט המתכון
    const recipeData = {
      title: title.trim(),
      description: description.trim(),
      ingredients: ingredients.trim(),
      instructions: instructions.trim(),
      category,
      meatType,
      prepTime: parseInt(prepTime),
      servings: parseInt(servings),
      userId: req.user._id,
      userName: req.user.fullName,
      userAvatar: req.user.avatar || null
    };

    // הוספת תמונה אם קיימת
    if (req.file) {
      recipeData.image = /uploads/recipes/${req.file.filename};
    }

    const recipe = new Recipe(recipeData);
    await recipe.save();

    res.status(201).json({
      message: 'Recipe created successfully',
      recipe
    });

  } catch (error) {
    console.error('Error creating recipe:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// קבלת כל המתכונים
router.get('/', async (req, res) => {
  try {
    const recipes = await Recipe.find()
      .sort({ createdAt: -1 })
      .populate('userId', 'fullName avatar');

    res.json(recipes);
  } catch (error) {
    console.error('Error fetching recipes:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// קבלת מתכון לפי ID
router.get('/:id', async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id)
      .populate('userId', 'fullName avatar')
      .populate('comments.userId', 'fullName avatar');

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    res.json(recipe);
  } catch (error) {
    console.error('Error fetching recipe:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// עדכון מתכון
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    // בדיקה שהמשתמש הוא הבעלים של המתכון
    if (recipe.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this recipe' });
    }

    const updatedRecipe = await Recipe.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.json(updatedRecipe);
  } catch (error) {
    console.error('Error updating recipe:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// מחיקת מתכון
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    // בדיקה שהמשתמש הוא הבעלים של המתכון
    if (recipe.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this recipe' });
    }

    await Recipe.findByIdAndDelete(req.params.id);

    res.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    console.error('Error deleting recipe:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// הוספת לייק למתכון
router.post('/:id/like', authenticateToken, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    const userId = req.user._id;

    // בדיקה אם המשתמש כבר נתן לייק
    if (recipe.likes.includes(userId)) {
      return res.status(400).json({ message: 'Recipe already liked' });
    }

    recipe.likes.push(userId);
    await recipe.save();

    res.json({ message: 'Recipe liked successfully', likesCount: recipe.likes.length });
  } catch (error) {
    console.error('Error liking recipe:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// הסרת לייק מהמתכון
router.delete('/:id/like', authenticateToken, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    const userId = req.user._id;

    // בדיקה אם המשתמש נתן לייק
    if (!recipe.likes.includes(userId)) {
      return res.status(400).json({ message: 'Recipe not liked yet' });
    }

    recipe.likes = recipe.likes.filter(id => id.toString() !== userId.toString());
    await recipe.save();

    res.json({ message: 'Like removed successfully', likesCount: recipe.likes.length });
  } catch (error) {
    console.error('Error removing like:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// הוספת תגובה למתכון
router.post('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    const comment = {
      userId: req.user._id,
      userName: req.user.fullName,
      text: text.trim()
    };

    recipe.comments.push(comment);
    await recipe.save();

    res.status(201).json({ 
      message: 'Comment added successfully', 
      comment: recipe.comments[recipe.comments.length - 1]
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// מחיקת תגובה
router.delete('/:id/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    const comment = recipe.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // בדיקה שהמשתמש הוא הבעלים של התגובה
    if (comment.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    recipe.comments.pull({ _id: req.params.commentId });
    await recipe.save();

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;