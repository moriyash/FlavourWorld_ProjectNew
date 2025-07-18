require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');

const app = express();

// Multer setup for handling FormData
const upload = multer();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // for JSON requests - גדלנו בגלל תמונות
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // for form-encoded requests

// Middleware לדיבוג
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Content-Type: ${req.headers['content-type']}`);
  next();
});


// ============ GROUP POST ROUTES - מתוקן ============

// Create new group post
app.post('/api/groups/:groupId/posts', upload.any(), async (req, res) => {
  try {
    console.log('=== Group Post Creation Debug ===');
    console.log('Group ID:', req.params.groupId);
    console.log('MongoDB connected:', isMongoConnected());
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    // בדיקת תקינות Group ID
    if (!mongoose.Types.ObjectId.isValid(req.params.groupId)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    // בדיקה שהקבוצה קיימת
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const formData = req.body;
    console.log('Group post data received:', formData);

    // ✅ תיקון בדיקת חברות - תמיכה ב-string ו-ObjectId
    const userId = formData.userId;
    const isMember = group.members.some(member => 
      member.userId === userId || 
      member.userId?.toString() === userId?.toString()
    );
    
    console.log('🔍 Membership check:', {
      userId,
      isMember,
      membersCount: group.members.length,
      memberUserIds: group.members.map(m => m.userId)
    });
    
    if (!isMember) {
      console.log('❌ User is not a member');
      return res.status(403).json({ message: 'Only group members can post' });
    }

    // ✅ תיקון בדיקת הרשאות פרסום - תמיכה בשני המבנים
    const allowMemberPosts = group.settings?.allowMemberPosts ?? group.allowMemberPosts ?? true;
    
    console.log('🔍 Post permission check:', {
      allowMemberPosts,
      hasSettings: !!group.settings,
      settingsAllowMemberPosts: group.settings?.allowMemberPosts,
      directAllowMemberPosts: group.allowMemberPosts
    });

    if (!allowMemberPosts) {
      const isAdmin = group.members.some(member => 
        (member.userId === userId || member.userId?.toString() === userId?.toString()) && 
        (member.role === 'admin' || member.role === 'owner')
      );
      
      const isCreator = group.creatorId === userId || group.creatorId?.toString() === userId?.toString();
      
      console.log('🔍 Admin/Creator check:', { isAdmin, isCreator, creatorId: group.creatorId });
      
      if (!isAdmin && !isCreator) {
        console.log('❌ Only admins can post in this group');
        return res.status(403).json({ message: 'Only admins can post in this group' });
      }
    }

    if (!formData.title || formData.title.trim() === '') {
      return res.status(400).json({ message: 'Recipe title is required' });
    }

    // טיפול בתמונה
    let imageData = null;
    if (req.files && req.files.length > 0) {
      const imageFile = req.files.find(file => 
        file.fieldname === 'image' || 
        file.mimetype.startsWith('image/')
      );
      
      if (imageFile) {
        const base64Image = imageFile.buffer.toString('base64');
        imageData = `data:${imageFile.mimetype};base64,${base64Image}`;
        console.log('Group post image converted to base64');
      }
    }

    if (!imageData && formData.image) {
      imageData = formData.image;
    }

    // ✅ תיקון יצירת פוסט הקבוצה - אישור אוטומטי לחברי קבוצה
    const requireApproval = group.settings?.requireApproval ?? group.requireApproval ?? false;
    const isCreator = group.creatorId === userId || group.creatorId?.toString() === userId?.toString();
    const isAdmin = group.members.some(member => 
      (member.userId === userId || member.userId?.toString() === userId?.toString()) && 
      (member.role === 'admin' || member.role === 'owner')
    );

    // ✅ אישור אוטומטי - כל חבר בקבוצה יכול לפרסם אלא אם כן נדרש אישור ספציפי
    const autoApprove = !requireApproval || isCreator || isAdmin;

    const postData = {
      title: formData.title.trim(),
      description: formData.description || '',
      ingredients: formData.ingredients || '',
      instructions: formData.instructions || '',
      category: formData.category || 'General',
      meatType: formData.meatType || 'Mixed',
      prepTime: parseInt(formData.prepTime) || 0,
      servings: parseInt(formData.servings) || 1,
      image: imageData,
      userId: userId,
      groupId: req.params.groupId,
      likes: [],
      comments: [],
      isApproved: autoApprove // ✅ אישור אוטומטי לחברי קבוצה
    };

    console.log('🔍 Creating post with approval status:', {
      requireApproval,
      isCreator,
      isAdmin,
      autoApprove,
      finalApprovalStatus: postData.isApproved,
      userId,
      creatorId: group.creatorId
    });

    const groupPost = new GroupPost(postData);
    const savedPost = await groupPost.save();
    
    console.log('✅ Group post saved successfully:', savedPost._id);

    // החזרת הפוסט עם נתוני המשתמש
    const user = await User.findById(savedPost.userId);
    const enrichedPost = {
      ...savedPost.toObject(),
      userName: user ? user.fullName : 'Unknown User',
      userAvatar: user ? user.avatar : null,
      userBio: user ? user.bio : null,
      groupName: group.name
    };

    // ✅ הוסף הודעה על סטטוס האישור
    const responseMessage = postData.isApproved 
      ? 'Group post created successfully'
      : 'Group post created and waiting for approval';

    res.status(201).json({
      ...enrichedPost,
      message: responseMessage
    });
    
  } catch (error) {
    console.error('=== GROUP POST CREATION ERROR ===');
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to create group post' });
  }
});

// Get all posts for a specific group - מתוקן לכלול פוסטים של כל החברים
app.get('/api/groups/:groupId/posts', async (req, res) => {
  try {
    console.log('GET group posts request:', {
      groupId: req.params.groupId,
      userId: req.query.userId
    });
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.groupId)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    // בדיקה שהקבוצה קיימת
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    console.log('Group found:', { 
      name: group.name, 
      isPrivate: group.isPrivate,
      membersCount: group.members?.length
    });

    const { userId } = req.query;

    // בדיקת חברות בקבוצה
    let isMember = false;
    let isAdmin = false;
    let isCreator = false;

    if (userId) {
      isMember = group.members.some(member => 
        member.userId === userId || member.userId?.toString() === userId?.toString()
      );
      
      isAdmin = group.members.some(member => 
        (member.userId === userId || member.userId?.toString() === userId?.toString()) && 
        (member.role === 'admin' || member.role === 'owner')
      );
      
      isCreator = group.creatorId === userId || group.creatorId?.toString() === userId?.toString();
    }

    console.log('User permissions:', { 
      userId, 
      isMember, 
      isAdmin, 
      isCreator,
      isPrivate: group.isPrivate 
    });

    // בדיקת גישה לקבוצה פרטית
    if (group.isPrivate && !isMember) {
      console.log('Access denied to private group, returning empty array');
      return res.json([]);
    }

    // 🔧 תיקון עיקרי: טען פוסטים לפי סטטוס האישור והרשאות המשתמש
    let postsQuery = { groupId: req.params.groupId };

    if (isAdmin || isCreator) {
      // אדמינים רואים הכל (כולל פוסטים שמחכים לאישור)
      console.log('Admin/Creator - showing all posts');
    } else if (isMember) {
      // חברים רגילים רואים:
      // 1. פוסטים מאושרים של כולם
      // 2. הפוסטים שלהם (גם אם עוד לא אושרו)
      postsQuery = {
        groupId: req.params.groupId,
        $or: [
          { isApproved: true },
          { userId: userId, isApproved: false }
        ]
      };
      console.log('Member - showing approved posts + own pending posts');
    } else {
      // לא חברים רואים רק פוסטים מאושרים (אם זו קבוצה ציבורית)
      postsQuery.isApproved = true;
      console.log('Non-member - showing only approved posts');
    }

    // טען פוסטים של הקבוצה
    const posts = await GroupPost.find(postsQuery).sort({ createdAt: -1 });

    console.log('Posts query result:', {
      totalPosts: posts.length,
      query: postsQuery,
      groupId: req.params.groupId
    });

    // העשרה עם נתוני המשתמש
    const enrichedPosts = await Promise.all(
      posts.map(async (post) => {
        try {
          const user = await User.findById(post.userId);
          return {
            ...post.toObject(),
            userName: user ? user.fullName : 'Unknown User',
            userAvatar: user ? user.avatar : null,
            userBio: user ? user.bio : null,
            groupName: group.name,
            // 🆕 הוסף מידע על סטטוס האישור
            isPending: !post.isApproved,
            canApprove: (isAdmin || isCreator) && !post.isApproved
          };
        } catch (error) {
          console.error('Error enriching post:', post._id, error);
          return {
            ...post.toObject(),
            userName: 'Unknown User',
            userAvatar: null,
            userBio: null,
            groupName: group.name,
            isPending: !post.isApproved,
            canApprove: (isAdmin || isCreator) && !post.isApproved
          };
        }
      })
    );

    console.log(`Returning ${enrichedPosts.length} posts for group ${group.name}`);
    res.json(enrichedPosts);
    
  } catch (error) {
    console.error('Get group posts error:', error);
    res.status(500).json({ message: 'Failed to fetch group posts' });
  }
});

// Delete group post
app.delete('/api/groups/:groupId/posts/:postId', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { groupId, postId } = req.params;
    const { userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid group or post ID' });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const post = await GroupPost.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // בדיקת הרשאות - יוצר הפוסט או אדמין של הקבוצה
    const isPostOwner = post.userId === userId;
    const isGroupAdmin = group.members.some(member => 
      member.userId === userId && member.role === 'admin'
    );
    const isGroupCreator = group.creatorId === userId;

    if (!isPostOwner && !isGroupAdmin && !isGroupCreator) {
      return res.status(403).json({ message: 'Permission denied' });
    }

    await GroupPost.findByIdAndDelete(postId);
    res.json({ message: 'Group post deleted successfully' });
  } catch (error) {
    console.error('Delete group post error:', error);
    res.status(500).json({ message: 'Failed to delete group post' });
  }
});

// ============ GROUP POST INTERACTIONS ============
// הוסף את הקוד הזה אחרי הקוד הקיים של GROUP POST ROUTES בשרת שלך

// Like group post
app.post('/api/groups/:groupId/posts/:postId/like', async (req, res) => {
  try {
    console.log('👍 Liking group post...');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { groupId, postId } = req.params;
    const { userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid group or post ID' });
    }

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isMember = group.members.some(member => member.userId === userId);
    if (!isMember) {
      return res.status(403).json({ message: 'Only group members can like posts' });
    }

    const post = await GroupPost.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.groupId !== groupId) {
      return res.status(400).json({ message: 'Post does not belong to this group' });
    }

    if (!post.likes) post.likes = [];
    if (post.likes.includes(userId)) {
      return res.status(400).json({ message: 'Already liked this post' });
    }

    post.likes.push(userId);
    await post.save();

    // 🆕 יצירת התראה רק אם זה לא הפוסט של עצמו
    if (post.userId !== userId) {
      const liker = await User.findById(userId);
      await createNotification({
        type: 'like',
        fromUserId: userId,
        toUserId: post.userId,
        message: `${liker?.fullName || 'Someone'} liked your recipe "${post.title}" in ${group.name}`,
        postId: post._id,
        postTitle: post.title,
        postImage: post.image,
        groupId: group._id,
        groupName: group.name,
        fromUser: {
          name: liker?.fullName || 'Unknown User',
          avatar: liker?.avatar || null
        }
      });
    }

    console.log('✅ Group post liked successfully');
    res.json({ 
      message: 'Post liked successfully',
      likes: post.likes,
      likesCount: post.likes.length 
    });

  } catch (error) {
    console.error('❌ Like group post error:', error);
    res.status(500).json({ message: 'Failed to like post' });
  }
});

// Unlike group post
app.delete('/api/groups/:groupId/posts/:postId/like', async (req, res) => {
  try {
    console.log('👎 Unliking group post...');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { groupId, postId } = req.params;
    const { userId } = req.body;

    // בדיקת תקינות IDs
    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid group or post ID' });
    }

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // בדיקה שהקבוצה קיימת
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // בדיקה שהמשתמש חבר בקבוצה
    const isMember = group.members.some(member => member.userId === userId);
    if (!isMember) {
      return res.status(403).json({ message: 'Only group members can unlike posts' });
    }

    // מציאת הפוסט
    const post = await GroupPost.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // בדיקה שהפוסט שייך לקבוצה
    if (post.groupId !== groupId) {
      return res.status(400).json({ message: 'Post does not belong to this group' });
    }

    // בדיקה שכבר עשה לייק
    if (!post.likes || !post.likes.includes(userId)) {
      return res.status(400).json({ message: 'Post not liked yet' });
    }

    // הסרת הלייק
    post.likes = post.likes.filter(id => id !== userId);
    await post.save();

    console.log('✅ Group post unliked successfully');
    res.json({ 
      message: 'Post unliked successfully',
      likes: post.likes,
      likesCount: post.likes.length 
    });

  } catch (error) {
    console.error('❌ Unlike group post error:', error);
    res.status(500).json({ message: 'Failed to unlike post' });
  }
});

// Add comment to group post
app.post('/api/groups/:groupId/posts/:postId/comments', async (req, res) => {
  try {
    console.log('💬 Adding comment to group post...');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { groupId, postId } = req.params;
    const { text, userId, userName } = req.body;

    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid group or post ID' });
    }

    if (!text || text.trim() === '') {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isMember = group.members.some(member => member.userId === userId);
    if (!isMember) {
      return res.status(403).json({ message: 'Only group members can comment on posts' });
    }

    const post = await GroupPost.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.groupId !== groupId) {
      return res.status(400).json({ message: 'Post does not belong to this group' });
    }

    const user = await User.findById(userId);

    const newComment = {
      userId: userId,
      userName: userName || user?.fullName || 'Anonymous User',
      userAvatar: user?.avatar || null,
      text: text.trim(),
      createdAt: new Date()
    };

    if (!post.comments) post.comments = [];
    post.comments.push(newComment);
    await post.save();

    // 🆕 יצירת התראה רק אם זה לא הפוסט של עצמו
    if (post.userId !== userId) {
      await createNotification({
        type: 'comment',
        fromUserId: userId,
        toUserId: post.userId,
        message: `${user?.fullName || 'Someone'} commented on your recipe "${post.title}" in ${group.name}`,
        postId: post._id,
        postTitle: post.title,
        postImage: post.image,
        groupId: group._id,
        groupName: group.name,
        fromUser: {
          name: user?.fullName || 'Unknown User',
          avatar: user?.avatar || null
        }
      });
    }

    console.log('✅ Comment added to group post successfully');
    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: {
        comment: newComment,
        comments: post.comments,
        commentsCount: post.comments.length
      }
    });

  } catch (error) {
    console.error('❌ Add comment to group post error:', error);
    res.status(500).json({ message: 'Failed to add comment' });
  }
});

console.log('✅ Notifications activated for all user actions');

// Delete comment from group post
app.delete('/api/groups/:groupId/posts/:postId/comments/:commentId', async (req, res) => {
  try {
    console.log('🗑️ Deleting comment from group post...');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { groupId, postId, commentId } = req.params;
    const { userId } = req.body;

    // בדיקת תקינות IDs
    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid group or post ID' });
    }

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // בדיקה שהקבוצה קיימת
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // בדיקה שהמשתמש חבר בקבוצה
    const isMember = group.members.some(member => member.userId === userId);
    if (!isMember) {
      return res.status(403).json({ message: 'Only group members can delete comments' });
    }

    // מציאת הפוסט
    const post = await GroupPost.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // בדיקה שהפוסט שייך לקבוצה
    if (post.groupId !== groupId) {
      return res.status(400).json({ message: 'Post does not belong to this group' });
    }

    // מציאת התגובה
    const commentIndex = post.comments.findIndex(comment => 
      comment._id.toString() === commentId
    );

    if (commentIndex === -1) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const comment = post.comments[commentIndex];

    // בדיקת הרשאות - יוצר התגובה או אדמין של הקבוצה
    const isCommentOwner = comment.userId === userId;
    const isGroupAdmin = group.members.some(member => 
      member.userId === userId && member.role === 'admin'
    );
    const isGroupCreator = group.creatorId === userId;

    if (!isCommentOwner && !isGroupAdmin && !isGroupCreator) {
      return res.status(403).json({ message: 'Permission denied' });
    }
// מחיקת התגובה
    post.comments.splice(commentIndex, 1);
    await post.save();

    console.log('✅ Comment deleted from group post successfully');
    res.json({ 
      message: 'Comment deleted successfully',
      comments: post.comments,
      commentsCount: post.comments.length 
    });

  } catch (error) {
    console.error('❌ Delete comment from group post error:', error);
    res.status(500).json({ message: 'Failed to delete comment' });
  }
});

// Get group post with comments and likes (עזר לדיבוג)
app.get('/api/groups/:groupId/posts/:postId', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { groupId, postId } = req.params;

    // בדיקת תקינות IDs
    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid group or post ID' });
    }

    // בדיקה שהקבוצה קיימת
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // מציאת הפוסט
    const post = await GroupPost.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // בדיקה שהפוסט שייך לקבוצה
    if (post.groupId !== groupId) {
      return res.status(400).json({ message: 'Post does not belong to this group' });
    }

    // העשרה עם נתוני המשתמש
    const user = await User.findById(post.userId);
    const enrichedPost = {
      ...post.toObject(),
      userName: user ? user.fullName : 'Unknown User',
      userAvatar: user ? user.avatar : null,
      userBio: user ? user.bio : null,
      groupName: group.name
    };

    res.json(enrichedPost);

  } catch (error) {
    console.error('Get group post error:', error);
    res.status(500).json({ message: 'Failed to fetch group post' });
  }
});

// ============ GROUP ROUTES ============

// Create new group
app.post('/api/groups', upload.any(), async (req, res) => {
  try {
    console.log('=== Create Group Debug ===');
    console.log('MongoDB connected:', isMongoConnected());
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const formData = req.body;
    console.log('Group data received:', formData);

    if (!formData.name || formData.name.trim() === '') {
      return res.status(400).json({ message: 'Group name is required' });
    }

    if (!formData.creatorId) {
      return res.status(400).json({ message: 'Creator ID is required' });
    }

    // טיפול בתמונת הקבוצה
    let imageData = null;
    if (req.files && req.files.length > 0) {
      const imageFile = req.files.find(file => 
        file.fieldname === 'image' || 
        file.mimetype.startsWith('image/')
      );
      
      if (imageFile) {
        const base64Image = imageFile.buffer.toString('base64');
        imageData = `data:${imageFile.mimetype};base64,${base64Image}`;
        console.log('Group image converted to base64');
      }
    }

    if (!imageData && formData.image) {
      imageData = formData.image;
    }

    // יצירת הקבוצה
    const groupData = {
      name: formData.name.trim(),
      description: formData.description || '',
      image: imageData,
      creatorId: formData.creatorId,
      isPrivate: formData.isPrivate === 'true' || formData.isPrivate === true,
      category: formData.category || 'General',
      rules: formData.rules || '',
      members: [{
        userId: formData.creatorId,
        role: 'admin',
        joinedAt: new Date()
      }],
      pendingRequests: [],
      settings: {
        allowMemberPosts: formData.allowMemberPosts !== 'false',
        requireApproval: formData.isPrivate === 'true' || formData.isPrivate === true ? (formData.requireApproval === 'true' || formData.requireApproval === true) : false, // קבוצות ציבוריות לא דורשות אישור כברירת מחדל
        allowInvites: formData.allowInvites !== 'false'
      }
    };

    const group = new Group(groupData);
    const savedGroup = await group.save();
    
    console.log('Group created successfully:', savedGroup._id);

    // החזרת הקבוצה עם נתוני היוצר
    const creator = await User.findById(savedGroup.creatorId);
    const enrichedGroup = {
      ...savedGroup.toObject(),
      creatorName: creator ? creator.fullName : 'Unknown',
      creatorAvatar: creator ? creator.avatar : null,
      membersCount: savedGroup.members.length,
      postsCount: 0
    };

    res.status(201).json(enrichedGroup);
  } catch (error) {
    console.error('=== CREATE GROUP ERROR ===');
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to create group' });
  }
});
// ✅ חיפוש קבוצות - חייב להיות לפני '/api/groups'
app.get('/api/groups/search', async (req, res) => {
  try {
    console.log('🔍 Groups search request:', req.query);
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { q, userId, includePrivate } = req.query;
    
    if (!q || q.trim() === '') {
      return res.status(400).json({ message: 'Search query is required' });
    }

    console.log(`🔍 Searching groups with query: "${q}"`);

    // בניית תנאי החיפוש
    const searchConditions = {
      $and: [
        {
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { description: { $regex: q, $options: 'i' } },
            { category: { $regex: q, $options: 'i' } }
          ]
        }
      ]
    };

    // הוספת תנאי פרטיות
    if (includePrivate !== 'true') {
      if (userId) {
        // כלול קבוצות ציבוריות + קבוצות שהמשתמש חבר בהן
        searchConditions.$and.push({
          $or: [
            { isPrivate: { $ne: true } },
            { 'members.userId': userId }
          ]
        });
      } else {
        // רק קבוצות ציבוריות
        searchConditions.$and.push({ isPrivate: { $ne: true } });
      }
    }

    console.log('🔍 Search conditions:', JSON.stringify(searchConditions, null, 2));

    const groups = await Group.find(searchConditions).limit(50).sort({ 
      createdAt: -1 
    });

    console.log(`📊 Found ${groups.length} groups matching search`);

    // העשרה עם נתונים נוספים
    const enrichedGroups = await Promise.all(
      groups.map(async (group) => {
        try {
          const creator = await User.findById(group.creatorId);
          const membersCount = group.members ? group.members.length : 0;
          
          let postsCount = 0;
          try {
            postsCount = await GroupPost.countDocuments({ 
              groupId: group._id, 
              isApproved: true 
            });
          } catch (error) {
            // GroupPost model might not exist yet
            console.log('Could not count posts for group:', group._id);
          }

          return {
            _id: group._id,
            name: group.name,
            description: group.description,
            category: group.category,
            image: group.image,
            isPrivate: group.isPrivate || false,
            creatorId: group.creatorId,
            creatorName: creator ? creator.fullName : 'Unknown',
            creatorAvatar: creator ? creator.avatar : null,
            membersCount,
            postsCount,
            members: group.members || [],
            pendingRequests: group.pendingRequests || [],
            settings: group.settings || {},
            allowMemberPosts: group.settings?.allowMemberPosts ?? group.allowMemberPosts ?? true,
            requireApproval: group.settings?.requireApproval ?? group.requireApproval ?? false,
            createdAt: group.createdAt
          };
        } catch (error) {
          console.error('Error enriching search result:', group._id, error);
          return null;
        }
      })
    );

    // סנן תוצאות null
    const validResults = enrichedGroups.filter(group => group !== null);

    console.log(`✅ Returning ${validResults.length} groups for search query: "${q}"`);
    res.json(validResults);
    
  } catch (error) {
    console.error('❌ Groups search error:', error);
    res.status(500).json({ message: 'Failed to search groups' });
  }
});

// Get all groups (public + user's private groups)
app.get('/api/groups', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId } = req.query;
    
    let groups;
    if (userId) {
      // קבוצות ציבוריות + קבוצות פרטיות שהמשתמש חבר בהן
      groups = await Group.find({
        $or: [
          { isPrivate: false },
          { 'members.userId': userId }
        ]
      }).sort({ createdAt: -1 });
    } else {
      // רק קבוצות ציבוריות
      groups = await Group.find({ isPrivate: false }).sort({ createdAt: -1 });
    }

    // העשרה עם נתונים נוספים
    const enrichedGroups = await Promise.all(
      groups.map(async (group) => {
        const creator = await User.findById(group.creatorId);
        const postsCount = await GroupPost.countDocuments({ groupId: group._id });
        
        return {
          ...group.toObject(),
          creatorName: creator ? creator.fullName : 'Unknown',
          creatorAvatar: creator ? creator.avatar : null,
          membersCount: group.members.length,
          postsCount: postsCount
        };
      })
    );

    res.json(enrichedGroups);
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ message: 'Failed to fetch groups' });
  }
});

// ✅ Get single group with details - תיקון להחזיר פרטי מבקשים
app.get('/api/groups/:id', async (req, res) => {
  try {
    console.log('📥 Get single group request:', req.params.id);
    
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    console.log('📋 Group found:', group.name);

    try {
      // ✅ העשרה עם נתונים מפורטים
      const creator = await User.findById(group.creatorId);
      
      // ספירת פוסטים מאושרים
      let postsCount = 0;
      try {
        postsCount = await GroupPost.countDocuments({ 
          groupId: group._id, 
          isApproved: true 
        });
      } catch (error) {
        console.log('Could not count posts for group:', group._id);
      }
      
      // ✅ רשימת חברים עם פרטים מלאים
      const membersDetails = await Promise.all(
        (group.members || []).map(async (member) => {
          try {
            const user = await User.findById(member.userId);
            return {
              userId: member.userId,
              role: member.role || 'member',
              joinedAt: member.joinedAt || member.createdAt,
              userName: user ? user.fullName : 'Unknown User',
              userAvatar: user ? user.avatar : null,
              userEmail: user ? user.email : null
            };
          } catch (error) {
            console.error('Error fetching member details:', member.userId, error);
            return {
              userId: member.userId,
              role: member.role || 'member',
              joinedAt: member.joinedAt,
              userName: 'Unknown User',
              userAvatar: null,
              userEmail: null
            };
          }
        })
      );

      // ✅ רשימת בקשות ממתינות עם פרטים מלאים - זה הדבר החשוב!
      console.log('🔍 Processing pending requests:', group.pendingRequests?.length || 0);
      
      const pendingRequestsDetails = await Promise.all(
        (group.pendingRequests || []).map(async (request) => {
          try {
            console.log('🔍 Fetching user details for request:', request.userId);
            const user = await User.findById(request.userId);
            
            if (!user) {
              console.log('⚠️  User not found for request:', request.userId);
              return {
                userId: request.userId,
                requestDate: request.createdAt || request.requestDate || new Date(),
                userName: 'Unknown User',
                userAvatar: null,
                userBio: null,
                userEmail: null
              };
            }
            
            console.log('✅ Found user for request:', user.fullName);
            return {
              userId: request.userId,
              requestDate: request.createdAt || request.requestDate || new Date(),
              userName: user.fullName || user.name || 'Unknown User',
              userAvatar: user.avatar,
              userBio: user.bio,
              userEmail: user.email
            };
          } catch (error) {
            console.error('❌ Error fetching request details for user:', request.userId, error);
            return {
              userId: request.userId,
              requestDate: request.createdAt || new Date(),
              userName: 'Unknown User',
              userAvatar: null,
              userBio: null,
              userEmail: null
            };
          }
        })
      );

      console.log('📊 Pending requests details processed:', {
        totalRequests: pendingRequestsDetails.length,
        usersFound: pendingRequestsDetails.filter(r => r.userName !== 'Unknown User').length,
        unknownUsers: pendingRequestsDetails.filter(r => r.userName === 'Unknown User').length
      });

      const enrichedGroup = {
        _id: group._id,
        name: group.name,
        description: group.description,
        category: group.category,
        image: group.image,
        isPrivate: group.isPrivate || false,
        creatorId: group.creatorId,
        creatorName: creator ? creator.fullName : 'Unknown',
        creatorAvatar: creator ? creator.avatar : null,
        membersCount: (group.members || []).length,
        postsCount,
        members: group.members || [],
        membersDetails,
        pendingRequests: group.pendingRequests || [],
        pendingRequestsDetails, // ✅ זה החשוב!
        // ✅ תמיכה בשני מבני הגדרות
        settings: group.settings || {
          allowMemberPosts: group.allowMemberPosts ?? true,
          requireApproval: group.requireApproval ?? false,
          allowInvites: group.allowInvites ?? true
        },
        allowMemberPosts: group.settings?.allowMemberPosts ?? group.allowMemberPosts ?? true,
        requireApproval: group.settings?.requireApproval ?? group.requireApproval ?? false,
        allowInvites: group.settings?.allowInvites ?? group.allowInvites ?? true,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt
      };

      console.log('✅ Group enriched successfully:', {
        name: enrichedGroup.name,
        membersCount: enrichedGroup.membersCount,
        postsCount: enrichedGroup.postsCount,
        pendingRequestsCount: enrichedGroup.pendingRequests.length,
        pendingRequestsWithDetails: enrichedGroup.pendingRequestsDetails.length
      });

      res.json(enrichedGroup);
      
    } catch (enrichError) {
      console.error('❌ Error enriching group data:', enrichError);
      // החזר נתונים בסיסיים אם ההעשרה נכשלה
      res.json({
        _id: group._id,
        name: group.name,
        description: group.description,
        category: group.category,
        image: group.image,
        isPrivate: group.isPrivate || false,
        creatorId: group.creatorId,
        creatorName: 'Unknown',
        creatorAvatar: null,
        membersCount: (group.members || []).length,
        postsCount: 0,
        members: group.members || [],
        membersDetails: [],
        pendingRequests: group.pendingRequests || [],
        pendingRequestsDetails: [], // גם כאן ריק במקרה של שגיאה
        settings: {},
        allowMemberPosts: true,
        requireApproval: false,
        allowInvites: true,
        createdAt: group.createdAt
      });
    }
    
  } catch (error) {
    console.error('❌ Get group error:', error);
    res.status(500).json({ message: 'Failed to fetch group' });
  }
});

// ✅ Join group (request to join) - מתוקן
app.post('/api/groups/:groupId/join', async (req, res) => {
  try {
    console.log('🔄 Join group request:', req.params.groupId);
    
    if (!mongoose.Types.ObjectId.isValid(req.params.groupId)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // מצא את הקבוצה
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    console.log('📋 Group found:', group.name);

    // בדוק שהמשתמש לא כבר חבר בקבוצה
    const isMember = group.members.some(member => 
      member.userId === userId || member.userId?.toString() === userId?.toString()
    );

    if (isMember) {
      return res.status(400).json({ message: 'User is already a member of this group' });
    }

    // בדוק שאין כבר בקשה ממתינה
    const hasPendingRequest = group.pendingRequests.some(request => 
      request.userId === userId || request.userId?.toString() === userId?.toString()
    );

    if (hasPendingRequest) {
      return res.status(400).json({ message: 'Join request already pending' });
    }

    // ✅ בדוק אם זו קבוצה פרטית הדורשת אישור
    if (group.isPrivate || group.settings?.requireApproval || group.requireApproval) {
      // הוסף לרשימת בקשות ממתינות
      group.pendingRequests.push({
        userId: userId,
        requestDate: new Date(),
        createdAt: new Date() // גם שדה זה למקרה
      });

      await group.save();

      console.log('✅ Join request added to pending list');

      res.json({
        message: 'Join request sent successfully',
        status: 'pending',
        groupId: group._id,
        userId: userId
      });

    } else {
      // קבוצה ציבורית - הוסף ישירות כחבר
      group.members.push({
        userId: userId,
        role: 'member',
        joinedAt: new Date()
      });

      await group.save();

      console.log('✅ User added directly to group (public group)');

      res.json({
        message: 'Joined group successfully',
        status: 'approved',
        groupId: group._id,
        userId: userId
      });
    }

  } catch (error) {
    console.error('❌ Join group error:', error);
    res.status(500).json({ message: 'Failed to join group' });
  }
});

// Approve/Reject join request (admin only)
app.put('/api/groups/:id/requests/:userId', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { action, adminId } = req.body; // action: 'approve' or 'reject'
    
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // בדיקת הרשאות אדמין
    const isAdmin = group.members.some(member => 
      member.userId === adminId && member.role === 'admin'
    );
    if (!isAdmin) {
      return res.status(403).json({ message: 'Admin privileges required' });
    }

    const { userId } = req.params;
    
    // מציאת הבקשה
    const requestIndex = group.pendingRequests.findIndex(request => request.userId === userId);
    if (requestIndex === -1) {
      return res.status(404).json({ message: 'Join request not found' });
    }

    // הסרת הבקשה מהרשימה
    group.pendingRequests.splice(requestIndex, 1);

    if (action === 'approve') {
      // הוספה כחבר
      group.members.push({
        userId: userId,
        role: 'member',
        joinedAt: new Date()
      });
    }

    await group.save();
    
    const message = action === 'approve' ? 'User approved successfully' : 'User rejected successfully';
    res.json({ message, action });
  } catch (error) {
    console.error('Handle request error:', error);
    res.status(500).json({ message: 'Failed to handle request' });
  }
});

// Remove member from group (Admin only)
app.delete('/api/groups/:groupId/members/:memberUserId', async (req, res) => {
  try {
    console.log('Removing member from group');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { groupId, memberUserId } = req.params;
    const { adminId } = req.body;

    // בדיקת תקינות IDs
    if (!mongoose.Types.ObjectId.isValid(groupId) || !memberUserId || !adminId) {
      return res.status(400).json({ message: 'Invalid group ID, member ID, or admin ID' });
    }

    // בדיקה שהקבוצה קיימת
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // בדיקה שהמבקש הוא אדמין או יוצר הקבוצה
    const isAdmin = group.members.some(member => 
      (member.userId === adminId || member.userId?.toString() === adminId?.toString()) && 
      (member.role === 'admin' || member.role === 'owner')
    );
    const isCreator = group.creatorId === adminId || group.creatorId?.toString() === adminId?.toString();
    
    if (!isAdmin && !isCreator) {
      return res.status(403).json({ message: 'Only admins can remove members' });
    }

    // בדיקה שהחבר קיים בקבוצה
    const memberIndex = group.members.findIndex(member => 
      member.userId === memberUserId || member.userId?.toString() === memberUserId?.toString()
    );
    
    if (memberIndex === -1) {
      return res.status(404).json({ message: 'Member not found in group' });
    }

    const memberToRemove = group.members[memberIndex];

    // מניעת הסרת היוצר
    if (memberToRemove.role === 'owner' || group.creatorId === memberUserId || group.creatorId?.toString() === memberUserId?.toString()) {
      return res.status(403).json({ message: 'Cannot remove the group creator' });
    }

    // מניעת הסרה עצמית (השתמש ב-leave endpoint במקום)
    if (memberUserId === adminId) {
      return res.status(400).json({ message: 'Use leave group endpoint to remove yourself' });
    }

    // הסרת החבר מהקבוצה
    group.members.splice(memberIndex, 1);
    group.membersCount = group.members.length;
    
    await group.save();

    console.log('Member removed from group successfully');
    res.json({ 
      message: 'Member removed successfully',
      removedMemberId: memberUserId,
      newMembersCount: group.membersCount
    });

  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ message: 'Failed to remove member' });
  }
});

// ✅ ביטול בקשת הצטרפות לקבוצה
app.delete('/api/groups/:groupId/join', async (req, res) => {
  try {
    console.log('🔄 Canceling join request for group:', req.params.groupId);
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.groupId)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // מצא את הקבוצה
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    console.log('📋 Group found:', group.name);

    // בדוק שהמשתמש לא כבר חבר בקבוצה
    const isMember = group.members.some(member => 
      member.userId === userId || member.userId?.toString() === userId?.toString()
    );

    if (isMember) {
      return res.status(400).json({ message: 'User is already a member of this group' });
    }

    // בדוק שיש בקשה ממתינה
    const hasPendingRequest = group.pendingRequests.some(request => 
      request.userId === userId || request.userId?.toString() === userId?.toString()
    );

    if (!hasPendingRequest) {
      return res.status(400).json({ message: 'No pending request found for this user' });
    }

    // הסר את הבקשה מרשימת הבקשות הממתינות
    group.pendingRequests = group.pendingRequests.filter(request => 
      request.userId !== userId && request.userId?.toString() !== userId?.toString()
    );

    await group.save();

    console.log('✅ Join request canceled successfully');

    res.json({
      message: 'Join request canceled successfully',
      status: 'canceled',
      groupId: group._id,
      userId: userId
    });

  } catch (error) {
    console.error('❌ Cancel join request error:', error);
    res.status(500).json({ message: 'Failed to cancel join request' });
  }
});

// Leave group
app.delete('/api/groups/:id/members/:userId', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const { userId } = req.params;
    console.log('group.creatorId:', group.creatorId);
    console.log('userId:', userId);
    console.log('group.members before:', group.members);
    // לא ניתן להסיר את היוצר
    if (group.creatorId === userId || group.creatorId?.toString() === userId?.toString()) {
      return res.status(400).json({ message: 'Group creator cannot leave the group' });
    }

    // הסרת החבר
    group.members = group.members.filter(member => member.userId !== userId && member.userId?.toString() !== userId?.toString());
    await group.save();
    
    res.json({ message: 'Left group successfully' });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ message: 'Failed to leave group' });
  }
});

// Leave group (self-removal)
app.delete('/api/groups/:groupId/leave/:userId', async (req, res) => {
  try {
    console.log('User leaving group');

    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { groupId, userId } = req.params;

    // בדיקת תקינות IDs
    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid group ID or user ID' });
    }

    // שליפת הקבוצה
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // מניעת הסרת היוצר
    if (group.creatorId?.toString() === userId) {
      return res.status(400).json({ message: 'Group creator cannot leave the group' });
    }

    // הסרת המשתמש מהרשימה
    const initialCount = group.members.length;
    group.members = group.members.filter(member =>
      member.userId?.toString() !== userId
    );
    
    // בדיקה אם המשתמש בכלל היה בקבוצה
    if (group.members.length === initialCount) {
      return res.status(404).json({ message: 'User not found in group' });
    }

    group.membersCount = group.members.length;
    await group.save();

    console.log('User left group successfully');
    res.json({ message: 'Left group successfully', userId });

  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ message: 'Failed to leave group' });
  }
});

// Update group (admin/creator only) 
app.put('/api/groups/:id', upload.single('image'), async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const groupId = req.params.id;
    const { 
      name, 
      description, 
      category, 
      rules,
      isPrivate, 
      allowMemberPosts, 
      requireApproval, 
      allowInvites,
      updatedBy 
    } = req.body;

    console.log('✅ Updating group:', groupId);
    console.log('Updated by:', updatedBy);

    // מצא את הקבוצה
    const group = await Group.findById(groupId);
    if (!group) {
      console.log('❌ Group not found:', groupId);
      return res.status(404).json({
        message: 'Group not found'
      });
    }

    console.log('✅ Group found:', group.name);

    // בדוק הרשאות - creator או admin
    const isCreator = group.creatorId === updatedBy || group.creatorId?.toString() === updatedBy?.toString();
    const isAdmin = group.members?.some(member => 
      (member.userId === updatedBy || member.userId?.toString() === updatedBy?.toString()) && 
      (member.role === 'admin' || member.role === 'owner')
    );

    console.log('Permission check:', { isCreator, isAdmin, creatorId: group.creatorId, updatedBy });

    if (!isCreator && !isAdmin) {
      console.log('❌ Permission denied');
      return res.status(403).json({
        message: 'Only group admins can update settings'
      });
    }

    console.log('✅ Permission granted');

    // עדכן את השדות
    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    if (category) group.category = category;
    if (rules !== undefined) group.rules = rules;
    if (isPrivate !== undefined) group.isPrivate = isPrivate === 'true';

    // עדכן הגדרות
    if (!group.settings) group.settings = {};
    
    if (allowMemberPosts !== undefined) {
      group.settings.allowMemberPosts = allowMemberPosts === 'true';
      group.allowMemberPosts = group.settings.allowMemberPosts; // תאימות לאחור
    }
    
    if (requireApproval !== undefined) {
      const requireApprovalValue = (isPrivate === 'true') ? (requireApproval === 'true') : false;
      group.settings.requireApproval = requireApprovalValue;
      group.requireApproval = requireApprovalValue; // תאימות לאחור
    }
    
    if (allowInvites !== undefined) {
      group.settings.allowInvites = allowInvites === 'true';
      group.allowInvites = group.settings.allowInvites; // תאימות לאחור
    }

    // עדכן תמונה אם הועלתה
    if (req.file) {
      console.log('📷 New image uploaded:', req.file.filename);
      // אם יש תמונה ישנה, אפשר למחוק אותה
      if (group.image) {
        const fs = require('fs');
        const path = require('path');
        const oldImagePath = path.join(__dirname, '..', 'public', group.image);
        if (fs.existsSync(oldImagePath)) {
          try {
            fs.unlinkSync(oldImagePath);
            console.log('🗑️ Old image deleted');
          } catch (err) {
            console.log('⚠️ Could not delete old image:', err.message);
          }
        }
      }
      group.image = `/uploads/groups/${req.file.filename}`;
    }

    group.updatedAt = new Date();
    const updatedGroup = await group.save();

    console.log('✅ Group updated successfully');

    res.json({
      message: 'Group updated successfully',
      group: updatedGroup
    });

  } catch (error) {
    console.error('❌ Update group error:', error);
    res.status(500).json({
      message: 'Failed to update group',
      error: error.message
    });
  }
});

// Delete group (creator only)
app.delete('/api/groups/:id', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId } = req.body;
    
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (group.creatorId !== userId) {
      return res.status(403).json({ message: 'Only group creator can delete the group' });
    }

    // מחיקת כל הפוסטים של הקבוצה
    await GroupPost.deleteMany({ groupId: req.params.id });
    
    // מחיקת הקבוצה
    await Group.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ message: 'Failed to delete group' });
  }
});

// Get user profile
app.get('/api/user/profile/:userId', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      user: { 
        id: user._id, 
        fullName: user.fullName, 
        email: user.email, 
        bio: user.bio,
        avatar: user.avatar 
      }
    });
    
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Failed to get profile' });
  }
});

// Delete recipe
app.delete('/api/recipes/:id', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    // בדיקת תקינות ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid recipe ID' });
    }

    const deletedRecipe = await Recipe.findByIdAndDelete(req.params.id);
    if (!deletedRecipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    res.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    console.error('Delete recipe error:', error);
    res.status(500).json({ message: 'Failed to delete recipe' });
  }
});

// MongoDB connection - עם טיפול יותר טוב בשגיאות
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => {
      console.log('MongoDB Connection Error:', err);
      // לא נקריס את האפליקציה אם מונגו לא מתחבר
    });
} else {
  console.log('MONGODB_URI not found - running without database');
}

// User schema - עם הוספת avatar ו-bio
const UserSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  bio: { type: String, maxlength: 500 },
  avatar: { type: String, maxlength: 10000000 },
  followers: [{ type: String }],
  following: [{ type: String }]
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

// Group schema - מערכת קבוצות
const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 100 },
  description: { type: String, maxlength: 500 },
  image: { type: String, maxlength: 10000000 }, // תמונת נושא של הקבוצה
  creatorId: { type: String, required: true }, // יוצר הקבוצה
  isPrivate: { type: Boolean, default: false }, // קבוצה פרטית או ציבורית
  category: { type: String, default: 'General' }, // קטגוריית הקבוצה
  members: [{
    userId: String,
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now }
  }],
  pendingRequests: [{ // בקשות להצטרפות
    userId: String,
    requestedAt: { type: Date, default: Date.now }
  }],
  rules: { type: String, maxlength: 1000 }, // חוקי הקבוצה
  settings: {
    allowMemberPosts: { type: Boolean, default: true },
    requireApproval: { type: Boolean, default: true },
    allowInvites: { type: Boolean, default: true }
  }
}, { timestamps: true });

const Group = mongoose.model('Group', GroupSchema);

// GroupPost schema - פוסטים של קבוצות
const GroupPostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  ingredients: String,
  instructions: String,
  category: { type: String, default: 'General' },
  meatType: { type: String, default: 'Mixed' },
  prepTime: { type: Number, default: 0 },
  servings: { type: Number, default: 1 },
  image: { type: String, maxlength: 10000000 },
  userId: { type: String, required: true },
  groupId: { type: String, required: true }, // שייך לקבוצה ספציפית
  likes: [{ type: String }],
  comments: [{
    userId: String,
    userName: String,
    text: String,
    createdAt: { type: Date, default: Date.now }
  }],
  isApproved: { type: Boolean, default: false } // צריך אישור אדמין
}, { timestamps: true });

const GroupPost = mongoose.model('GroupPost', GroupPostSchema);
// Private Chat Schema
const PrivateChatSchema = new mongoose.Schema({
  participants: [{
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    userAvatar: { type: String },
    joinedAt: { type: Date, default: Date.now }
  }],
  lastMessage: {
    senderId: String,
    content: String,
    createdAt: Date
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  }
}, { timestamps: true });

const PrivateChat = mongoose.model('PrivateChat', PrivateChatSchema);

// Message Schema
const MessageSchema = new mongoose.Schema({
  chatId: { type: String, required: true },
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  content: { type: String, required: true },
  messageType: { type: String, default: 'text' },
  readBy: [{
    userId: String,
    readAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

const Message = mongoose.model('Message', MessageSchema);
// Recipe schema - עם reference למשתמש במקום שכפול נתונים
const RecipeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  ingredients: String,
  instructions: String,
  category: { type: String, default: 'General' },
  meatType: { type: String, default: 'Mixed' },
  prepTime: { type: Number, default: 0 },
  servings: { type: Number, default: 1 },
  image: { type: String, maxlength: 10000000 }, // תמיכה בתמונות גדולות (Base64)
  userId: { type: String, required: true }, // רק reference למשתמש
  // הסרתי userName ו-userAvatar - נטען בזמן אמת
  likes: [{ type: String }],
  comments: [{
    userId: String,
    userName: String, // זה נשאר לתגובות כי זה פחות קריטי
    text: String,
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

const Recipe = mongoose.model('Recipe', RecipeSchema);
// הוסף את הקוד הזה לשרת שלך אחרי ה-schemas הקיימים
// הוסף את זה לשרת שלך (לפני ה-API routes):

// הוסף את זה לשרת שלך (לפני ה-API routes):

// Notification Schema
const NotificationSchema = new mongoose.Schema({
  type: { 
    type: String, 
    required: true,
    enum: ['like', 'comment', 'follow', 'group_post', 'group_join_request', 'group_request_approved']
  },
  fromUserId: { type: String, required: true }, // מי שיצר את ההתראה
  toUserId: { type: String, required: true },   // למי ההתראה
  message: { type: String, required: true },
  postId: { type: String }, // אם זה קשור לפוסט
  postTitle: { type: String },
  postImage: { type: String },
  groupId: { type: String }, // אם זה קשור לקבוצה
  groupName: { type: String },
  read: { type: Boolean, default: false },
  // נתוני המשתמש שיצר את ההתראה (לשמירת נתונים)
  fromUser: {
    name: String,
    avatar: String
  }
}, { timestamps: true });

const Notification = mongoose.model('Notification', NotificationSchema);

// ============ NOTIFICATION API ENDPOINTS ============

// קבלת התראות של משתמש
app.get('/api/notifications', async (req, res) => {
  try {
    console.log('📬 Fetching notifications');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    console.log('📥 Getting notifications for user:', userId);

    const notifications = await Notification.find({ 
      toUserId: userId 
    }).sort({ createdAt: -1 }).limit(50);

    console.log(`✅ Found ${notifications.length} notifications`);
    
    res.json({
      success: true,
      data: notifications
    });

  } catch (error) {
    console.error('❌ Get notifications error:', error);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
});

// סימון התראה כנקראה
app.put('/api/notifications/:notificationId/read', async (req, res) => {
  try {
    console.log('👁️ Marking notification as read:', req.params.notificationId);
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const notification = await Notification.findByIdAndUpdate(
      req.params.notificationId,
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    console.log('✅ Notification marked as read');
    res.json({ 
      success: true,
      data: notification 
    });

  } catch (error) {
    console.error('❌ Mark notification as read error:', error);
    res.status(500).json({ message: 'Failed to mark as read' });
  }
});

// סימון כל ההתראות כנקראו
app.put('/api/notifications/mark-all-read', async (req, res) => {
  try {
    console.log('👁️ Marking all notifications as read');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    await Notification.updateMany(
      { toUserId: userId, read: false },
      { read: true }
    );

    console.log('✅ All notifications marked as read');
    res.json({ 
      success: true,
      message: 'All notifications marked as read'
    });

  } catch (error) {
    console.error('❌ Mark all as read error:', error);
    res.status(500).json({ message: 'Failed to mark all as read' });
  }
});

// קבלת מספר התראות לא נקראו
app.get('/api/notifications/unread-count', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const count = await Notification.countDocuments({ 
      toUserId: userId, 
      read: false 
    });

    res.json({
      success: true,
      count
    });

  } catch (error) {
    console.error('❌ Get unread count error:', error);
    res.status(500).json({ 
      success: false,
      count: 0
    });
  }
});

// יצירת התראה (helper function)
const createNotification = async (notificationData) => {
  try {
    if (!isMongoConnected()) {
      console.log('❌ Database not connected, skipping notification');
      return { success: false };
    }

    const notification = new Notification(notificationData);
    await notification.save();
    
    console.log('✅ Notification created:', notification.type);
    return { success: true, data: notification };
  } catch (error) {
    console.error('❌ Create notification error:', error);
    return { success: false };
  }
};
// Group Chat Schema
const GroupChatSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 100 },
  description: { type: String, maxlength: 500 },
  image: { type: String, maxlength: 10000000 }, // תמונת פרופיל של הצ'אט
  adminId: { type: String, required: true }, // מנהל הצ'אט
  participants: [{
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    userAvatar: { type: String },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now }
  }],
  lastMessage: {
    senderId: String,
    senderName: String,
    content: String,
    messageType: { type: String, default: 'text' },
    createdAt: Date
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  },
  settings: {
    allowMemberInvites: { type: Boolean, default: false }, // רק אדמין יכול להזמין
    allowNameChange: { type: Boolean, default: true }, // חברים יכולים לשנות שם
    allowMemberLeave: { type: Boolean, default: true }
  }
}, { timestamps: true });

const GroupChat = mongoose.model('GroupChat', GroupChatSchema);

// Group Chat Message Schema - מורחב מההודעות הרגילות
const GroupChatMessageSchema = new mongoose.Schema({
  groupChatId: { type: String, required: true },
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  senderAvatar: { type: String },
  content: { type: String, required: true },
  messageType: { type: String, default: 'text' }, // text, image, file, system
  readBy: [{
    userId: String,
    readAt: { type: Date, default: Date.now }
  }],
  // הודעות מערכת (הצטרפות, עזיבה, שינוי שם וכו')
  isSystemMessage: { type: Boolean, default: false },
  systemMessageType: { type: String } // user_joined, user_left, name_changed, admin_changed
}, { timestamps: true });

const GroupChatMessage = mongoose.model('GroupChatMessage', GroupChatMessageSchema);

// ============ GROUP CHAT ROUTES ============

// יצירת צ'אט קבוצתי חדש
app.post('/api/group-chats', async (req, res) => {
  try {
    console.log('=== Creating Group Chat ===');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { name, description, participants, creatorId } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: 'Group chat name is required' });
    }

    if (!creatorId) {
      return res.status(400).json({ message: 'Creator ID is required' });
    }

    if (!participants || participants.length === 0) {
      return res.status(400).json({ message: 'At least one participant is required' });
    }

    console.log('Creating group chat:', name, 'with', participants.length, 'participants');

    // קבל פרטי היוצר
    const creator = await User.findById(creatorId);
    if (!creator) {
      return res.status(404).json({ message: 'Creator not found' });
    }

    // בנה רשימת משתתפים עם היוצר כאדמין
    const chatParticipants = [{
      userId: creatorId,
      userName: creator.fullName,
      userAvatar: creator.avatar,
      role: 'admin',
      joinedAt: new Date()
    }];

    // הוסף משתתפים נוספים
    for (const participantId of participants) {
      if (participantId !== creatorId) { // אל תוסיף את היוצר פעמיים
        const user = await User.findById(participantId);
        if (user) {
          chatParticipants.push({
            userId: participantId,
            userName: user.fullName,
            userAvatar: user.avatar,
            role: 'member',
            joinedAt: new Date()
          });
        }
      }
    }

    // יצור את הצ'אט הקבוצתי
    const groupChat = new GroupChat({
      name: name.trim(),
      description: description || '',
      adminId: creatorId,
      participants: chatParticipants,
      unreadCount: new Map(chatParticipants.map(p => [p.userId, 0])),
      settings: {
        allowMemberInvites: false,
        allowNameChange: true,
        allowMemberLeave: true
      }
    });

    await groupChat.save();

    // צור הודעת מערכת ראשונה
    const systemMessage = new GroupChatMessage({
      groupChatId: groupChat._id,
      senderId: 'system',
      senderName: 'System',
      content: `${creator.fullName} created the group`,
      messageType: 'system',
      isSystemMessage: true,
      systemMessageType: 'group_created',
      readBy: chatParticipants.map(p => ({ userId: p.userId }))
    });

    await systemMessage.save();

    console.log('✅ Group chat created successfully:', groupChat._id);
    res.status(201).json(groupChat);

  } catch (error) {
    console.error('❌ Create group chat error:', error);
    res.status(500).json({ message: 'Failed to create group chat' });
  }
});

// קבלת כל הצ'אטים הקבוצתיים של המשתמש
app.get('/api/group-chats/my', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const currentUserId = req.headers['x-user-id'] || 'temp-user-id';
    
    console.log('Fetching group chats for user:', currentUserId);

    const groupChats = await GroupChat.find({
      'participants.userId': currentUserId
    }).sort({ updatedAt: -1 });

    // העשר כל צ'אט עם מידע נוסף
    const enrichedChats = groupChats.map(chat => {
      const unreadCount = chat.unreadCount.get(currentUserId) || 0;
      const isAdmin = chat.adminId === currentUserId;

      return {
        ...chat.toObject(),
        unreadCount,
        isAdmin,
        participantsCount: chat.participants.length,
        type: 'group' // להבדיל מצ'אטים פרטיים
      };
    });

    console.log(`Found ${enrichedChats.length} group chats for user`);
    res.json(enrichedChats);

  } catch (error) {
    console.error('Get my group chats error:', error);
    res.status(500).json({ message: 'Failed to fetch group chats' });
  }
});

// קבלת צ'אט קבוצתי ספציפי
app.get('/api/group-chats/:chatId', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { chatId } = req.params;
    const currentUserId = req.headers['x-user-id'] || 'temp-user-id';

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: 'Invalid chat ID' });
    }

    const groupChat = await GroupChat.findById(chatId);
    if (!groupChat) {
      return res.status(404).json({ message: 'Group chat not found' });
    }

    // בדוק שהמשתמש חלק מהצ'אט
    const isParticipant = groupChat.participants.some(p => p.userId === currentUserId);
    if (!isParticipant) {
      return res.status(403).json({ message: 'Not authorized to access this chat' });
    }

    const isAdmin = groupChat.adminId === currentUserId;
    const unreadCount = groupChat.unreadCount.get(currentUserId) || 0;

    const enrichedChat = {
      ...groupChat.toObject(),
      isAdmin,
      unreadCount,
      participantsCount: groupChat.participants.length,
      type: 'group'
    };

    res.json(enrichedChat);

  } catch (error) {
    console.error('Get group chat error:', error);
    res.status(500).json({ message: 'Failed to fetch group chat' });
  }
});

// קבלת הודעות צ'אט קבוצתי
app.get('/api/group-chats/:chatId/messages', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { chatId } = req.params;
    const currentUserId = req.headers['x-user-id'] || 'temp-user-id';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: 'Invalid chat ID' });
    }

    // וודא שהמשתמש חלק מהצ'אט
    const groupChat = await GroupChat.findById(chatId);
    if (!groupChat) {
      return res.status(404).json({ message: 'Group chat not found' });
    }

    const isParticipant = groupChat.participants.some(p => p.userId === currentUserId);
    if (!isParticipant) {
      return res.status(403).json({ message: 'Not authorized to access this chat' });
    }

    console.log(`Fetching messages for group chat ${chatId}, page ${page}`);

    const messages = await GroupChatMessage.find({ groupChatId: chatId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // החזר בסדר הנכון (ישן לחדש)
    const orderedMessages = messages.reverse();
    console.log(`Found ${orderedMessages.length} messages`);
    
    res.json(orderedMessages);

  } catch (error) {
    console.error('Get group chat messages error:', error);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

// שליחת הודעה לצ'אט קבוצתי
app.post('/api/group-chats/:chatId/messages', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { chatId } = req.params;
    const { content, messageType = 'text' } = req.body;
    const currentUserId = req.headers['x-user-id'] || 'temp-user-id';

    if (!content || content.trim() === '') {
      return res.status(400).json({ message: 'Message content is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: 'Invalid chat ID' });
    }

    // וודא שהמשתמש חלק מהצ'אט
    const groupChat = await GroupChat.findById(chatId);
    if (!groupChat) {
      return res.status(404).json({ message: 'Group chat not found' });
    }

    const participant = groupChat.participants.find(p => p.userId === currentUserId);
    if (!participant) {
      return res.status(403).json({ message: 'Not authorized to send message to this chat' });
    }

    console.log(`Sending message to group chat ${chatId} from ${participant.userName}`);

    // צור הודעה חדשה
    const message = new GroupChatMessage({
      groupChatId: chatId,
      senderId: currentUserId,
      senderName: participant.userName,
      senderAvatar: participant.userAvatar,
      content: content.trim(),
      messageType,
      readBy: [{ userId: currentUserId }] // השולח כבר "קרא" את ההודעה
    });

    await message.save();

    // עדכן את הצ'אט עם ההודעה האחרונה
    groupChat.lastMessage = {
      senderId: currentUserId,
      senderName: participant.userName,
      content: content.trim(),
      messageType,
      createdAt: message.createdAt
    };

    // עדכן מונה הודעות לא נקראו עבור שאר המשתתפים
    groupChat.participants.forEach(p => {
      if (p.userId !== currentUserId) {
        const currentCount = groupChat.unreadCount.get(p.userId) || 0;
        groupChat.unreadCount.set(p.userId, currentCount + 1);
      }
    });

    await groupChat.save();

    console.log('Message sent successfully to group chat:', message._id);
    res.status(201).json(message);

  } catch (error) {
    console.error('Send group chat message error:', error);
    res.status(500).json({ message: 'Failed to send message' });
  }
});

// הוספת משתתף לצ'אט קבוצתי (רק אדמין)
app.post('/api/group-chats/:chatId/participants', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { chatId } = req.params;
    const { userIds } = req.body; // array של user IDs
    const currentUserId = req.headers['x-user-id'] || 'temp-user-id';

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'User IDs array is required' });
    }

    const groupChat = await GroupChat.findById(chatId);
    if (!groupChat) {
      return res.status(404).json({ message: 'Group chat not found' });
    }

    // בדוק שהמשתמש הוא אדמין
    if (groupChat.adminId !== currentUserId) {
      return res.status(403).json({ message: 'Only admin can add participants' });
    }

    const newParticipants = [];
    const addedUsers = [];

    for (const userId of userIds) {
      // בדוק שהמשתמש לא כבר בצ'אט
      const isAlreadyParticipant = groupChat.participants.some(p => p.userId === userId);
      if (isAlreadyParticipant) {
        continue;
      }

      const user = await User.findById(userId);
      if (user) {
        const newParticipant = {
          userId,
          userName: user.fullName,
          userAvatar: user.avatar,
          role: 'member',
          joinedAt: new Date()
        };

        newParticipants.push(newParticipant);
        addedUsers.push(user.fullName);
        
        // הוסף למונה הודעות לא נקראו
        groupChat.unreadCount.set(userId, 0);
      }
    }

    if (newParticipants.length === 0) {
      return res.status(400).json({ message: 'No new participants to add' });
    }

    // הוסף את המשתתפים החדשים
    groupChat.participants.push(...newParticipants);
    await groupChat.save();

    // צור הודעת מערכת
    const admin = groupChat.participants.find(p => p.userId === currentUserId);
    const systemMessage = new GroupChatMessage({
      groupChatId: chatId,
      senderId: 'system',
      senderName: 'System',
      content: `${admin.userName} added ${addedUsers.join(', ')} to the group`,
      messageType: 'system',
      isSystemMessage: true,
      systemMessageType: 'users_added',
      readBy: groupChat.participants.map(p => ({ userId: p.userId }))
    });

    await systemMessage.save();

    console.log(`✅ Added ${newParticipants.length} participants to group chat`);
    res.json({ 
      message: `Added ${newParticipants.length} participants`,
      addedParticipants: newParticipants
    });

  } catch (error) {
    console.error('Add participants error:', error);
    res.status(500).json({ message: 'Failed to add participants' });
  }
});

// הסרת משתתף מצ'אט קבוצתי (רק אדמין)
app.delete('/api/group-chats/:chatId/participants/:userId', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { chatId, userId } = req.params;
    const currentUserId = req.headers['x-user-id'] || 'temp-user-id';

    const groupChat = await GroupChat.findById(chatId);
    if (!groupChat) {
      return res.status(404).json({ message: 'Group chat not found' });
    }

    // בדוק שהמשתמש הוא אדמין
    if (groupChat.adminId !== currentUserId) {
      return res.status(403).json({ message: 'Only admin can remove participants' });
    }

    // אל תתן לאדמין להסיר את עצמו
    if (userId === currentUserId) {
      return res.status(400).json({ message: 'Admin cannot remove themselves. Use leave group instead.' });
    }

    // מצא את המשתתף
    const participantIndex = groupChat.participants.findIndex(p => p.userId === userId);
    if (participantIndex === -1) {
      return res.status(404).json({ message: 'Participant not found' });
    }

    const removedParticipant = groupChat.participants[participantIndex];
    
    // הסר את המשתתף
    groupChat.participants.splice(participantIndex, 1);
    groupChat.unreadCount.delete(userId);
    await groupChat.save();

    // צור הודעת מערכת
    const admin = groupChat.participants.find(p => p.userId === currentUserId);
    const systemMessage = new GroupChatMessage({
      groupChatId: chatId,
      senderId: 'system',
      senderName: 'System',
      content: `${admin.userName} removed ${removedParticipant.userName} from the group`,
      messageType: 'system',
      isSystemMessage: true,
      systemMessageType: 'user_removed',
      readBy: groupChat.participants.map(p => ({ userId: p.userId }))
    });

    await systemMessage.save();

    console.log(`✅ Removed participant ${removedParticipant.userName} from group chat`);
    res.json({ 
      message: 'Participant removed successfully',
      removedParticipant: removedParticipant.userName
    });

  } catch (error) {
    console.error('Remove participant error:', error);
    res.status(500).json({ message: 'Failed to remove participant' });
  }
});

// עזיבת צ'אט קבוצתי
app.delete('/api/group-chats/:chatId/leave', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { chatId } = req.params;
    const currentUserId = req.headers['x-user-id'] || 'temp-user-id';

    const groupChat = await GroupChat.findById(chatId);
    if (!groupChat) {
      return res.status(404).json({ message: 'Group chat not found' });
    }

    // מצא את המשתתף
    const participantIndex = groupChat.participants.findIndex(p => p.userId === currentUserId);
    if (participantIndex === -1) {
      return res.status(404).json({ message: 'Not a participant in this chat' });
    }

    const leavingParticipant = groupChat.participants[participantIndex];
    const isAdmin = groupChat.adminId === currentUserId;

    // הסר את המשתתף
    groupChat.participants.splice(participantIndex, 1);
    groupChat.unreadCount.delete(currentUserId);

    // אם האדמין עוזב, הקצה אדמין חדש רנדומלי
    if (isAdmin && groupChat.participants.length > 0) {
      const randomIndex = Math.floor(Math.random() * groupChat.participants.length);
      const newAdmin = groupChat.participants[randomIndex];
      
      groupChat.adminId = newAdmin.userId;
      newAdmin.role = 'admin';

      console.log(`Admin left, new admin is: ${newAdmin.userName}`);

      // צור הודעת מערכת על שינוי אדמין
      const adminChangeMessage = new GroupChatMessage({
        groupChatId: chatId,
        senderId: 'system',
        senderName: 'System',
        content: `${newAdmin.userName} is now the group admin`,
        messageType: 'system',
        isSystemMessage: true,
        systemMessageType: 'admin_changed',
        readBy: groupChat.participants.map(p => ({ userId: p.userId }))
      });

      await adminChangeMessage.save();
    }

    // אם זה היה החבר האחרון, מחק את הצ'אט
    if (groupChat.participants.length === 0) {
      await GroupChat.findByIdAndDelete(chatId);
      await GroupChatMessage.deleteMany({ groupChatId: chatId });
      
      console.log('✅ Group chat deleted - no participants left');
      return res.json({ message: 'Left group chat successfully. Group was deleted.' });
    }

    await groupChat.save();

    // צור הודעת מערכת על עזיבה
    const systemMessage = new GroupChatMessage({
      groupChatId: chatId,
      senderId: 'system',
      senderName: 'System',
      content: `${leavingParticipant.userName} left the group`,
      messageType: 'system',
      isSystemMessage: true,
      systemMessageType: 'user_left',
      readBy: groupChat.participants.map(p => ({ userId: p.userId }))
    });

    await systemMessage.save();

    console.log(`✅ User ${leavingParticipant.userName} left group chat`);
    res.json({ message: 'Left group chat successfully' });

  } catch (error) {
    console.error('Leave group chat error:', error);
    res.status(500).json({ message: 'Failed to leave group chat' });
  }
});

// החלף את הendpoint הזה בשרת שלך:

// עדכון שם/תיאור/תמונה/הגדרות צ'אט קבוצתי
app.put('/api/group-chats/:chatId', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { chatId } = req.params;
    const { 
      name, 
      description, 
      image, 
      allowNameChange, 
      allowImageChange, 
      allowMemberInvites 
    } = req.body;
    
    const currentUserId = req.headers['x-user-id'] || 'temp-user-id';

    console.log('🔄 Updating group chat:', chatId);
    console.log('👤 Requested by:', currentUserId);
    console.log('📝 Update fields:', Object.keys(req.body));

    const groupChat = await GroupChat.findById(chatId);
    if (!groupChat) {
      console.log('❌ Group chat not found');
      return res.status(404).json({ message: 'Group chat not found' });
    }

    // בדוק שהמשתמש חלק מהצ'אט
    const participant = groupChat.participants.find(p => p.userId === currentUserId);
    if (!participant) {
      console.log('❌ User not authorized - not a participant');
      return res.status(403).json({ message: 'Not authorized to modify this chat' });
    }

    const isAdmin = groupChat.adminId === currentUserId;
    console.log('🔐 User permissions:', { isAdmin, participantRole: participant.role });

    // אתחל הגדרות אם לא קיימות
    if (!groupChat.settings) {
      groupChat.settings = {
        allowMemberInvites: false,
        allowNameChange: true,
        allowImageChange: true,
        allowMemberLeave: true
      };
    }

    const oldName = groupChat.name;
    let changes = [];

    // ✅ עדכון שם קבוצה
    if (name && name.trim() !== groupChat.name) {
      const canChangeName = groupChat.settings.allowNameChange || isAdmin;
      if (!canChangeName) {
        console.log('❌ Permission denied for name change');
        return res.status(403).json({ message: 'Only admin can change group name when member editing is disabled' });
      }
      groupChat.name = name.trim();
      changes.push(`name changed from "${oldName}" to "${name.trim()}"`);
      console.log('✅ Name updated:', name.trim());
    }

    // ✅ עדכון תיאור קבוצה
    if (description !== undefined && description !== groupChat.description) {
      const canChangeDescription = groupChat.settings.allowNameChange || isAdmin;
      if (!canChangeDescription) {
        console.log('❌ Permission denied for description change');
        return res.status(403).json({ message: 'Only admin can change group description when member editing is disabled' });
      }
      groupChat.description = description;
      changes.push('description updated');
      console.log('✅ Description updated');
    }

    // ✅ עדכון תמונת קבוצה
    if (image !== undefined && image !== groupChat.image) {
      const canChangeImage = groupChat.settings.allowImageChange !== false || isAdmin;
      if (!canChangeImage) {
        console.log('❌ Permission denied for image change');
        return res.status(403).json({ message: 'Only admin can change group image when member editing is disabled' });
      }
      groupChat.image = image;
      changes.push(image ? 'image updated' : 'image removed');
      console.log('✅ Image updated:', image ? 'new image set' : 'image removed');
    }

    // ✅ עדכון הגדרות (רק אדמין)
    if (allowNameChange !== undefined && isAdmin) {
      groupChat.settings.allowNameChange = allowNameChange;
      changes.push(`member name editing ${allowNameChange ? 'enabled' : 'disabled'}`);
      console.log('✅ allowNameChange updated:', allowNameChange);
    }

    if (allowImageChange !== undefined && isAdmin) {
      groupChat.settings.allowImageChange = allowImageChange;
      changes.push(`member image editing ${allowImageChange ? 'enabled' : 'disabled'}`);
      console.log('✅ allowImageChange updated:', allowImageChange);
    }

    if (allowMemberInvites !== undefined && isAdmin) {
      groupChat.settings.allowMemberInvites = allowMemberInvites;
      changes.push(`member invites ${allowMemberInvites ? 'enabled' : 'disabled'}`);
      console.log('✅ allowMemberInvites updated:', allowMemberInvites);
    }

    // בדיקה שיש שינויים
    if (changes.length === 0) {
      console.log('⚠️ No changes to apply');
      return res.status(400).json({ message: 'No changes provided' });
    }

    // שמירת השינויים
    await groupChat.save();
    console.log('💾 Group chat saved successfully');

    // יצירת הודעת מערכת על השינויים
    try {
      const systemMessage = new GroupChatMessage({
        groupChatId: chatId,
        senderId: 'system',
        senderName: 'System',
        content: `${participant.userName} ${changes.join(' and ')}`,
        messageType: 'system',
        isSystemMessage: true,
        systemMessageType: 'group_updated',
        readBy: groupChat.participants.map(p => ({ userId: p.userId }))
      });

      await systemMessage.save();
      console.log('📨 System message created');
    } catch (msgError) {
      console.warn('⚠️ Failed to create system message:', msgError.message);
    }

    console.log(`✅ Group chat updated successfully: ${changes.join(', ')}`);
    
    res.json({ 
      message: 'Group chat updated successfully',
      changes,
      groupChat: {
        ...groupChat.toObject(),
        participantsCount: groupChat.participants.length
      }
    });

  } catch (error) {
    console.error('❌ Update group chat error:', error);
    res.status(500).json({ 
      message: 'Failed to update group chat',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// סימון הודעות כנקראו בצ'אט קבוצתי
app.put('/api/group-chats/:chatId/read', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { chatId } = req.params;
    const currentUserId = req.headers['x-user-id'] || 'temp-user-id';

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: 'Invalid chat ID' });
    }

    console.log(`Marking group chat messages as read for user ${currentUserId} in chat ${chatId}`);

    // עדכן את מונה ההודעות הלא נקראו בצ'אט
    const groupChat = await GroupChat.findById(chatId);
    if (groupChat) {
      groupChat.unreadCount.set(currentUserId, 0);
      await groupChat.save();
    }

    // עדכן את ההודעות כנקראו
    await GroupChatMessage.updateMany(
      { 
        groupChatId: chatId, 
        senderId: { $ne: currentUserId },
        'readBy.userId': { $ne: currentUserId }
      },
      { 
        $push: { 
          readBy: { 
            userId: currentUserId, 
            readAt: new Date() 
          } 
        } 
      }
    );

    res.json({ message: 'Messages marked as read' });

  } catch (error) {
    console.error('Mark group chat as read error:', error);
    res.status(500).json({ message: 'Failed to mark as read' });
  }
});

// קבלת משתמשים זמינים להזמנה (עוקבים + צ'אטים פרטיים)
app.get('/api/group-chats/available-users', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const currentUserId = req.headers['x-user-id'] || 'temp-user-id';
    const { chatId } = req.query; // לבדוק מי כבר בצ'אט

    // קבל את המשתמש הנוכחי
    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // קבל רשימת עוקבים
    const following = currentUser.following || [];

    // קבל משתמשים מצ'אטים פרטיים
    const privateChats = await PrivateChat.find({
      'participants.userId': currentUserId
    });

    const chatPartners = new Set();
    privateChats.forEach(chat => {
      chat.participants.forEach(p => {
        if (p.userId !== currentUserId) {
          chatPartners.add(p.userId);
        }
      });
    });

    // שלב את כל המשתמשים הזמינים
    const availableUserIds = [...new Set([...following, ...Array.from(chatPartners)])];

    // אם יש chatId, הסר משתמשים שכבר בצ'אט
    let excludedUsers = [currentUserId]; // תמיד הסר את עצמך
    
    if (chatId && mongoose.Types.ObjectId.isValid(chatId)) {
      const existingChat = await GroupChat.findById(chatId);
      if (existingChat) {
        excludedUsers.push(...existingChat.participants.map(p => p.userId));
      }
    }

    // קבל פרטי המשתמשים
    const availableUsers = await Promise.all(
      availableUserIds
        .filter(userId => !excludedUsers.includes(userId))
        .map(async (userId) => {
          try {
            const user = await User.findById(userId);
            if (user) {
              return {
                userId: user._id,
                userName: user.fullName,
                userEmail: user.email,
                userAvatar: user.avatar,
                userBio: user.bio,
                isFollowing: following.includes(userId),
                hasPrivateChat: chatPartners.has(userId)
              };
            }
            return null;
          } catch (error) {
            console.error('Error fetching user:', userId, error);
            return null;
          }
        })
    );

    // סנן null values
    const validUsers = availableUsers.filter(user => user !== null);

    // מיין לפי שם
    validUsers.sort((a, b) => a.userName.localeCompare(b.userName));

    console.log(`Found ${validUsers.length} available users for invitation`);
    res.json(validUsers);

  } catch (error) {
    console.error('Get available users error:', error);
    res.status(500).json({ message: 'Failed to get available users' });
  }
});

console.log('✅ Group Chat endpoints added successfully');

// Helper function לבדיקה אם מונגו זמין
const isMongoConnected = () => {
  return mongoose.connection.readyState === 1;
};

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { fullName, email, password } = req.body;
    
    // בדיקת נתונים נדרשים
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
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
        user: { id: user._id, fullName, email, bio: user.bio, avatar: user.avatar }
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 11000) {
      res.status(400).json({ message: 'Email already exists' });
    } else {
      res.status(500).json({ message: 'Registration failed' });
    }
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    const user = await User.findOne({ email, password });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    res.json({
      message: 'Login successful',
      data: { 
        token: 'dummy-token-' + user._id,
        user: { id: user._id, fullName: user.fullName, email: user.email, bio: user.bio, avatar: user.avatar }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

app.post('/api/auth/forgotpassword', async (req, res) => {
  res.json({ message: 'Password reset instructions sent' });
});

// Avatar upload endpoint
app.post('/api/upload/avatar', upload.single('avatar'), async (req, res) => {
  try {
    console.log('=== Avatar Upload Debug ===');
    console.log('MongoDB connected:', isMongoConnected());
    
    if (!isMongoConnected()) {
      console.log('ERROR: Database not available');
      return res.status(503).json({ error: 'Database not available' });
    }

    if (!req.file) {
      console.log('ERROR: No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('File details:', {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // בדיקה שזה קובץ תמונה
    if (!req.file.mimetype.startsWith('image/')) {
      console.log('ERROR: File is not an image');
      return res.status(400).json({ error: 'Only image files are allowed' });
    }

    // בדיקת גודל תמונה (5MB מקסימום)
    if (req.file.size > 5 * 1024 * 1024) {
      console.log('ERROR: File too large');
      return res.status(413).json({ error: 'Image too large - maximum 5MB allowed' });
    }

    // המרה ל-Base64 (כמו בפוסטים)
    const base64Image = req.file.buffer.toString('base64');
    const imageData = `data:${req.file.mimetype};base64,${base64Image}`;
    
    console.log('Avatar converted to base64, length:', imageData.length);
    
    // החזרת התמונה כ-Base64 - הלקוח ישמור אותה בפרופיל המשתמש
    res.json({
      success: true,
      url: imageData, // Base64 string לשמירה בפרופיל
      filename: req.file.originalname
    });
    
  } catch (error) {
    console.error('=== AVATAR UPLOAD ERROR ===');
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// Alternative avatar upload endpoints (for compatibility)
app.post('/api/user/upload-avatar', upload.single('avatar'), async (req, res) => {
  try {
    console.log('Avatar upload request received (user endpoint)');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ error: 'Database not available' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image files are allowed' });
    }

    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image too large - maximum 5MB allowed' });
    }

    const base64Image = req.file.buffer.toString('base64');
    const imageData = `data:${req.file.mimetype};base64,${base64Image}`;
    
    res.json({
      success: true,
      url: imageData,
      filename: req.file.originalname
    });
    
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// Another alternative endpoint
app.post('/api/auth/avatar', upload.single('avatar'), async (req, res) => {
  try {
    console.log('Avatar upload request received (auth endpoint)');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ error: 'Database not available' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image files are allowed' });
    }

    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image too large - maximum 5MB allowed' });
    }

    const base64Image = req.file.buffer.toString('base64');
    const imageData = `data:${req.file.mimetype};base64,${base64Image}`;
    
    res.json({
      success: true,
      url: imageData,
      filename: req.file.originalname
    });
    
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// ============ FOLLOW SYSTEM ============
// Follow a user
app.post('/api/users/:userId/follow', async (req, res) => {
  try {
    console.log('👥 Following user...');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId } = req.params;
    const { followerId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId) || !followerId) {
      return res.status(400).json({ message: 'Invalid user ID or follower ID' });
    }

    if (userId === followerId) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }

    const [userToFollow, follower] = await Promise.all([
      User.findById(userId),
      User.findById(followerId)
    ]);

    if (!userToFollow || !follower) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!userToFollow.followers) userToFollow.followers = [];
    if (!follower.following) follower.following = [];

    if (userToFollow.followers.includes(followerId)) {
      return res.status(400).json({ message: 'Already following this user' });
    }

    userToFollow.followers.push(followerId);
    follower.following.push(userId);

    await Promise.all([
      userToFollow.save(),
      follower.save()
    ]);

    // 🆕 יצירת התראה
    await createNotification({
      type: 'follow',
      fromUserId: followerId,
      toUserId: userId,
      message: `${follower.fullName || 'Someone'} started following you`,
      fromUser: {
        name: follower.fullName || 'Unknown User',
        avatar: follower.avatar || null
      }
    });

    console.log('✅ User followed successfully');
    res.json({ 
      message: 'User followed successfully',
      followersCount: userToFollow.followers.length,
      followingCount: follower.following.length
    });

  } catch (error) {
    console.error('❌ Follow user error:', error);
    res.status(500).json({ message: 'Failed to follow user' });
  }
});

// Unfollow a user
app.delete('/api/users/:userId/follow', async (req, res) => {
  try {
    console.log('👥 Unfollowing user...');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId } = req.params; // המשתמש שרוצים להפסיק לעקוב אחריו
    const { followerId } = req.body; // המשתמש שמפסיק לעקוב

    if (!mongoose.Types.ObjectId.isValid(userId) || !followerId) {
      return res.status(400).json({ message: 'Invalid user ID or follower ID' });
    }

    // בדיקה שהמשתמשים קיימים
    const [userToUnfollow, follower] = await Promise.all([
      User.findById(userId),
      User.findById(followerId)
    ]);

    if (!userToUnfollow || !follower) {
      return res.status(404).json({ message: 'User not found' });
    }

    // בדיקה שכבר עוקב
    if (!userToUnfollow.followers || !userToUnfollow.followers.includes(followerId)) {
      return res.status(400).json({ message: 'Not following this user' });
    }

    // הסרת המעקב
    userToUnfollow.followers = userToUnfollow.followers.filter(id => id !== followerId);
    follower.following = follower.following ? follower.following.filter(id => id !== userId) : [];

    await Promise.all([
      userToUnfollow.save(),
      follower.save()
    ]);

    console.log('✅ User unfollowed successfully');
    res.json({ 
      message: 'User unfollowed successfully',
      followersCount: userToUnfollow.followers.length,
      followingCount: follower.following.length
    });

  } catch (error) {
    console.error('❌ Unfollow user error:', error);
    res.status(500).json({ message: 'Failed to unfollow user' });
  }
});

// Get user's followers count and following status
app.get('/api/users/:userId/follow-status/:viewerId', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId, viewerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const followersCount = user.followers ? user.followers.length : 0;
    const followingCount = user.following ? user.following.length : 0;
    const isFollowing = viewerId && user.followers ? user.followers.includes(viewerId) : false;

    res.json({
      followersCount,
      followingCount,
      isFollowing
    });

  } catch (error) {
    console.error('Get follow status error:', error);
    res.status(500).json({ message: 'Failed to get follow status' });
  }
});

// ============ EDIT POST ENDPOINTS - FIXED ============
// Edit regular recipe
app.put('/api/recipes/:id', upload.any(), async (req, res) => {
  try {
    console.log('✏️ Editing recipe...');
    console.log('Recipe ID:', req.params.id);
    console.log('Form data:', req.body);
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { id } = req.params;
    const formData = req.body;

    // בדיקת תקינות ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('❌ Invalid recipe ID:', id);
      return res.status(400).json({ message: 'Invalid recipe ID' });
    }

    // מציאת הפוסט
    const recipe = await Recipe.findById(id);
    if (!recipe) {
      console.log('❌ Recipe not found:', id);
      return res.status(404).json({ message: 'Recipe not found' });
    }

    console.log('📋 Found recipe:', recipe.title);
    console.log('👤 Recipe owner:', recipe.userId);
    console.log('👤 Editor user:', formData.userId);

    // בדיקת הרשאות - רק יוצר הפוסט יכול לערוך (תיקון השוואה)
    if (recipe.userId.toString() !== formData.userId.toString()) {
      console.log('❌ Permission denied - user mismatch');
      return res.status(403).json({ message: 'Permission denied' });
    }

    // טיפול בתמונה חדשה
    let imageData = recipe.image; // שמור את התמונה הקיימת כברירת מחדל

    if (req.files && req.files.length > 0) {
      const imageFile = req.files.find(file => 
        file.fieldname === 'image' || 
        file.mimetype.startsWith('image/')
      );
      
      if (imageFile) {
        console.log('📷 New image uploaded, size:', imageFile.size);
        const base64Image = imageFile.buffer.toString('base64');
        imageData = `data:${imageFile.mimetype};base64,${base64Image}`;
      }
    } else if (formData.image && formData.image !== recipe.image) {
      console.log('📷 Image updated from form data');
      imageData = formData.image;
    }

    // וידוא שהנתונים החובה קיימים
    if (!formData.title || formData.title.trim().length === 0) {
      return res.status(400).json({ message: 'Title is required' });
    }

    // עדכון הנתונים עם validations
    const updateData = {
      title: formData.title.trim(),
      description: formData.description || recipe.description,
      ingredients: formData.ingredients || recipe.ingredients,
      instructions: formData.instructions || recipe.instructions,
      category: formData.category || recipe.category,
      meatType: formData.meatType || recipe.meatType,
      prepTime: formData.prepTime ? parseInt(formData.prepTime) : recipe.prepTime,
      servings: formData.servings ? parseInt(formData.servings) : recipe.servings,
      image: imageData,
      updatedAt: new Date()
    };

    console.log('🔄 Updating recipe with data:', {
      title: updateData.title,
      category: updateData.category,
      prepTime: updateData.prepTime,
      servings: updateData.servings
    });

    const updatedRecipe = await Recipe.findByIdAndUpdate(id, updateData, { 
      new: true,
      runValidators: true // הפעל validations של המונגו
    });
    
    if (!updatedRecipe) {
      console.log('❌ Failed to update recipe');
      return res.status(500).json({ message: 'Failed to update recipe' });
    }

    // החזרת המתכון עם נתוני המשתמש
    const user = await User.findById(updatedRecipe.userId);
    const enrichedRecipe = {
      ...updatedRecipe.toObject(),
      userName: user ? user.fullName : 'Unknown User',
      userAvatar: user ? user.avatar : null,
      userBio: user ? user.bio : null
    };

    console.log('✅ Recipe edited successfully:', enrichedRecipe.title);
    res.json({
      success: true,
      data: enrichedRecipe,
      message: 'Recipe updated successfully'
    });

  } catch (error) {
    console.error('❌ Edit recipe error:', error);
    
    // מידע מפורט יותר על השגיאה
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: validationErrors 
      });
    }
    
    res.status(500).json({ 
      message: 'Failed to edit recipe',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Edit group post
app.put('/api/groups/:groupId/posts/:postId', upload.any(), async (req, res) => {
  try {
    console.log('✏️ Editing group post...');
    console.log('Group ID:', req.params.groupId);
    console.log('Post ID:', req.params.postId);
    console.log('Form data:', req.body);
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { groupId, postId } = req.params;
    const formData = req.body;

    // בדיקת תקינות IDs
    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(postId)) {
      console.log('❌ Invalid IDs - Group:', groupId, 'Post:', postId);
      return res.status(400).json({ message: 'Invalid group or post ID' });
    }

    // בדיקה שהקבוצה קיימת
    const group = await Group.findById(groupId);
    if (!group) {
      console.log('❌ Group not found:', groupId);
      return res.status(404).json({ message: 'Group not found' });
    }

    // מציאת הפוסט
    const post = await GroupPost.findById(postId);
    if (!post) {
      console.log('❌ Post not found:', postId);
      return res.status(404).json({ message: 'Post not found' });
    }

    console.log('📋 Found post:', post.title);
    console.log('🏠 Post group:', post.groupId);
    console.log('👤 Post owner:', post.userId);
    console.log('👤 Editor user:', formData.userId);

    // בדיקה שהפוסט שייך לקבוצה (תיקון השוואה)
    if (post.groupId.toString() !== groupId.toString()) {
      console.log('❌ Post does not belong to group');
      return res.status(400).json({ message: 'Post does not belong to this group' });
    }

    // בדיקת הרשאות - יוצר הפוסט או אדמין של הקבוצה (תיקון השוואות)
    const isPostOwner = post.userId.toString() === formData.userId.toString();
    const isGroupAdmin = group.members.some(member => 
      member.userId.toString() === formData.userId.toString() && member.role === 'admin'
    );
    const isGroupCreator = group.creatorId.toString() === formData.userId.toString();

    console.log('🔐 Permissions check:', {
      isPostOwner,
      isGroupAdmin,
      isGroupCreator
    });

    if (!isPostOwner && !isGroupAdmin && !isGroupCreator) {
      console.log('❌ Permission denied');
      return res.status(403).json({ message: 'Permission denied' });
    }

    // טיפול בתמונה חדשה
    let imageData = post.image; // שמור את התמונה הקיימת כברירת מחדל
    
    if (req.files && req.files.length > 0) {
      const imageFile = req.files.find(file => 
        file.fieldname === 'image' || 
        file.mimetype.startsWith('image/')
      );
      
      if (imageFile) {
        console.log('📷 New image uploaded for group post, size:', imageFile.size);
        const base64Image = imageFile.buffer.toString('base64');
        imageData = `data:${imageFile.mimetype};base64,${base64Image}`;
      }
    } else if (formData.image && formData.image !== post.image) {
      console.log('📷 Group post image updated from form data');
      imageData = formData.image;
    }

    // וידוא שהנתונים החובה קיימים
    if (!formData.title || formData.title.trim().length === 0) {
      return res.status(400).json({ message: 'Title is required' });
    }

    // עדכון הנתונים
    const updateData = {
      title: formData.title.trim(),
      description: formData.description || post.description,
      ingredients: formData.ingredients || post.ingredients,
      instructions: formData.instructions || post.instructions,
      category: formData.category || post.category,
      meatType: formData.meatType || post.meatType,
      prepTime: formData.prepTime ? parseInt(formData.prepTime) : post.prepTime,
      servings: formData.servings ? parseInt(formData.servings) : post.servings,
      image: imageData,
      updatedAt: new Date()
    };

    console.log('🔄 Updating group post with data:', {
      title: updateData.title,
      category: updateData.category,
      prepTime: updateData.prepTime,
      servings: updateData.servings
    });

    const updatedPost = await GroupPost.findByIdAndUpdate(postId, updateData, { 
      new: true,
      runValidators: true // הפעל validations של המונגו
    });
    
    if (!updatedPost) {
      console.log('❌ Failed to update group post');
      return res.status(500).json({ message: 'Failed to update group post' });
    }

    // החזרת הפוסט עם נתוני המשתמש והקבוצה
    const user = await User.findById(updatedPost.userId);
    const enrichedPost = {
      ...updatedPost.toObject(),
      userName: user ? user.fullName : 'Unknown User',
      userAvatar: user ? user.avatar : null,
      userBio: user ? user.bio : null,
      groupName: group.name
    };

    console.log('✅ Group post edited successfully:', enrichedPost.title);
    res.json({
      success: true,
      data: enrichedPost,
      message: 'Group post updated successfully'
    });

  } catch (error) {
    console.error('❌ Edit group post error:', error);
    
    // מידע מפורט יותר על השגיאה
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: validationErrors 
      });
    }
    
    res.status(500).json({ 
      message: 'Failed to edit group post',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Profile routes - עדכון פרופיל משתמש (מספר endpoints לתאימות)

// Helper function לעדכון פרופיל
const updateUserProfile = async (req, res) => {
  try {
    console.log('=== Profile Update Debug ===');
    console.log('Request body:', req.body);
    console.log('MongoDB connected:', isMongoConnected());
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId, id, fullName, email, avatar, bio } = req.body;
    const userIdToUse = userId || id; // נסה שניהם
    
    if (!userIdToUse) {
      console.log('ERROR: No user ID provided');
      return res.status(400).json({ message: 'User ID is required' });
    }

    // בדיקת תקינות ObjectId
    if (!mongoose.Types.ObjectId.isValid(userIdToUse)) {
      console.log('ERROR: Invalid user ID:', userIdToUse);
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // חיפוש המשתמש
    const user = await User.findById(userIdToUse);
    if (!user) {
      console.log('ERROR: User not found:', userIdToUse);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('Found user:', user.email);

    // עדכון הנתונים
    if (fullName !== undefined) user.fullName = fullName;
    if (email !== undefined) user.email = email;
    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar; // שמירת ה-Base64 של התמונה

    console.log('Updating user profile:', {
      userId: userIdToUse,
      fullName,
      email,
      bio,
      hasAvatar: !!avatar,
      avatarLength: avatar ? avatar.length : 0
    });

    // שמירה
    await user.save();
    
    console.log('Profile updated successfully');

    res.json({
      message: 'Profile updated successfully',
      user: { 
        id: user._id, 
        fullName: user.fullName, 
        email: user.email, 
        bio: user.bio,
        avatar: user.avatar 
      }
    });
    
  } catch (error) {
    console.error('=== PROFILE UPDATE ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    
    if (error.code === 11000) {
      res.status(400).json({ message: 'Email already exists' });
    } else if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      res.status(400).json({ message: 'Validation error', errors: validationErrors });
    } else {
      res.status(500).json({ message: 'Failed to update profile' });
    }
  }
};

// Multiple endpoints for profile update (for compatibility)
app.put('/api/user/profile', updateUserProfile);
app.patch('/api/user/profile', updateUserProfile);
app.put('/api/auth/profile', updateUserProfile);
app.patch('/api/auth/profile', updateUserProfile);
app.put('/api/auth/update-profile', updateUserProfile);
app.patch('/api/auth/update-profile', updateUserProfile);

// Change password endpoint
app.put('/api/auth/change-password', async (req, res) => {
  try {
    console.log('=== Change Password Debug ===');
    console.log('Request body:', { userId: req.body.userId, hasCurrentPassword: !!req.body.currentPassword, hasNewPassword: !!req.body.newPassword });
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId, currentPassword, newPassword } = req.body;
    
    // בדיקת נתונים נדרשים
    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ message: 'User ID, current password and new password are required' });
    }

    // בדיקת תקינות ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // חיפוש המשתמש
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('Found user:', user.email);

    // בדיקת הסיסמה הנוכחית
    if (user.password !== currentPassword) {
      console.log('Current password does not match');
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // בדיקת validation של הסיסמה החדשה (כמו בקומפוננטה)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ 
        message: 'Password must contain at least 8 characters, including uppercase and lowercase letters, a number and a special character' 
      });
    }

    // עדכון הסיסמה
    user.password = newPassword;
    await user.save();
    
    console.log('Password updated successfully for user:', user.email);

    res.json({
      message: 'Password changed successfully'
    });
    
  } catch (error) {
    console.error('=== CHANGE PASSWORD ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    
    res.status(500).json({ message: 'Failed to change password' });
  }
});

// Alternative endpoints for password change
app.patch('/api/auth/change-password', async (req, res) => {
  // Same logic as PUT endpoint
  try {
    console.log('=== Change Password Debug (PATCH) ===');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId, currentPassword, newPassword } = req.body;
    
    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ message: 'User ID, current password and new password are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.password !== currentPassword) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ 
        message: 'Password must contain at least 8 characters, including uppercase and lowercase letters, a number and a special character' 
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      message: 'Password changed successfully'
    });
    
  } catch (error) {
    console.error('Change password error (PATCH):', error);
    res.status(500).json({ message: 'Failed to change password' });
  }
});

app.put('/api/user/change-password', async (req, res) => {
  // Same logic - third endpoint for compatibility
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId, currentPassword, newPassword } = req.body;
    
    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ message: 'User ID, current password and new password are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.password !== currentPassword) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ 
        message: 'Password must contain at least 8 characters, including uppercase and lowercase letters, a number and a special character' 
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      message: 'Password changed successfully'
    });
    
  } catch (error) {
    console.error('Change password error (user endpoint):', error);
    res.status(500).json({ message: 'Failed to change password' });
  }
});

app.get('/api/user/profile/:userId', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      user: { 
        id: user._id, 
        fullName: user.fullName, 
        email: user.email, 
        bio: user.bio,
        avatar: user.avatar 
      }
    });
    
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Failed to get profile' });
  }
});

// Recipe routes
app.get('/api/recipes', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    // טעינת מתכונים עם נתוני המשתמש
    const recipes = await Recipe.find().sort({ createdAt: -1 });
    
    // העשרת כל מתכון עם נתוני המשתמש המעודכנים
    const enrichedRecipes = await Promise.all(
      recipes.map(async (recipe) => {
        const user = await User.findById(recipe.userId);
        return {
          ...recipe.toObject(),
          userName: user ? user.fullName : 'Unknown User',
          userAvatar: user ? user.avatar : null,
          userBio: user ? user.bio : null
        };
      })
    );

    res.json(enrichedRecipes);
  } catch (error) {
    console.error('Get recipes error:', error);
    res.status(500).json({ message: 'Failed to fetch recipes' });
  }
});

// Handle FormData with multer
app.post('/api/recipes', upload.any(), async (req, res) => {
  try {
    console.log('=== Recipe Creation Debug ===');
    console.log('MongoDB connected:', isMongoConnected());
    console.log('Content-Type:', req.headers['content-type']);
    console.log('req.body:', req.body);
    console.log('req.files length:', req.files ? req.files.length : 0);
    
    if (!isMongoConnected()) {
      console.log('ERROR: Database not available');
      return res.status(503).json({ message: 'Database not available' });
    }

    // Handle FormData - the data is now in req.body after multer processing
    const formData = req.body;
    
    // בדיקת נתונים נדרשים
    if (!formData.title || formData.title.trim() === '') {
      console.log('ERROR: Recipe title is missing, received:', formData.title);
      return res.status(400).json({ message: 'Recipe title is required' });
    }
    
    console.log('Title validation passed:', formData.title);
    
    // טיפול בתמונה
    let imageData = null;
    if (req.files && req.files.length > 0) {
      // מחפשים קובץ תמונה
      const imageFile = req.files.find(file => 
        file.fieldname === 'image' || 
        file.mimetype.startsWith('image/')
      );
      
      if (imageFile) {
        console.log('Image file found:', {
          fieldname: imageFile.fieldname,
          originalname: imageFile.originalname,
          mimetype: imageFile.mimetype,
          size: imageFile.size
        });
        
// המרה ל-Base64
        const base64Image = imageFile.buffer.toString('base64');
        imageData = `data:${imageFile.mimetype};base64,${base64Image}`;
        console.log('Image converted to base64, length:', imageData.length);
      }
    }
    
    // אם אין קובץ אבל יש base64 בנתונים (מהפורטמט הקודם)
    if (!imageData && formData.image) {
      imageData = formData.image;
      console.log('Using image data from form field');
    }
    
    // ברירות מחדל לנתונים חסרים
    const recipeData = {
      title: formData.title.trim(),
      description: formData.description || '',
      ingredients: formData.ingredients || '',
      instructions: formData.instructions || '',
      category: formData.category || 'General',
      meatType: formData.meatType || 'Mixed',
      prepTime: parseInt(formData.prepTime) || 0,
      servings: parseInt(formData.servings) || 1,
      image: imageData, // התמונה כ-Base64 או null
      userId: formData.userId || 'anonymous', // רק ה-ID, לא שם או תמונה
      likes: [],
      comments: []
    };
    
    console.log('Creating recipe object with data (image length):', {
      ...recipeData,
      image: imageData ? `[Base64 data: ${imageData.length} chars]` : null
    });
    
    const recipe = new Recipe(recipeData);
    console.log('Recipe object created, attempting to save...');
    
    const savedRecipe = await recipe.save();
    console.log('Recipe saved successfully:', savedRecipe._id);
    
    // החזרת המתכון עם נתוני המשתמש המעודכנים
    const user = await User.findById(savedRecipe.userId);
    const enrichedRecipe = {
      ...savedRecipe.toObject(),
      userName: user ? user.fullName : 'Unknown User',
      userAvatar: user ? user.avatar : null,
      userBio: user ? user.bio : null
    };
    
    res.status(201).json(enrichedRecipe);
  } catch (error) {
    console.error('=== RECIPE CREATION ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    
    // טיפול בשגיאות validation
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      res.status(400).json({ message: 'Validation error', errors: validationErrors });
    } else if (error.message.includes('too large')) {
      res.status(413).json({ message: 'Image too large - please use a smaller image' });
    } else {
      res.status(500).json({ message: 'Failed to create recipe' });
    }
  }
});

// Get single recipe with user data
app.get('/api/recipes/:id', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid recipe ID' });
    }

    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    // העשרה עם נתוני המשתמש
    const user = await User.findById(recipe.userId);
    const enrichedRecipe = {
      ...recipe.toObject(),
      userName: user ? user.fullName : 'Unknown User',
      userAvatar: user ? user.avatar : null,
      userBio: user ? user.bio : null
    };

    res.json(enrichedRecipe);
  } catch (error) {
    console.error('Get recipe error:', error);
    res.status(500).json({ message: 'Failed to fetch recipe' });
  }
});

app.delete('/api/recipes/:id', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    // בדיקת תקינות ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid recipe ID' });
    }

    const deletedRecipe = await Recipe.findByIdAndDelete(req.params.id);
    if (!deletedRecipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    res.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    console.error('Delete recipe error:', error);
    res.status(500).json({ message: 'Failed to delete recipe' });
  }
});


// Add comment to recipe ✅
  app.post('/api/recipes/:id/comments', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid recipe ID' });
    }

    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    const { text, userId, userName } = req.body;
    
    if (!text || text.trim() === '') {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    // יצירת התגובה החדשה
    const user = await User.findById(userId);

    const newComment = {
      userId: userId,
      userName: userName || user?.fullName || 'Anonymous User',
      userAvatar: user?.avatar || null,
      text: text.trim(),
      createdAt: new Date()
    };

    if (!recipe.comments) recipe.comments = [];
    recipe.comments.push(newComment);
    
    await recipe.save();

    // 🆕 יצירת התראה רק אם זה לא הפוסט של עצמו
    if (recipe.userId !== userId) {
      await createNotification({
        type: 'comment',
        fromUserId: userId,
        toUserId: recipe.userId,
        message: `${user?.fullName || 'Someone'} commented on your recipe "${recipe.title}"`,
        postId: recipe._id,
        postTitle: recipe.title,
        postImage: recipe.image,
        fromUser: {
          name: user?.fullName || 'Unknown User',
          avatar: user?.avatar || null
        }
      });
    }
    
    console.log('Comment added successfully to recipe:', req.params.id);
    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: {
        comment: newComment,
        comments: recipe.comments,
        commentsCount: recipe.comments.length
      }
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Failed to add comment' });
  }
});

// Delete a comment
app.delete('/api/recipes/:id/comments/:commentId', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid recipe ID' });
    }

    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    recipe.comments = recipe.comments.filter(comment => 
      comment._id.toString() !== req.params.commentId
    );
    
    await recipe.save();
    
    res.json({ 
      message: 'Comment deleted successfully',
      commentsCount: recipe.comments.length 
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ message: 'Failed to delete comment' });
  }
});

// Likes
app.post('/api/recipes/:id/like', async (req, res) => {
  try {
    console.log('👍 Liking recipe...');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid recipe ID' });
    }

    const userId = req.body.userId || req.headers['x-user-id'] || 'temp-user-id';
    
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    if (!recipe.likes) recipe.likes = [];
    
    if (recipe.likes.includes(userId)) {
      return res.status(400).json({ message: 'Already liked this recipe' });
    }
    
    recipe.likes.push(userId);
    await recipe.save();

    // 🆕 יצירת התראה רק אם זה לא הפוסט של עצמו
    if (recipe.userId !== userId) {
      const liker = await User.findById(userId);
      await createNotification({
        type: 'like',
        fromUserId: userId,
        toUserId: recipe.userId,
        message: `${liker?.fullName || 'Someone'} liked your recipe "${recipe.title}"`,
        postId: recipe._id,
        postTitle: recipe.title,
        postImage: recipe.image,
        fromUser: {
          name: liker?.fullName || 'Unknown User',
          avatar: liker?.avatar || null
        }
      });
    }
    
    console.log('✅ Recipe liked successfully');
    res.json({ 
      message: 'Recipe liked successfully',
      likes: recipe.likes,
      likesCount: recipe.likes.length 
    });
  } catch (error) {
    console.error('❌ Like recipe error:', error);
    res.status(500).json({ message: 'Failed to like recipe' });
  }
});


app.delete('/api/recipes/:id/like', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid recipe ID' });
    }

    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }
    
    const userId = 'current-user-id'; // זמני
    
    recipe.likes = recipe.likes.filter(id => id !== userId);
    await recipe.save();
    
    res.json({ likesCount: recipe.likes.length });
  } catch (error) {
    console.error('Unlike recipe error:', error);
    res.status(500).json({ message: 'Failed to unlike recipe' });
  }
});

// Test route
app.get('/', (req, res) => {
  res.send('Recipe Social Network API Server is running');
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    mongoConnected: isMongoConnected(),
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});
// ============ PRIVATE CHAT ROUTES ============

// יצירת או קבלת צ'אט פרטי
app.post('/api/chats/private', async (req, res) => {
  try {
    console.log('=== Create/Get Private Chat ===');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { otherUserId } = req.body;
    
    // TODO: בעתיד נוסיף JWT authentication
    // כרגע נשתמש בפתרון זמני
    const currentUserId = req.headers['x-user-id'] || 'temp-user-id';
    
    if (!otherUserId) {
      return res.status(400).json({ message: 'Other user ID is required' });
    }

    if (currentUserId === otherUserId) {
      return res.status(400).json({ message: 'Cannot chat with yourself' });
    }

    console.log(`Looking for chat between ${currentUserId} and ${otherUserId}`);

    // חפש צ'אט קיים
    let chat = await PrivateChat.findOne({
      'participants.userId': { $all: [currentUserId, otherUserId] }
    });

    if (!chat) {
      // קבל פרטי משתמשים
      const currentUser = await User.findById(currentUserId);
      const otherUser = await User.findById(otherUserId);

      if (!otherUser) {
        return res.status(404).json({ message: 'Other user not found' });
      }

      // צור צ'אט חדש
      chat = new PrivateChat({
        participants: [
          {
            userId: currentUserId,
            userName: currentUser ? currentUser.fullName : 'Unknown User',
            userAvatar: currentUser ? currentUser.avatar : null
          },
          {
            userId: otherUserId,
            userName: otherUser.fullName,
            userAvatar: otherUser.avatar
          }
        ],
        unreadCount: new Map([
          [currentUserId, 0],
          [otherUserId, 0]
        ])
      });

      await chat.save();
      console.log('New private chat created:', chat._id);
    } else {
      console.log('Existing chat found:', chat._id);
    }

    res.json(chat);
  } catch (error) {
    console.error('Create/Get private chat error:', error);
    res.status(500).json({ message: 'Failed to create/get private chat' });
  }
});

// קבלת כל הצ'אטים של המשתמש
app.get('/api/chats/my', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    // TODO: בעתיד נוסיף JWT authentication
    const currentUserId = req.headers['x-user-id'] || 'temp-user-id';
    
    console.log('Fetching chats for user:', currentUserId);

    const chats = await PrivateChat.find({
      'participants.userId': currentUserId
    }).sort({ updatedAt: -1 });

    // העשר כל צ'אט עם מידע נוסף
    const enrichedChats = chats.map(chat => {
      const otherParticipant = chat.participants.find(p => p.userId !== currentUserId);
      const unreadCount = chat.unreadCount.get(currentUserId) || 0;

      return {
        ...chat.toObject(),
        unreadCount,
        // הוסף מידע על המשתמש השני ברמה העליונה למען הנוחות
        otherUser: otherParticipant
      };
    });

    console.log(`Found ${enrichedChats.length} chats for user`);
    res.json(enrichedChats);
  } catch (error) {
    console.error('Get my chats error:', error);
    res.status(500).json({ message: 'Failed to fetch chats' });
  }
});

// קבלת הודעות של צ'אט ספציפי
app.get('/api/chats/:chatId/messages', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { chatId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: 'Invalid chat ID' });
    }

    console.log(`Fetching messages for chat ${chatId}, page ${page}`);

    const messages = await Message.find({ chatId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // החזר בסדר הנכון (ישן לחדש)
    const orderedMessages = messages.reverse();
    console.log(`Found ${orderedMessages.length} messages`);
    
    res.json(orderedMessages);
  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

// שליחת הודעה חדשה
app.post('/api/chats/:chatId/messages', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { chatId } = req.params;
    const { content, messageType = 'text' } = req.body;
    
    // TODO: בעתיד נוסיף JWT authentication
    const currentUserId = req.headers['x-user-id'] || 'temp-user-id';

    if (!content || content.trim() === '') {
      return res.status(400).json({ message: 'Message content is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: 'Invalid chat ID' });
    }

    // וודא שהמשתמש חלק מהצ'אט
    const chat = await PrivateChat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    const isParticipant = chat.participants.some(p => p.userId === currentUserId);
    if (!isParticipant) {
      return res.status(403).json({ message: 'Not authorized to send message to this chat' });
    }

    // קבל פרטי השולח
    const sender = await User.findById(currentUserId);
    const senderName = sender ? sender.fullName : 'Unknown User';

    console.log(`Sending message to chat ${chatId} from ${senderName}`);

    // צור הודעה חדשה
    const message = new Message({
      chatId,
      senderId: currentUserId,
      senderName,
      content: content.trim(),
      messageType,
      readBy: [{ userId: currentUserId }] // השולח כבר "קרא" את ההודעה
    });

    await message.save();

    // עדכן את הצ'אט עם ההודעה האחרונה
    chat.lastMessage = {
      senderId: currentUserId,
      content: content.trim(),
      createdAt: message.createdAt
    };

    // עדכן מונה הודעות לא נקראו עבור המשתמש השני
    chat.participants.forEach(participant => {
      if (participant.userId !== currentUserId) {
        const currentCount = chat.unreadCount.get(participant.userId) || 0;
        chat.unreadCount.set(participant.userId, currentCount + 1);
      }
    });

    await chat.save();

    console.log('Message sent successfully:', message._id);
    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Failed to send message' });
  }
});

// סימון הודעות כנקראו
app.put('/api/chats/:chatId/read', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { chatId } = req.params;
    // TODO: בעתיד נוסיף JWT authentication
    const currentUserId = req.headers['x-user-id'] || 'temp-user-id';

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: 'Invalid chat ID' });
    }

    console.log(`Marking messages as read for user ${currentUserId} in chat ${chatId}`);

    // עדכן את מונה ההודעות הלא נקראו בצ'אט
    const chat = await PrivateChat.findById(chatId);
    if (chat) {
      chat.unreadCount.set(currentUserId, 0);
      await chat.save();
    }

    // עדכן את ההודעות כנקראו
    await Message.updateMany(
      { 
        chatId, 
        senderId: { $ne: currentUserId },
        'readBy.userId': { $ne: currentUserId }
      },
      { 
        $push: { 
          readBy: { 
            userId: currentUserId, 
            readAt: new Date() 
          } 
        } 
      }
    );

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ message: 'Failed to mark as read' });
  }
});

// קבלת מספר הודעות לא נקראו
app.get('/api/chats/unread-count', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    // TODO: בעתיד נוסיף JWT authentication
    const currentUserId = req.headers['x-user-id'] || 'temp-user-id';

    const chats = await PrivateChat.find({
      'participants.userId': currentUserId
    });

    let totalUnread = 0;
    chats.forEach(chat => {
      totalUnread += chat.unreadCount.get(currentUserId) || 0;
    });

    console.log(`User ${currentUserId} has ${totalUnread} unread messages`);
    res.json({ count: totalUnread });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ count: 0 });
  }
});

app.get('/api/users/search', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { q } = req.query;
    const currentUserId = req.headers['x-user-id'] || 'temp-user-id';

    if (!q || q.trim() === '') {
      return res.status(400).json({ message: 'Search query is required' });
    }

    console.log(`Searching users with query: ${q}`);

    const users = await User.find({
      _id: { $ne: currentUserId }, // אל תכלול את המשתמש הנוכחי
      $or: [
        { fullName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ]
    }).limit(20).select('_id fullName email avatar bio');

    const searchResults = users.map(user => ({
      userId: user._id,
      userName: user.fullName,
      userEmail: user.email,
      userAvatar: user.avatar,
      userBio: user.bio
    }));

    console.log(`Found ${searchResults.length} users`);
    res.json(searchResults);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Failed to search users' });
  }
});

// ============ GROUP MEMBERS MANAGEMENT ============

// Get group with full member details
app.get('/api/groups/:groupId/members', async (req, res) => {
  try {
    console.log('Fetching group with full member details');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.groupId)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    // בדיקה שהקבוצה קיימת
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // העשרת נתוני החברים עם פרטים מלאים מ-User collection
    const enrichedMembers = await Promise.all(
      group.members.map(async (member) => {
        try {
          const user = await User.findById(member.userId);
          return {
            ...member.toObject(),
            userName: user ? user.fullName : 'Unknown User',
            userEmail: user ? user.email : null,
            userAvatar: user ? user.avatar : null,
            userBio: user ? user.bio : null,
            joinedAt: member.joinedAt || member.createdAt
          };
        } catch (error) {
          console.error('Error enriching member:', member.userId, error);
          return {
            ...member.toObject(),
            userName: 'Unknown User',
            userEmail: null,
            userAvatar: null,
            userBio: null,
            joinedAt: member.joinedAt || member.createdAt
          };
        }
      })
    );

    // מיון החברים - בעלים ואדמינים קודם
    const sortedMembers = enrichedMembers.sort((a, b) => {
      const roleOrder = { owner: 3, admin: 2, member: 1 };
      const aOrder = roleOrder[a.role] || 1;
      const bOrder = roleOrder[b.role] || 1;
      
      if (aOrder !== bOrder) {
        return bOrder - aOrder; // מיון יורד - בעלים קודם
      }
      
      // אם אותו תפקיד, מיין לפי תאריך הצטרפות
      return new Date(a.joinedAt) - new Date(b.joinedAt);
    });

    let creatorInfo = {
      creatorName: 'Unknown User',
      creatorAvatar: null
    };

    try {
      const creator = await User.findById(group.creatorId);
        if (creator) {
          creatorInfo = {
            creatorName: creator.fullName || creator.name || 'Unknown User',
            creatorAvatar: creator.avatar || null
          };
        }
    } catch (error) {
      console.error('Error fetching creator info:', error);
    }

    const enrichedGroup = {
      ...group.toObject(),
      members: sortedMembers,
      ...creatorInfo  // הוסף את מידע היוצר
    };

    console.log('Group with enriched members fetched successfully');
    res.json(enrichedGroup);

  } catch (error) {
    console.error('Get group members error:', error);
    res.status(500).json({ message: 'Failed to fetch group members' });
  }
});

// Update member role (promote/demote)
app.put('/api/groups/:groupId/members/:memberUserId/role', async (req, res) => {
  try {
    console.log('Updating member role');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { groupId, memberUserId } = req.params;
    const { role, adminId } = req.body;

    // בדיקת תקינות
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    if (!['member', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be "member" or "admin"' });
    }

    // בדיקה שהקבוצה קיימת
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // בדיקה שהמבקש הוא יוצר הקבוצה
    const isCreator = group.creatorId === adminId || group.creatorId?.toString() === adminId?.toString();
    if (!isCreator) {
      return res.status(403).json({ message: 'Only the group creator can change member roles' });
    }

    // מציאת החבר
    const memberIndex = group.members.findIndex(member => 
      member.userId === memberUserId || member.userId?.toString() === memberUserId?.toString()
    );
    
    if (memberIndex === -1) {
      return res.status(404).json({ message: 'Member not found in group' });
    }

    const member = group.members[memberIndex];

    // מניעת שינוי תפקיד היוצר
    if (member.role === 'owner') {
      return res.status(403).json({ message: 'Cannot change the role of the group creator' });
    }

    // עדכון התפקיד
    group.members[memberIndex].role = role;
    await group.save();

    // החזרת החבר המעודכן עם נתונים מלאים
    const user = await User.findById(memberUserId);
    const updatedMember = {
      ...group.members[memberIndex].toObject(),
      userName: user ? user.fullName : 'Unknown User',
      userEmail: user ? user.email : null,
      userAvatar: user ? user.avatar : null
    };

    console.log('Member role updated successfully');
    res.json({ 
      message: `Member role updated to ${role}`,
      member: updatedMember
    });

  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({ message: 'Failed to update member role' });
  }
});

// Remove member from group (Enhanced version)
app.delete('/api/groups/:groupId/members/:memberUserId', async (req, res) => {
  try {
    console.log('Removing member from group');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { groupId, memberUserId } = req.params;
    const { adminId } = req.body;

    // בדיקת תקינות IDs
    if (!mongoose.Types.ObjectId.isValid(groupId) || !memberUserId || !adminId) {
      return res.status(400).json({ message: 'Invalid group ID, member ID, or admin ID' });
    }

    // בדיקה שהקבוצה קיימת
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // בדיקה שהמבקש הוא אדמין או יוצר הקבוצה
    const isAdmin = group.members.some(member => 
      (member.userId === adminId || member.userId?.toString() === adminId?.toString()) && 
      (member.role === 'admin' || member.role === 'owner')
    );
    const isCreator = group.creatorId === adminId || group.creatorId?.toString() === adminId?.toString();
    
    if (!isAdmin && !isCreator) {
      return res.status(403).json({ message: 'Only admins can remove members' });
    }

    // בדיקה שהחבר קיים בקבוצה
    const memberIndex = group.members.findIndex(member => 
      member.userId === memberUserId || member.userId?.toString() === memberUserId?.toString()
    );
    
    if (memberIndex === -1) {
      return res.status(404).json({ message: 'Member not found in group' });
    }

    const memberToRemove = group.members[memberIndex];

    // מניעת הסרת היוצר
    if (memberToRemove.role === 'owner' || group.creatorId === memberUserId || group.creatorId?.toString() === memberUserId?.toString()) {
      return res.status(403).json({ message: 'Cannot remove the group creator' });
    }

    // מניעת הסרה עצמית (השתמש ב-leave endpoint במקום)
    if (memberUserId === adminId) {
      return res.status(400).json({ message: 'Use leave group endpoint to remove yourself' });
    }

    // קבלת שם החבר לפני ההסרה
    const user = await User.findById(memberUserId);
    const memberName = user ? user.fullName : 'Unknown User';

    // הסרת החבר מהקבוצה
    group.members.splice(memberIndex, 1);
    group.membersCount = group.members.length;
    
    await group.save();

    console.log('Member removed from group successfully');
    res.json({ 
      message: `${memberName} has been removed from the group`,
      removedMemberId: memberUserId,
      removedMemberName: memberName,
      newMembersCount: group.membersCount
    });

  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ message: 'Failed to remove member' });
  }
});

// ============ תיקון GET GROUP ENDPOINT לכלול נתוני חברים ============

// עדכן את הendpoint הקיים של /api/groups/:groupId להחזיר נתוני חברים מעושרים:
app.get('/api/groups/:groupId', async (req, res) => {
  try {
    console.log('Fetching group details with member info');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.groupId)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    // טען את הקבוצה
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // העשר נתוני חברים עם מידע בסיסי (רק לתצוגה מקדימה)
    const enrichedMembers = await Promise.all(
      (group.members || []).slice(0, 6).map(async (member) => {
        try {
          const user = await User.findById(member.userId);
          return {
            userId: member.userId,
            role: member.role || 'member',
            joinedAt: member.joinedAt || member.createdAt,
            userName: user ? user.fullName : 'Unknown User',
            userAvatar: user ? user.avatar : null
          };
        } catch (error) {
          return {
            userId: member.userId,
            role: member.role || 'member',
            joinedAt: member.joinedAt || member.createdAt,
            userName: 'Unknown User',
            userAvatar: null
          };
        }
      })
    );

    let creatorInfo = {
      creatorName: 'Unknown User',
      creatorAvatar: null
    };

    try {
      const creator = await User.findById(group.creatorId);
      if (creator) {
        creatorInfo = {
          creatorName: creator.fullName || creator.name || 'Unknown User',
          creatorAvatar: creator.avatar || null
        };
      }
    } catch (error) {
      console.error('Error fetching creator info:', error);
    }

    // החזר את הקבוצה עם חברים מעושרים ומידע יוצר
    const enrichedGroup = {
      ...group.toObject(),
      members: enrichedMembers,
      ...creatorInfo  // הוסף את מידע היוצר
    };

    console.log('Group details with member info fetched successfully');
    res.json(enrichedGroup);

  } catch (error) {
    console.error('Get group details error:', error);
    res.status(500).json({ message: 'Failed to fetch group details' });
  }
});

// ============ END CHAT ROUTES ============

// ============ PERSONALIZED FEED ENDPOINTS ============

// Get personalized feed for user
app.get('/api/feed', async (req, res) => {
  try {
    console.log('=== Personalized Feed Request ===');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId, type } = req.query;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    console.log('📥 Building personalized feed for user:', userId, 'type:', type);

    // קבל את המשתמש ורשימת מי שהוא עוקב אחריו
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const following = user.following || [];
    console.log('👥 User follows:', following.length, 'people');

    // 🔧 תיקון קבלת הקבוצות - תמיכה בכל סוגי ה-ID
    const userGroups = await Group.find({
      $or: [
        { 'members.userId': userId },
        { 'members.userId': userId.toString() }
      ]
    }).select('_id name');
    
    const groupIds = userGroups.map(group => group._id);
    console.log('🏠 User is member of:', groupIds.length, 'groups');

    let allPosts = [];

    if (type === 'following') {
      // רק פוסטים של אנשים שאני עוקבת אחריהם + הפוסטים שלי
      console.log('📥 Loading following posts only...');
      
      const followingPosts = await Recipe.find({
        userId: { $in: [...following, userId] }
      }).sort({ createdAt: -1 });
      
      allPosts = followingPosts;
      
    } else if (type === 'groups') {
      // רק פוסטי קבוצות
      console.log('📥 Loading groups posts only...');
      
      const groupPosts = await GroupPost.find({
        groupId: { $in: groupIds },
        isApproved: true
      }).sort({ createdAt: -1 });
      
      allPosts = groupPosts;
      
    } else {
      // פיד מותאם אישית מלא - following + groups + own posts
      console.log('📥 Loading full personalized feed...');

      // 1. פוסטים של אנשים שאני עוקבת אחריהם + הפוסטים שלי
      const followingPosts = await Recipe.find({
        userId: { $in: [...following, userId] }
      }).sort({ createdAt: -1 });

      console.log('📄 Following posts:', followingPosts.length);

      // 2. פוסטי קבוצות מאושרים
      const groupPosts = await GroupPost.find({
        groupId: { $in: groupIds },
        isApproved: true
      }).sort({ createdAt: -1 });

      console.log('🏠 Group posts:', groupPosts.length);

      // שלב את כל הפוסטים
      allPosts = [...followingPosts, ...groupPosts];
    }

    // העשר כל פוסט עם נתוני המשתמש והקבוצה
    const enrichedPosts = await Promise.all(
      allPosts.map(async (post) => {
        try {
          const postUser = await User.findById(post.userId);
          let enrichedPost = {
            ...post.toObject(),
            userName: postUser ? postUser.fullName : 'Unknown User',
            userAvatar: postUser ? postUser.avatar : null,
            userBio: postUser ? postUser.bio : null
          };

          // אם זה פוסט קבוצה, הוסף מידע על הקבוצה
          if (post.groupId) {
            const group = userGroups.find(g => g._id.toString() === post.groupId.toString());
            enrichedPost.groupName = group ? group.name : 'Unknown Group';
            enrichedPost.postSource = 'group';
          } else {
            enrichedPost.postSource = 'personal';
          }

          return enrichedPost;
        } catch (error) {
          console.error('Error enriching post:', post._id, error);
          return {
            ...post.toObject(),
            userName: 'Unknown User',
            userAvatar: null,
            userBio: null,
            postSource: post.groupId ? 'group' : 'personal'
          };
        }
      })
    );

    // מיין את כל הפוסטים לפי תאריך (חדש לישן)
    enrichedPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log(`✅ Returning ${enrichedPosts.length} posts in personalized feed`);
    res.json(enrichedPosts);

  } catch (error) {
    console.error('❌ Get personalized feed error:', error);
    res.status(500).json({ message: 'Failed to fetch personalized feed' });
  }
});

// 🔧 תיקון endpoint הקבוצות
app.get('/api/groups/my-posts', async (req, res) => {
  try {
    console.log('=== User Groups Posts Request ===');
    console.log('📥 Groups my-posts request - userId:', req.query.userId);
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    console.log('📥 Getting group posts for user:', userId);

    // 🔧 תיקון עיקרי - קבל את הקבוצות עם תמיכה בכל סוגי ה-ID
    let userGroups;
    try {
      userGroups = await Group.find({
        $or: [
          { 'members.userId': userId },
          { 'members.userId': userId.toString() }
        ]
      }).select('_id name');
    } catch (error) {
      console.error('Error finding user groups:', error);
      return res.status(500).json({ message: 'Failed to find user groups' });
    }
    
    console.log('🏠 User is member of:', userGroups.length, 'groups');

    if (userGroups.length === 0) {
      console.log('📭 User is not a member of any groups');
      return res.json([]);
    }

    // 🔧 תיקון המרת groupIds - השאר אותם כ-ObjectId
    const groupIds = userGroups.map(group => group._id);
    console.log('📋 Group IDs:', groupIds);

    // קבל פוסטים מאושרים מהקבוצות
    const groupPosts = await GroupPost.find({
      groupId: { $in: groupIds },
      isApproved: true
    }).sort({ createdAt: -1 });

    console.log('📄 Found', groupPosts.length, 'group posts');

    // העשר עם נתוני המשתמש והקבוצה
    const enrichedPosts = await Promise.all(
      groupPosts.map(async (post) => {
        try {
          const postUser = await User.findById(post.userId);
          const group = userGroups.find(g => g._id.toString() === post.groupId.toString());
          
          return {
            ...post.toObject(),
            userName: postUser ? postUser.fullName : 'Unknown User',
            userAvatar: postUser ? postUser.avatar : null,
            userBio: postUser ? postUser.bio : null,
            groupName: group ? group.name : 'Unknown Group',
            postSource: 'group'
          };
        } catch (error) {
          console.error('Error enriching group post:', post._id, error);
          return {
            ...post.toObject(),
            userName: 'Unknown User',
            userAvatar: null,
            userBio: null,
            groupName: 'Unknown Group',
            postSource: 'group'
          };
        }
      })
    );

    console.log(`✅ Returning ${enrichedPosts.length} group posts`);
    res.json(enrichedPosts);

  } catch (error) {
    console.error('❌ Get user groups posts error:', error);
    res.status(500).json({ message: 'Failed to fetch user groups posts' });
  }
});

// Get user's following posts only
app.get('/api/following/posts', async (req, res) => {
  try {
    console.log('=== Following Posts Request ===');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    console.log('📥 Getting following posts for user:', userId);

    // קבל את המשתמש ורשימת מי שהוא עוקב אחריו
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const following = user.following || [];
    console.log('👥 User follows:', following.length, 'people');

    if (following.length === 0) {
      console.log('📭 User is not following anyone');
      return res.json([]);
    }

    // קבל פוסטים של אנשים שהוא עוקב אחריהם + הפוסטים שלו
    const followingPosts = await Recipe.find({
      userId: { $in: [...following, userId] }
    }).sort({ createdAt: -1 });

    console.log('📄 Found', followingPosts.length, 'following posts');

    // העשר עם נתוני המשתמש
    const enrichedPosts = await Promise.all(
      followingPosts.map(async (post) => {
        try {
          const postUser = await User.findById(post.userId);
          
          return {
            ...post.toObject(),
            userName: postUser ? postUser.fullName : 'Unknown User',
            userAvatar: postUser ? postUser.avatar : null,
            userBio: postUser ? postUser.bio : null,
            postSource: 'personal'
          };
        } catch (error) {
          console.error('Error enriching following post:', post._id, error);
          return {
            ...post.toObject(),
            userName: 'Unknown User',
            userAvatar: null,
            userBio: null,
            postSource: 'personal'
          };
        }
      })
    );

    console.log(`✅ Returning ${enrichedPosts.length} following posts`);
    res.json(enrichedPosts);

  } catch (error) {
    console.error('❌ Get following posts error:', error);
    res.status(500).json({ message: 'Failed to fetch following posts' });
  }
});

// ============ תיקון LIKE/UNLIKE ENDPOINTS לתמיכה ב-userId בגוף הבקשה ============

// Like recipe - מעודכן
app.post('/api/recipes/:id/like', async (req, res) => {
  try {
    console.log('👍 Liking recipe...');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid recipe ID' });
    }

    // קבל userId מהגוף או מהheaders (לתאימות לאחור)
    const userId = req.body.userId || req.headers['x-user-id'] || 'temp-user-id';
    
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    if (!recipe.likes) recipe.likes = [];
    
    // בדוק שעוד לא עשה לייק
    if (recipe.likes.includes(userId)) {
      return res.status(400).json({ message: 'Already liked this recipe' });
    }
    
    recipe.likes.push(userId);
    await recipe.save();
    
    console.log('✅ Recipe liked successfully');
    res.json({ 
      message: 'Recipe liked successfully',
      likes: recipe.likes,
      likesCount: recipe.likes.length 
    });
  } catch (error) {
    console.error('❌ Like recipe error:', error);
    res.status(500).json({ message: 'Failed to like recipe' });
  }
});

// Unlike recipe - מעודכן
app.delete('/api/recipes/:id/like', async (req, res) => {
  try {
    console.log('👎 Unliking recipe...');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid recipe ID' });
    }

    // קבל userId מהגוף או מהheaders (לתאימות לאחור)  
    const userId = req.body.userId || req.headers['x-user-id'] || 'temp-user-id';
    
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }
    
    if (!recipe.likes || !recipe.likes.includes(userId)) {
      return res.status(400).json({ message: 'Recipe not liked yet' });
    }
    
    recipe.likes = recipe.likes.filter(id => id !== userId);
    await recipe.save();
    
    console.log('✅ Recipe unliked successfully');
    res.json({ 
      message: 'Recipe unliked successfully',
      likes: recipe.likes,
      likesCount: recipe.likes.length 
    });
  } catch (error) {
    console.error('❌ Unlike recipe error:', error);
    res.status(500).json({ message: 'Failed to unlike recipe' });
  }
});

// ============ UTILITY ENDPOINTS ============

// Get user's feed stats
app.get('/api/feed/stats', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId } = req.query;
    
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Valid user ID is required' });
    }

    // קבל את המשתמש
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const following = user.following || [];
    
    // 🔧 תיקון קבלת הקבוצות גם כאן
    const userGroups = await Group.find({
      $or: [
        { 'members.userId': userId },
        { 'members.userId': userId.toString() }
      ]
    });

    // ספור פוסטים
    const [followingPostsCount, groupPostsCount, ownPostsCount] = await Promise.all([
      Recipe.countDocuments({ userId: { $in: following } }),
      GroupPost.countDocuments({ 
        groupId: { $in: userGroups.map(g => g._id) }, 
        isApproved: true 
      }),
      Recipe.countDocuments({ userId })
    ]);

    const stats = {
      followingCount: following.length,
      groupsCount: userGroups.length,
      followingPostsCount,
      groupPostsCount,
      ownPostsCount,
      totalFeedPosts: followingPostsCount + groupPostsCount + ownPostsCount
    };

    console.log('📊 Feed stats for user:', userId, stats);
    res.json(stats);

  } catch (error) {
    console.error('Get feed stats error:', error);
    res.status(500).json({ message: 'Failed to get feed stats' });
  }
});

// פונקציה למחיקת משתמש - העתק והדבק לשרת שלך

app.delete('/api/auth/delete-account', async (req, res) => {
  console.log('🗑️ === DELETE ACCOUNT REQUEST STARTED ===');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  console.log('Request headers:', req.headers);
  
  try {
    const { userId, password, confirmDelete } = req.body;
    
    console.log('Step 1: Extracting data from request');
    console.log('userId:', userId);
    console.log('confirmDelete:', confirmDelete);

    if (!userId || !confirmDelete) {
      console.log('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId and confirmDelete'
      });
    }

    console.log('Step 2: Trying to import models...');
    
    // בדיקה אם המודלים קיימים
    let User, Recipe, Chat;
    
    try {
      console.log('Importing User model...');
      User = require('./models/User');
      console.log('✅ User model imported successfully');
    } catch (userError) {
      console.error('❌ Failed to import User model:', userError.message);
      return res.status(500).json({
        success: false,
        message: 'Server configuration error: User model not found',
        error: userError.message
      });
    }

    try {
      console.log('Importing Recipe model...');
      Recipe = require('./models/Recipe');
      console.log('✅ Recipe model imported successfully');
    } catch (recipeError) {
      console.warn('⚠️ Recipe model not found:', recipeError.message);
      Recipe = null;
    }

    try {
      console.log('Importing Chat model...');
      Chat = require('./models/Chat');
      console.log('✅ Chat model imported successfully');
    } catch (chatError) {
      console.warn('⚠️ Chat model not found:', chatError.message);
      Chat = null;
    }

    console.log('Step 3: Looking for user in database...');
    
    let user;
    try {
      user = await User.findById(userId);
      console.log('Database query result:', user ? 'User found' : 'User not found');
    } catch (dbError) {
      console.error('❌ Database error while finding user:', dbError.message);
      return res.status(500).json({
        success: false,
        message: 'Database connection error',
        error: dbError.message
      });
    }

    if (!user) {
      console.log('❌ User not found in database');
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('✅ User found, proceeding with deletion...');

    let deletedRecipesCount = 0;
    let deletedChatsCount = 0;

    // מחיקת מתכונים (אם המודל קיים)
    if (Recipe) {
      try {
        console.log('Step 4: Deleting recipes...');
        const recipesResult = await Recipe.deleteMany({ 
          $or: [
            { userId: userId },
            { 'user.id': userId },
            { 'user._id': userId },
            { authorId: userId }
          ]
        });
        deletedRecipesCount = recipesResult.deletedCount || 0;
        console.log(`✅ Deleted ${deletedRecipesCount} recipes`);
      } catch (recipeError) {
        console.warn('⚠️ Error deleting recipes:', recipeError.message);
      }
    } else {
      console.log('⚠️ Skipping recipe deletion (model not available)');
    }

    // מחיקת צ'אטים (אם המודל קיים)
    if (Chat) {
      try {
        console.log('Step 5: Deleting chats...');
        const chatsResult = await Chat.deleteMany({
          $or: [
            { 'participants.userId': userId },
            { 'participants.id': userId },
            { createdBy: userId },
            { members: userId },
            { participants: userId }
          ]
        });
        deletedChatsCount = chatsResult.deletedCount || 0;
        console.log(`✅ Deleted ${deletedChatsCount} chats`);
      } catch (chatError) {
        console.warn('⚠️ Error deleting chats:', chatError.message);
      }
    } else {
      console.log('⚠️ Skipping chat deletion (model not available)');
    }

    // עדכון עוקבים
    try {
      console.log('Step 6: Updating followers/following lists...');
      
      await User.updateMany(
        { followers: userId },
        { $pull: { followers: userId } }
      );
      
      await User.updateMany(
        { following: userId },
        { $pull: { following: userId } }
      );
      
      console.log('✅ Updated followers/following lists');
    } catch (followError) {
      console.warn('⚠️ Error updating followers:', followError.message);
    }

    // הסרת לייקים
    if (Recipe) {
      try {
        console.log('Step 7: Removing likes...');
        await Recipe.updateMany(
          { likes: userId },
          { $pull: { likes: userId } }
        );
        console.log('✅ Removed likes from recipes');
      } catch (likesError) {
        console.warn('⚠️ Error removing likes:', likesError.message);
      }
    }

    // מחיקת קבצים
    try {
      console.log('Step 8: Deleting avatar file...');
      if (user.avatar && user.avatar.includes('uploads/')) {
        const fs = require('fs');
        const path = require('path');
        const avatarPath = path.join(__dirname, user.avatar);
        
        if (fs.existsSync(avatarPath)) {
          fs.unlinkSync(avatarPath);
          console.log('✅ Avatar file deleted');
        } else {
          console.log('⚠️ Avatar file not found on disk');
        }
      } else {
        console.log('⚠️ No avatar to delete');
      }
    } catch (fileError) {
      console.warn('⚠️ Error deleting avatar file:', fileError.message);
    }

    // מחיקת המשתמש
    try {
      console.log('Step 9: Deleting user account...');
      const deletedUser = await User.findByIdAndDelete(userId);
      console.log('✅ User account deleted:', deletedUser ? 'Success' : 'User was already deleted');
    } catch (userDeleteError) {
      console.error('❌ Error deleting user:', userDeleteError.message);
      throw userDeleteError;
    }

    console.log('🎉 Account deletion completed successfully!');

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
      data: {
        deletedRecipes: deletedRecipesCount,
        deletedChats: deletedChatsCount,
        userId: userId,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('❌ === CRITICAL ERROR IN DELETE ACCOUNT ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error during account deletion',
      error: {
        name: error.name,
        message: error.message,
        details: 'Check server console for full error details'
      }
    });
  }
});

// גרסאות פשוטות לendpoints האחרים
app.delete('/api/user/delete', async (req, res) => {
  console.log('🗑️ User delete endpoint called - redirecting to main endpoint');
  
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    const User = require('./models/User');
    const result = await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      data: { deleted: result ? true : false }
    });

  } catch (error) {
    console.error('Error in /api/user/delete:', error.message);
    res.status(500).json({
      success: false,
      message: 'Delete failed: ' + error.message
    });
  }
});

app.delete('/api/auth/delete-user', async (req, res) => {
  console.log('🗑️ Auth delete user endpoint called');
  
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    const User = require('./models/User');
    await User.findByIdAndDelete(userId);

    res.json({ 
      success: true, 
      message: 'User deleted successfully' 
    });

  } catch (error) {
    console.error('Error in /api/auth/delete-user:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Delete failed: ' + error.message 
    });
  }
});

// endpoint לבדיקה
app.get('/api/test-delete', (req, res) => {
  res.json({
    success: true,
    message: 'Delete endpoints are available',
    endpoints: [
      'DELETE /api/auth/delete-account',
      'DELETE /api/user/delete',
      'DELETE /api/auth/delete-user'
    ],
    timestamp: new Date()
  });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`MongoDB status: ${isMongoConnected() ? 'Connected' : 'Disconnected'}`);
});
