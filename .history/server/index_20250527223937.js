require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log('MongoDB Connection Error:', err));
}

// User schema
const User = mongoose.model('User', {
  fullName: String,
  email: { type: String, unique: true },
  password: String
});

// Recipe schema
const Recipe = mongoose.model('Recipe', {
  title: String,
  description: String,
  ingredients: String,
  instructions: String,
  category: String,
  meatType: String,
  prepTime: Number,
  servings: Number,
  image: String,
  userId: String,
  userName: String,
  userAvatar: String,
  likes: [String],
  comments: [{
    userId: String,
    userName: String,
    text: String,
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = new User({ fullName, email, password });
    await user.save();

    res.status(201).json({
      message: 'User registered successfully',
      data: {
        token: 'dummy-token-' + user._id,
        user: { id: user._id, fullName, email }
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email, password });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    res.json({
      message: 'Login successful',
      data: {
        token: 'dummy-token-' + user._id,
        user: { id: user._id, fullName: user.fullName, email: user.email }
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/auth/forgotpassword', async (req, res) => {
  res.json({ message: 'Password reset instructions sent' });
});

// Recipe routes
app.get('/api/recipes', async (req, res) => {
  try {
    const recipes = await Recipe.find().sort({ createdAt: -1 });
    res.json(recipes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/recipes', async (req, res) => {
  try {
    console.log('Received recipe data:', req.body);

    const recipeData = {
      title: req.body.title || 'Untitled Recipe',
      description: req.body.description || '',
      ingredients: req.body.ingredients || '',
      instructions: req.body.instructions || '',
      category: req.body.category || 'General',
      meatType: req.body.meatType || 'Mixed',
      prepTime: parseInt(req.body.prepTime) || 0,
      servings: parseInt(req.body.servings) || 1,
      image: req.body.image || null,
      userId: req.body.userId || 'anonymous',
      userName: req.body.userName || 'Anonymous Chef',
      userAvatar: req.body.userAvatar || null,
      likes: [],
      comments: [],
      createdAt: new Date()
    };

    const recipe = new Recipe(recipeData);
    await recipe.save();

    console.log('Recipe saved successfully:', recipe);
    res.status(201).json(recipe);
  } catch (error) {
    console.error('Error creating recipe:', error);
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/recipes/:id', async (req, res) => {
  try {
    await Recipe.findByIdAndDelete(req.params.id);
    res.json({ message: 'Recipe deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Likes
app.post('/api/recipes/:id/like', async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe.likes) recipe.likes = [];

    const userId = 'current-user-id'; // זמני
    if (!recipe.likes.includes(userId)) {
      recipe.likes.push(userId);
      await recipe.save();
    }

    res.json({ likesCount: recipe.likes.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/recipes/:id/like', async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    const userId = 'current-user-id'; // זמני

    recipe.likes = recipe.likes.filter(id => id !== userId);
    await recipe.save();

    res.json({ likesCount: recipe.likes.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Test route
app.get('/', (req, res) => {
  res.send('Recipe Social Network API Server is running');
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
