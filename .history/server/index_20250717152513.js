require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const { Server } = require('socket.io');
const http = require('http');

const app = express();

const server = http.createServer(app);
const io = new Server(server);

const upload = multer();

app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' })); 

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Content-Type: ${req.headers['content-type']}`);
  next();
});


// GROUP POST ROUTES

app.post('/api/groups/:groupId/posts', upload.any(), async (req, res) => {
  try {
    console.log('=== Group Post Creation Debug ===');
    console.log('Group ID:', req.params.groupId);
    console.log('MongoDB connected:', isMongoConnected());
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.groupId)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const formData = req.body;
    console.log('Group post data received:', formData);

    const userId = formData.userId;
    const isMember = group.members.some(member => 
      member.userId === userId || 
      member.userId?.toString() === userId?.toString()
    );
    
    console.log('Membership check:', {
      userId,
      isMember,
      membersCount: group.members.length,
      memberUserIds: group.members.map(m => m.userId)
    });
    
    if (!isMember) {
      console.log('User is not a member');
      return res.status(403).json({ message: 'Only group members can post' });
    }

    const allowMemberPosts = group.settings?.allowMemberPosts ?? group.allowMemberPosts ?? true;
    
    console.log(' Post permission check:', {
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
      
      console.log('Admin/Creator check:', { isAdmin, isCreator, creatorId: group.creatorId });
      
      if (!isAdmin && !isCreator) {
        console.log('Only admins can post in this group');
        return res.status(403).json({ message: 'Only admins can post in this group' });
      }
    }

    if (!formData.title || formData.title.trim() === '') {
      return res.status(400).json({ message: 'Recipe title is required' });
    }

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

    const requireApproval = group.settings?.requireApproval ?? group.requireApproval ?? false;
    const isCreator = group.creatorId === userId || group.creatorId?.toString() === userId?.toString();
    const isAdmin = group.members.some(member => 
      (member.userId === userId || member.userId?.toString() === userId?.toString()) && 
      (member.role === 'admin' || member.role === 'owner')
    );

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
      isApproved: autoApprove 
    };

    console.log(' Creating post with approval status:', {
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
    
    console.log('Group post saved successfully:', savedPost._id);

    const user = await User.findById(savedPost.userId);
    const enrichedPost = {
      ...savedPost.toObject(),
      userName: user ? user.fullName : 'Unknown User',
      userAvatar: user ? user.avatar : null,
      userBio: user ? user.bio : null,
      groupName: group.name
    };

    const responseMessage = postData.isApproved 
      ? 'Group post created successfully'
      : 'Group post created and waiting for approval';

    res.status(201).json({
      ...enrichedPost,
      message: responseMessage
    });
    
  } catch (error) {
    res.status(500).json({ message: 'Failed to create group post' });
  }
});

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

    if (group.isPrivate && !isMember) {
      console.log('Access denied to private group, returning empty array');
      return res.json([]);
    }

    let postsQuery = { groupId: req.params.groupId };

    if (isAdmin || isCreator) {
      console.log('Admin/Creator - showing all posts');
    } else if (isMember) {
      postsQuery = {
        groupId: req.params.groupId,
        $or: [
          { isApproved: true },
          { userId: userId, isApproved: false }
        ]
      };
      console.log('Member - showing approved posts + own pending posts');
    } else {
      postsQuery.isApproved = true;
      console.log('Non-member - showing only approved posts');
    }

    const posts = await GroupPost.find(postsQuery).sort({ createdAt: -1 });

    console.log('Posts query result:', {
      totalPosts: posts.length,
      query: postsQuery,
      groupId: req.params.groupId
    });

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
            isPending: !post.isApproved,
            canApprove: (isAdmin || isCreator) && !post.isApproved
          };
        } catch (error) {
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
    res.status(500).json({ message: 'Failed to fetch group posts' });
  }
});

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
    res.status(500).json({ message: 'Failed to delete group post' });
  }
});

//  GROUP POST INTERACTIONS 

app.post('/api/groups/:groupId/posts/:postId/like', async (req, res) => {
  try {
    console.log('Liking group post...');
    
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

    console.log('Group post liked successfully');
    res.json({ 
      message: 'Post liked successfully',
      likes: post.likes,
      likesCount: post.likes.length 
    });

  } catch (error) {
    res.status(500).json({ message: 'Failed to like post' });
  }
});

app.delete('/api/groups/:groupId/posts/:postId/like', async (req, res) => {
  try {
    console.log(' Unliking group post...');
    
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
      return res.status(403).json({ message: 'Only group members can unlike posts' });
    }

    const post = await GroupPost.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.groupId !== groupId) {
      return res.status(400).json({ message: 'Post does not belong to this group' });
    }

    if (!post.likes || !post.likes.includes(userId)) {
      return res.status(400).json({ message: 'Post not liked yet' });
    }

    post.likes = post.likes.filter(id => id !== userId);
    await post.save();

    console.log('Group post unliked successfully');
    res.json({ 
      message: 'Post unliked successfully',
      likes: post.likes,
      likesCount: post.likes.length 
    });

  } catch (error) {
    res.status(500).json({ message: 'Failed to unlike post' });
  }
});

app.post('/api/groups/:groupId/posts/:postId/comments', async (req, res) => {
  try {
    console.log('Adding comment to group post...');
    
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

    console.log('Comment added to group post successfully');
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
    res.status(500).json({ message: 'Failed to add comment' });
  }
});

console.log('Notifications activated for all user actions');

app.delete('/api/groups/:groupId/posts/:postId/comments/:commentId', async (req, res) => {
  try {
    console.log('Deleting comment from group post...');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { groupId, postId, commentId } = req.params;
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
      return res.status(403).json({ message: 'Only group members can delete comments' });
    }

    const post = await GroupPost.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.groupId !== groupId) {
      return res.status(400).json({ message: 'Post does not belong to this group' });
    }

    const commentIndex = post.comments.findIndex(comment => 
      comment._id.toString() === commentId
    );

    if (commentIndex === -1) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const comment = post.comments[commentIndex];

    const isCommentOwner = comment.userId === userId;
    const isGroupAdmin = group.members.some(member => 
      member.userId === userId && member.role === 'admin'
    );
    const isGroupCreator = group.creatorId === userId;

    if (!isCommentOwner && !isGroupAdmin && !isGroupCreator) {
      return res.status(403).json({ message: 'Permission denied' });
    }
    post.comments.splice(commentIndex, 1);
    await post.save();

    console.log('Comment deleted from group post successfully');
    res.json({ 
      message: 'Comment deleted successfully',
      comments: post.comments,
      commentsCount: post.comments.length 
    });

  } catch (error) {
    res.status(500).json({ message: 'Failed to delete comment' });
  }
});

app.get('/api/groups/:groupId/posts/:postId', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { groupId, postId } = req.params;

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

    if (post.groupId !== groupId) {
      return res.status(400).json({ message: 'Post does not belong to this group' });
    }

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
    res.status(500).json({ message: 'Failed to fetch group post' });
  }
});

//  GROUP ROUTES

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
    res.status(500).json({ message: 'Failed to create group' });
  }
});
app.get('/api/groups/search', async (req, res) => {
  try {
    console.log('Groups search request:', req.query);
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { q, userId, includePrivate } = req.query;
    
    if (!q || q.trim() === '') {
      return res.status(400).json({ message: 'Search query is required' });
    }

    console.log(`Searching groups with query: "${q}"`);

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

    if (includePrivate !== 'true') {
      if (userId) {
        searchConditions.$and.push({
          $or: [
            { isPrivate: { $ne: true } },
            { 'members.userId': userId }
          ]
        });
      } else {
        searchConditions.$and.push({ isPrivate: { $ne: true } });
      }
    }

    console.log('Search conditions:', JSON.stringify(searchConditions, null, 2));

    const groups = await Group.find(searchConditions).limit(50).sort({ 
      createdAt: -1 
    });

    console.log(`Found ${groups.length} groups matching search`);

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
          return null;
        }
      })
    );

    const validResults = enrichedGroups.filter(group => group !== null);

    console.log(`Returning ${validResults.length} groups for search query: "${q}"`);
    res.json(validResults);
    
  } catch (error) {
    res.status(500).json({ message: 'Failed to search groups' });
  }
});

app.get('/api/groups', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId } = req.query;
    
    let groups;
    if (userId) {
      groups = await Group.find({
        $or: [
          { isPrivate: false },
          { 'members.userId': userId }
        ]
      }).sort({ createdAt: -1 });
    } else {
      groups = await Group.find({ isPrivate: false }).sort({ createdAt: -1 });
    }

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
    res.status(500).json({ message: 'Failed to fetch groups' });
  }
});

app.get('/api/groups/:id', async (req, res) => {
  try {
    console.log('Get single group request:', req.params.id);
    
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    console.log('Group found:', group.name);

    try {
      const creator = await User.findById(group.creatorId);
      
      let postsCount = 0;
      try {
        postsCount = await GroupPost.countDocuments({ 
          groupId: group._id, 
          isApproved: true 
        });
      } catch (error) {
        console.log('Could not count posts for group:', group._id);
      }
      
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

      console.log('Processing pending requests:', group.pendingRequests?.length || 0);
      
      const pendingRequestsDetails = await Promise.all(
        (group.pendingRequests || []).map(async (request) => {
          try {
            console.log('Fetching user details for request:', request.userId);
            const user = await User.findById(request.userId);
            
            if (!user) {
              console.log('User not found for request:', request.userId);
              return {
                userId: request.userId,
                requestDate: request.createdAt || request.requestDate || new Date(),
                userName: 'Unknown User',
                userAvatar: null,
                userBio: null,
                userEmail: null
              };
            }
            
            console.log('Found user for request:', user.fullName);
            return {
              userId: request.userId,
              requestDate: request.createdAt || request.requestDate || new Date(),
              userName: user.fullName || user.name || 'Unknown User',
              userAvatar: user.avatar,
              userBio: user.bio,
              userEmail: user.email
            };
          } catch (error) {
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

      console.log('Pending requests details processed:', {
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
        pendingRequestsDetails, 
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

      console.log('Group enriched successfully:', {
        name: enrichedGroup.name,
        membersCount: enrichedGroup.membersCount,
        postsCount: enrichedGroup.postsCount,
        pendingRequestsCount: enrichedGroup.pendingRequests.length,
        pendingRequestsWithDetails: enrichedGroup.pendingRequestsDetails.length
      });

      res.json(enrichedGroup);
      
    } catch (enrichError) {
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
        pendingRequestsDetails: [], 
        settings: {},
        allowMemberPosts: true,
        requireApproval: false,
        allowInvites: true,
        createdAt: group.createdAt
      });
    }
    
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch group' });
  }
});

app.post('/api/groups/:groupId/join', async (req, res) => {
  try {
    console.log('Join group request:', req.params.groupId);
    
    if (!mongoose.Types.ObjectId.isValid(req.params.groupId)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    console.log('Group found:', group.name);

    const isMember = group.members.some(member => 
      member.userId === userId || member.userId?.toString() === userId?.toString()
    );

    if (isMember) {
      return res.status(400).json({ message: 'User is already a member of this group' });
    }

    const hasPendingRequest = group.pendingRequests.some(request => 
      request.userId === userId || request.userId?.toString() === userId?.toString()
    );

    if (hasPendingRequest) {
      return res.status(400).json({ message: 'Join request already pending' });
    }

    if (group.isPrivate || group.settings?.requireApproval || group.requireApproval) {
      group.pendingRequests.push({
        userId: userId,
        requestDate: new Date(),
        createdAt: new Date() 
      });

      await group.save();

      console.log('Join request added to pending list');

      res.json({
        message: 'Join request sent successfully',
        status: 'pending',
        groupId: group._id,
        userId: userId
      });

    } else {
      group.members.push({
        userId: userId,
        role: 'member',
        joinedAt: new Date()
      });

      await group.save();

      console.log('User added directly to group (public group)');

      res.json({
        message: 'Joined group successfully',
        status: 'approved',
        groupId: group._id,
        userId: userId
      });
    }

  } catch (error) {
    res.status(500).json({ message: 'Failed to join group' });
  }
});

app.put('/api/groups/:id/requests/:userId', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { action, adminId } = req.body; 
    
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isAdmin = group.members.some(member => 
      member.userId === adminId && member.role === 'admin'
    );
    if (!isAdmin) {
      return res.status(403).json({ message: 'Admin privileges required' });
    }

    const { userId } = req.params;
    
    const requestIndex = group.pendingRequests.findIndex(request => request.userId === userId);
    if (requestIndex === -1) {
      return res.status(404).json({ message: 'Join request not found' });
    }

    group.pendingRequests.splice(requestIndex, 1);

    if (action === 'approve') {
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
    res.status(500).json({ message: 'Failed to handle request' });
  }
});

app.delete('/api/groups/:groupId/members/:memberUserId', async (req, res) => {
  try {
    console.log('Removing member from group');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { groupId, memberUserId } = req.params;
    const { adminId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(groupId) || !memberUserId || !adminId) {
      return res.status(400).json({ message: 'Invalid group ID, member ID, or admin ID' });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isAdmin = group.members.some(member => 
      (member.userId === adminId || member.userId?.toString() === adminId?.toString()) && 
      (member.role === 'admin' || member.role === 'owner')
    );
    const isCreator = group.creatorId === adminId || group.creatorId?.toString() === adminId?.toString();
    
    if (!isAdmin && !isCreator) {
      return res.status(403).json({ message: 'Only admins can remove members' });
    }

    const memberIndex = group.members.findIndex(member => 
      member.userId === memberUserId || member.userId?.toString() === memberUserId?.toString()
    );
    
    if (memberIndex === -1) {
      return res.status(404).json({ message: 'Member not found in group' });
    }

    const memberToRemove = group.members[memberIndex];

    if (memberToRemove.role === 'owner' || group.creatorId === memberUserId || group.creatorId?.toString() === memberUserId?.toString()) {
      return res.status(403).json({ message: 'Cannot remove the group creator' });
    }

    if (memberUserId === adminId) {
      return res.status(400).json({ message: 'Use leave group endpoint to remove yourself' });
    }

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
    res.status(500).json({ message: 'Failed to remove member' });
  }
});

app.delete('/api/groups/:groupId/join', async (req, res) => {
  try {
    console.log('Canceling join request for group:', req.params.groupId);
    
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

    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    console.log('Group found:', group.name);

    const isMember = group.members.some(member => 
      member.userId === userId || member.userId?.toString() === userId?.toString()
    );

    if (isMember) {
      return res.status(400).json({ message: 'User is already a member of this group' });
    }

    const hasPendingRequest = group.pendingRequests.some(request => 
      request.userId === userId || request.userId?.toString() === userId?.toString()
    );

    if (!hasPendingRequest) {
      return res.status(400).json({ message: 'No pending request found for this user' });
    }

    group.pendingRequests = group.pendingRequests.filter(request => 
      request.userId !== userId && request.userId?.toString() !== userId?.toString()
    );

    await group.save();

    console.log('Join request canceled successfully');

    res.json({
      message: 'Join request canceled successfully',
      status: 'canceled',
      groupId: group._id,
      userId: userId
    });

  } catch (error) {
    res.status(500).json({ message: 'Failed to cancel join request' });
  }
});

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
    if (group.creatorId === userId || group.creatorId?.toString() === userId?.toString()) {
      return res.status(400).json({ message: 'Group creator cannot leave the group' });
    }

    group.members = group.members.filter(member => member.userId !== userId && member.userId?.toString() !== userId?.toString());
    await group.save();
    
    res.json({ message: 'Left group successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to leave group' });
  }
});

app.delete('/api/groups/:groupId/leave/:userId', async (req, res) => {
  try {
    console.log('User leaving group');

    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { groupId, userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid group ID or user ID' });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (group.creatorId?.toString() === userId) {
      return res.status(400).json({ message: 'Group creator cannot leave the group' });
    }

    const initialCount = group.members.length;
    group.members = group.members.filter(member =>
      member.userId?.toString() !== userId
    );
    
    if (group.members.length === initialCount) {
      return res.status(404).json({ message: 'User not found in group' });
    }

    group.membersCount = group.members.length;
    await group.save();

    console.log('User left group successfully');
    res.json({ message: 'Left group successfully', userId });

  } catch (error) {
    res.status(500).json({ message: 'Failed to leave group' });
  }
});

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

    console.log('Updating group:', groupId);
    console.log('Updated by:', updatedBy);

    const group = await Group.findById(groupId);
    if (!group) {
      console.log('Group not found:', groupId);
      return res.status(404).json({
        message: 'Group not found'
      });
    }

    console.log('Group found:', group.name);

    const isCreator = group.creatorId === updatedBy || group.creatorId?.toString() === updatedBy?.toString();
    const isAdmin = group.members?.some(member => 
      (member.userId === updatedBy || member.userId?.toString() === updatedBy?.toString()) && 
      (member.role === 'admin' || member.role === 'owner')
    );

    console.log('Permission check:', { isCreator, isAdmin, creatorId: group.creatorId, updatedBy });

    if (!isCreator && !isAdmin) {
      console.log('Permission denied');
      return res.status(403).json({
        message: 'Only group admins can update settings'
      });
    }

    console.log('Permission granted');

    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    if (category) group.category = category;
    if (rules !== undefined) group.rules = rules;
    if (isPrivate !== undefined) group.isPrivate = isPrivate === 'true';

    if (!group.settings) group.settings = {};
    
    if (allowMemberPosts !== undefined) {
      group.settings.allowMemberPosts = allowMemberPosts === 'true';
      group.allowMemberPosts = group.settings.allowMemberPosts; 
    }
    
    if (requireApproval !== undefined) {
      const requireApprovalValue = (isPrivate === 'true') ? (requireApproval === 'true') : false;
      group.settings.requireApproval = requireApprovalValue;
      group.requireApproval = requireApprovalValue; 
    }
    
    if (allowInvites !== undefined) {
      group.settings.allowInvites = allowInvites === 'true';
      group.allowInvites = group.settings.allowInvites; 
    }

    if (req.file) {
      console.log('New image uploaded:', req.file.filename);
      if (group.image) {
        const fs = require('fs');
        const path = require('path');
        const oldImagePath = path.join(__dirname, '..', 'public', group.image);
        if (fs.existsSync(oldImagePath)) {
          try {
            fs.unlinkSync(oldImagePath);
            console.log('Old image deleted');
          } catch (err) {
            console.log('Could not delete old image:', err.message);
          }
        }
      }
      group.image = `/uploads/groups/${req.file.filename}`;
    }

    group.updatedAt = new Date();
    const updatedGroup = await group.save();

    console.log('Group updated successfully');

    res.json({
      message: 'Group updated successfully',
      group: updatedGroup
    });

  } catch (error) {
    res.status(500).json({
      message: 'Failed to update group',
      error: error.message
    });
  }
});

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

    await GroupPost.deleteMany({ groupId: req.params.id });
    
    await Group.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete group' });
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
    res.status(500).json({ message: 'Failed to get profile' });
  }
});

app.delete('/api/recipes/:id', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid recipe ID' });
    }

    const deletedRecipe = await Recipe.findByIdAndDelete(req.params.id);
    if (!deletedRecipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    res.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete recipe' });
  }
});

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => {
      console.log('MongoDB Connection Error:', err);
    });
} else {
  console.log('MONGODB_URI not found - running without database');
}

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

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 100 },
  description: { type: String, maxlength: 500 },
  image: { type: String, maxlength: 10000000 }, 
  creatorId: { type: String, required: true }, 
  isPrivate: { type: Boolean, default: false }, 
  category: { type: String, default: 'General' }, 
  members: [{
    userId: String,
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now }
  }],
  pendingRequests: [{ 
    userId: String,
    requestedAt: { type: Date, default: Date.now }
  }],
  rules: { type: String, maxlength: 1000 }, 
  settings: {
    allowMemberPosts: { type: Boolean, default: true },
    requireApproval: { type: Boolean, default: true },
    allowInvites: { type: Boolean, default: true }
  }
}, { timestamps: true });

const Group = mongoose.model('Group', GroupSchema);

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
  groupId: { type: String, required: true }, 
  likes: [{ type: String }],
  comments: [{
    userId: String,
    userName: String,
    text: String,
    createdAt: { type: Date, default: Date.now }
  }],
  isApproved: { type: Boolean, default: false } 
}, { timestamps: true });

const GroupPost = mongoose.model('GroupPost', GroupPostSchema);
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
const RecipeSchema = new mongoose.Schema({
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
  likes: [{ type: String }],
  comments: [{
    userId: String,
    userName: String, 
    text: String,
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

const Recipe = mongoose.model('Recipe', RecipeSchema);

const NotificationSchema = new mongoose.Schema({
  type: { 
    type: String, 
    required: true,
    enum: ['like', 'comment', 'follow', 'group_post', 'group_join_request', 'group_request_approved']
  },
  fromUserId: { type: String, required: true }, 
  toUserId: { type: String, required: true },   
  message: { type: String, required: true },
  postId: { type: String }, 
  postTitle: { type: String },
  postImage: { type: String },
  groupId: { type: String }, 
  groupName: { type: String },
  read: { type: Boolean, default: false },
  fromUser: {
    name: String,
    avatar: String
  }
}, { timestamps: true });

const Notification = mongoose.model('Notification', NotificationSchema);

//  NOTIFICATION API ENDPOINTS

app.get('/api/notifications', async (req, res) => {
  try {
    console.log('Fetching notifications');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    console.log('Getting notifications for user:', userId);

    const notifications = await Notification.find({ 
      toUserId: userId 
    }).sort({ createdAt: -1 }).limit(50);

    console.log(`Found ${notifications.length} notifications`);
    
    res.json({
      success: true,
      data: notifications
    });

  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
});

app.put('/api/notifications/:notificationId/read', async (req, res) => {
  try {
    console.log('Marking notification as read:', req.params.notificationId);
    
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

    console.log('Notification marked as read');
    res.json({ 
      success: true,
      data: notification 
    });

  } catch (error) {
    res.status(500).json({ message: 'Failed to mark as read' });
  }
});

app.put('/api/notifications/mark-all-read', async (req, res) => {
  try {
    console.log('Marking all notifications as read');
    
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

    console.log('All notifications marked as read');
    res.json({ 
      success: true,
      message: 'All notifications marked as read'
    });

  } catch (error) {
    res.status(500).json({ message: 'Failed to mark all as read' });
  }
});

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
    res.status(500).json({ 
      success: false,
      count: 0
    });
  }
});

const createNotification = async (notificationData) => {
  try {
    if (!isMongoConnected()) {
      console.log('Database not connected, skipping notification');
      return { success: false };
    }

    const notification = new Notification(notificationData);
    await notification.save();
    
    console.log('Notification created:', notification.type);
    return { success: true, data: notification };
  } catch (error) {
    return { success: false };
  }
};

const GroupChatSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 100 },
  description: { type: String, maxlength: 500 },
  image: { type: String, maxlength: 10000000 }, 
  adminId: { type: String, required: true }, 
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
    allowMemberInvites: { type: Boolean, default: false }, 
    allowNameChange: { type: Boolean, default: true }, 
    allowMemberLeave: { type: Boolean, default: true }
  }
}, { timestamps: true });

const GroupChat = mongoose.model('GroupChat', GroupChatSchema);

const GroupChatMessageSchema = new mongoose.Schema({
  groupChatId: { type: String, required: true },
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  senderAvatar: { type: String },
  content: { type: String, required: true },
  messageType: { type: String, default: 'text' }, 
  readBy: [{
    userId: String,
    readAt: { type: Date, default: Date.now }
  }],
  isSystemMessage: { type: Boolean, default: false },
  systemMessageType: { type: String } 
}, { timestamps: true });

const GroupChatMessage = mongoose.model('GroupChatMessage', GroupChatMessageSchema);

//  GROUP CHAT ROUTES 

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

    const creator = await User.findById(creatorId);
    if (!creator) {
      return res.status(404).json({ message: 'Creator not found' });
    }

    const chatParticipants = [{
      userId: creatorId,
      userName: creator.fullName,
      userAvatar: creator.avatar,
      role: 'admin',
      joinedAt: new Date()
    }];

    for (const participantId of participants) {
      if (participantId !== creatorId) { 
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

    console.log('Group chat created successfully:', groupChat._id);
    res.status(201).json(groupChat);

  } catch (error) {
    res.status(500).json({ message: 'Failed to create group chat' });
  }
});

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

    const enrichedChats = groupChats.map(chat => {
      const unreadCount = chat.unreadCount.get(currentUserId) || 0;
      const isAdmin = chat.adminId === currentUserId;

      return {
        ...chat.toObject(),
        unreadCount,
        isAdmin,
        participantsCount: chat.participants.length,
        type: 'group' 
      };
    });

    console.log(`Found ${enrichedChats.length} group chats for user`);
    res.json(enrichedChats);

  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch group chats' });
  }
});

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
    res.status(500).json({ message: 'Failed to fetch group chat' });
  }
});

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

    const orderedMessages = messages.reverse();
    console.log(`Found ${orderedMessages.length} messages`);
    
    res.json(orderedMessages);

  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

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

    const groupChat = await GroupChat.findById(chatId);
    if (!groupChat) {
      return res.status(404).json({ message: 'Group chat not found' });
    }

    const participant = groupChat.participants.find(p => p.userId === currentUserId);
    if (!participant) {
      return res.status(403).json({ message: 'Not authorized to send message to this chat' });
    }

    console.log(`Sending message to group chat ${chatId} from ${participant.userName}`);

    const message = new GroupChatMessage({
      groupChatId: chatId,
      senderId: currentUserId,
      senderName: participant.userName,
      senderAvatar: participant.userAvatar,
      content: content.trim(),
      messageType,
      readBy: [{ userId: currentUserId }] 
    });

    await message.save();

    groupChat.lastMessage = {
      senderId: currentUserId,
      senderName: participant.userName,
      content: content.trim(),
      messageType,
      createdAt: message.createdAt
    };

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
    res.status(500).json({ message: 'Failed to send message' });
  }
});

app.post('/api/group-chats/:chatId/participants', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { chatId } = req.params;
    const { userIds } = req.body; 
    const currentUserId = req.headers['x-user-id'] || 'temp-user-id';

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'User IDs array is required' });
    }

    const groupChat = await GroupChat.findById(chatId);
    if (!groupChat) {
      return res.status(404).json({ message: 'Group chat not found' });
    }

    if (groupChat.adminId !== currentUserId) {
      return res.status(403).json({ message: 'Only admin can add participants' });
    }

    const newParticipants = [];
    const addedUsers = [];

    for (const userId of userIds) {
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
        
        groupChat.unreadCount.set(userId, 0);
      }
    }

    if (newParticipants.length === 0) {
      return res.status(400).json({ message: 'No new participants to add' });
    }

    groupChat.participants.push(...newParticipants);
    await groupChat.save();

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

    console.log(`Added ${newParticipants.length} participants to group chat`);
    res.json({ 
      message: `Added ${newParticipants.length} participants`,
      addedParticipants: newParticipants
    });

  } catch (error) {
    res.status(500).json({ message: 'Failed to add participants' });
  }
});

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

    if (groupChat.adminId !== currentUserId) {
      return res.status(403).json({ message: 'Only admin can remove participants' });
    }

    if (userId === currentUserId) {
      return res.status(400).json({ message: 'Admin cannot remove themselves. Use leave group instead.' });
    }

    const participantIndex = groupChat.participants.findIndex(p => p.userId === userId);
    if (participantIndex === -1) {
      return res.status(404).json({ message: 'Participant not found' });
    }

    const removedParticipant = groupChat.participants[participantIndex];
    
    groupChat.participants.splice(participantIndex, 1);
    groupChat.unreadCount.delete(userId);
    await groupChat.save();

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

    console.log(`Removed participant ${removedParticipant.userName} from group chat`);
    res.json({ 
      message: 'Participant removed successfully',
      removedParticipant: removedParticipant.userName
    });

  } catch (error) {
    res.status(500).json({ message: 'Failed to remove participant' });
  }
});

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

    const participantIndex = groupChat.participants.findIndex(p => p.userId === currentUserId);
    if (participantIndex === -1) {
      return res.status(404).json({ message: 'Not a participant in this chat' });
    }

    const leavingParticipant = groupChat.participants[participantIndex];
    const isAdmin = groupChat.adminId === currentUserId;

    groupChat.participants.splice(participantIndex, 1);
    groupChat.unreadCount.delete(currentUserId);

    if (isAdmin && groupChat.participants.length > 0) {
      const randomIndex = Math.floor(Math.random() * groupChat.participants.length);
      const newAdmin = groupChat.participants[randomIndex];
      
      groupChat.adminId = newAdmin.userId;
      newAdmin.role = 'admin';

      console.log(`Admin left, new admin is: ${newAdmin.userName}`);

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

    if (groupChat.participants.length === 0) {
      await GroupChat.findByIdAndDelete(chatId);
      await GroupChatMessage.deleteMany({ groupChatId: chatId });
      
      console.log('Group chat deleted - no participants left');
      return res.json({ message: 'Left group chat successfully. Group was deleted.' });
    }

    await groupChat.save();

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

    console.log(`User ${leavingParticipant.userName} left group chat`);
    res.json({ message: 'Left group chat successfully' });

  } catch (error) {
    res.status(500).json({ message: 'Failed to leave group chat' });
  }
});

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

    console.log('Updating group chat:', chatId);
    console.log('Requested by:', currentUserId);
    console.log('Update fields:', Object.keys(req.body));

    const groupChat = await GroupChat.findById(chatId);
    if (!groupChat) {
      console.log('Group chat not found');
      return res.status(404).json({ message: 'Group chat not found' });
    }

    const participant = groupChat.participants.find(p => p.userId === currentUserId);
    if (!participant) {
      console.log('User not authorized - not a participant');
      return res.status(403).json({ message: 'Not authorized to modify this chat' });
    }

    const isAdmin = groupChat.adminId === currentUserId;
    console.log('User permissions:', { isAdmin, participantRole: participant.role });

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

    if (name && name.trim() !== groupChat.name) {
      const canChangeName = groupChat.settings.allowNameChange || isAdmin;
      if (!canChangeName) {
        console.log(' Permission denied for name change');
        return res.status(403).json({ message: 'Only admin can change group name when member editing is disabled' });
      }
      groupChat.name = name.trim();
      changes.push(`name changed from "${oldName}" to "${name.trim()}"`);
      console.log('Name updated:', name.trim());
    }

    if (description !== undefined && description !== groupChat.description) {
      const canChangeDescription = groupChat.settings.allowNameChange || isAdmin;
      if (!canChangeDescription) {
        console.log('Permission denied for description change');
        return res.status(403).json({ message: 'Only admin can change group description when member editing is disabled' });
      }
      groupChat.description = description;
      changes.push('description updated');
      console.log('Description updated');
    }

    if (image !== undefined && image !== groupChat.image) {
      const canChangeImage = groupChat.settings.allowImageChange !== false || isAdmin;
      if (!canChangeImage) {
        console.log('Permission denied for image change');
        return res.status(403).json({ message: 'Only admin can change group image when member editing is disabled' });
      }
      groupChat.image = image;
      changes.push(image ? 'image updated' : 'image removed');
      console.log('Image updated:', image ? 'new image set' : 'image removed');
    }

    if (allowNameChange !== undefined && isAdmin) {
      groupChat.settings.allowNameChange = allowNameChange;
      changes.push(`member name editing ${allowNameChange ? 'enabled' : 'disabled'}`);
      console.log('allowNameChange updated:', allowNameChange);
    }

    if (allowImageChange !== undefined && isAdmin) {
      groupChat.settings.allowImageChange = allowImageChange;
      changes.push(`member image editing ${allowImageChange ? 'enabled' : 'disabled'}`);
      console.log('allowImageChange updated:', allowImageChange);
    }

    if (allowMemberInvites !== undefined && isAdmin) {
      groupChat.settings.allowMemberInvites = allowMemberInvites;
      changes.push(`member invites ${allowMemberInvites ? 'enabled' : 'disabled'}`);
      console.log('allowMemberInvites updated:', allowMemberInvites);
    }

    if (changes.length === 0) {
      console.log('No changes to apply');
      return res.status(400).json({ message: 'No changes provided' });
    }

    await groupChat.save();
    console.log('Group chat saved successfully');

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
      console.log('System message created');
    } catch (msgError) {
      console.warn('Failed to create system message:', msgError.message);
    }

    console.log(`Group chat updated successfully: ${changes.join(', ')}`);
    
    res.json({ 
      message: 'Group chat updated successfully',
      changes,
      groupChat: {
        ...groupChat.toObject(),
        participantsCount: groupChat.participants.length
      }
    });

  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to update group chat',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

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

    const groupChat = await GroupChat.findById(chatId);
    if (groupChat) {
      groupChat.unreadCount.set(currentUserId, 0);
      await groupChat.save();
    }

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
    res.status(500).json({ message: 'Failed to mark as read' });
  }
});

//  PRIVATE CHAT ROUTES 

app.post('/api/chats/private', async (req, res) => {
  try {
    console.log('=== Create/Get Private Chat ===');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { otherUserId } = req.body;
    
    const currentUserId = req.headers['x-user-id'] || 'temp-user-id';
    
    if (!otherUserId) {
      return res.status(400).json({ message: 'Other user ID is required' });
    }

    if (currentUserId === otherUserId) {
      return res.status(400).json({ message: 'Cannot chat with yourself' });
    }

    console.log(`Looking for chat between ${currentUserId} and ${otherUserId}`);

    let chat = await PrivateChat.findOne({
      'participants.userId': { $all: [currentUserId, otherUserId] }
    });

    if (!chat) {
      const currentUser = await User.findById(currentUserId);
      const otherUser = await User.findById(otherUserId);

      if (!otherUser) {
        return res.status(404).json({ message: 'Other user not found' });
      }

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
    res.status(500).json({ message: 'Failed to create/get private chat' });
  }
});

app.get('/api/chats/my', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const currentUserId = req.headers['x-user-id'] || 'temp-user-id';
    
    console.log('Fetching chats for user:', currentUserId);

    const chats = await PrivateChat.find({
      'participants.userId': currentUserId
    }).sort({ updatedAt: -1 });

    const enrichedChats = chats.map(chat => {
      const otherParticipant = chat.participants.find(p => p.userId !== currentUserId);
      const unreadCount = chat.unreadCount.get(currentUserId) || 0;

      return {
        ...chat.toObject(),
        unreadCount,
        otherUser: otherParticipant
      };
    });

    console.log(`Found ${enrichedChats.length} chats for user`);
    res.json(enrichedChats);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch chats' });
  }
});

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

    const orderedMessages = messages.reverse();
    console.log(`Found ${orderedMessages.length} messages`);
    
    res.json(orderedMessages);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

app.post('/api/chats/:chatId/messages', async (req, res) => {
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

    const chat = await PrivateChat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    const isParticipant = chat.participants.some(p => p.userId === currentUserId);
    if (!isParticipant) {
      return res.status(403).json({ message: 'Not authorized to send message to this chat' });
    }

    const sender = await User.findById(currentUserId);
    const senderName = sender ? sender.fullName : 'Unknown User';

    console.log(`Sending message to chat ${chatId} from ${senderName}`);

    const message = new Message({
      chatId,
      senderId: currentUserId,
      senderName,
      content: content.trim(),
      messageType,
      readBy: [{ userId: currentUserId }] 
    });

    await message.save();

    chat.lastMessage = {
      senderId: currentUserId,
      content: content.trim(),
      createdAt: message.createdAt
    };

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
    res.status(500).json({ message: 'Failed to send message' });
  }
});
// ========== SOCKET.IO HANDLERS ==========

io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);
  
  // ========== PRIVATE CHAT HANDLERS ==========
  
  // הצטרפות לצ'אט פרטי
  socket.on('join_chat', (chatId) => {
    socket.join(chatId);
    console.log(`👥 User joined chat: ${chatId}`);
  });

  // עזיבת צ'אט פרטי
  socket.on('leave_chat', (chatId) => {
    socket.leave(chatId);
    console.log(`🚪 User left chat: ${chatId}`);
  });

  // טעינת הודעות צ'אט פרטי
  socket.on('load_messages', async (chatId) => {
    try {
      if (!isMongoConnected()) {
        socket.emit('error', { message: 'Database not available' });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(chatId)) {
        socket.emit('error', { message: 'Invalid chat ID' });
        return;
      }

      const messages = await Message.find({ chatId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      const orderedMessages = messages.reverse();
      socket.emit('messages_loaded', { chatId, messages: orderedMessages });
      console.log(`📤 Sent ${orderedMessages.length} messages to client`);
    } catch (error) {
      console.error('Error loading messages:', error);
      socket.emit('error', { message: 'Failed to load messages' });
    }
  });
  // הוסף בuseEffect של הצ'אט הפרטי
     const socket = chatService.getSocket();
     if (socket) {
     socket.on('message_received', (newMessage) => {
     console.log('📨 Real-time message received:', newMessage);
     if (newMessage.chatId === chatId) {
      setMessages(prevMessages => [...prevMessages, newMessage]);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  });
}

  // שליחת הודעה פרטית
  socket.on('send_message', async (data, callback) => {
    try {
      if (!isMongoConnected()) {
        callback({ success: false, message: 'Database not available' });
        return;
      }

      const { chatId, content, messageType = 'text', senderId } = data;

      if (!content || content.trim() === '') {
        callback({ success: false, message: 'Message content is required' });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(chatId)) {
        callback({ success: false, message: 'Invalid chat ID' });
        return;
      }

      const chat = await PrivateChat.findById(chatId);
      if (!chat) {
        callback({ success: false, message: 'Chat not found' });
        return;
      }

      const isParticipant = chat.participants.some(p => p.userId === senderId);
      if (!isParticipant) {
        callback({ success: false, message: 'Not authorized' });
        return;
      }

      const sender = await User.findById(senderId);
      const senderName = sender ? sender.fullName : 'Unknown User';

      console.log(`📤 Sending message to chat ${chatId} from ${senderName}`);

      const message = new Message({
        chatId,
        senderId,
        senderName,
        content: content.trim(),
        messageType,
        readBy: [{ userId: senderId }]
      });

      await message.save();

      // עדכון הצ'אט
      chat.lastMessage = {
        senderId,
        content: content.trim(),
        createdAt: message.createdAt
      };

      chat.participants.forEach(participant => {
        if (participant.userId !== senderId) {
          const currentCount = chat.unreadCount.get(participant.userId) || 0;
          chat.unreadCount.set(participant.userId, currentCount + 1);
        }
      });

      await chat.save();

      // שלח לכל המשתתפים בצ'אט
      io.to(chatId).emit('message_received', message);
      callback({ success: true, data: message });
      console.log('✅ Message sent successfully:', message._id);
    } catch (error) {
      console.error('Socket send_message error:', error);
      callback({ success: false, message: 'Failed to send message' });
    }
  });

  // סימון צ'אט פרטי כנקרא
  socket.on('mark_as_read', async (data) => {
    try {
      const { chatId, userId } = data;
      
      if (!mongoose.Types.ObjectId.isValid(chatId)) {
        return;
      }

      const chat = await PrivateChat.findById(chatId);
      if (chat) {
        chat.unreadCount.set(userId, 0);
        await chat.save();
        
        io.to(chatId).emit('messages_marked_read', { chatId, userId });
        console.log(`👁️ Messages marked as read for user ${userId}`);
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  });

  // התחלת הקלדה בצ'אט פרטי
  socket.on('start_typing', (data) => {
    const { chatId, userId } = data;
    socket.to(chatId).emit('typing_started', { chatId, userId });
    console.log(`⌨️ User ${userId} started typing`);
  });

  // עצירת הקלדה בצ'אט פרטי
  socket.on('stop_typing', (data) => {
    const { chatId, userId } = data;
    socket.to(chatId).emit('typing_stopped', { chatId, userId });
    console.log(`⌨️ User ${userId} stopped typing`);
  });

  // ========== GROUP CHAT HANDLERS ==========

  // הצטרפות לצ'אט קבוצתי
  socket.on('join_group_chat', (chatId) => {
    socket.join(chatId);
    console.log(`👥 User joined group chat: ${chatId}`);
  });

  // עזיבת צ'אט קבוצתי
  socket.on('leave_group_chat', (chatId) => {
    socket.leave(chatId);
    console.log(`🚪 User left group chat: ${chatId}`);
  });

  // טעינת הודעות צ'אט קבוצתי
  socket.on('load_group_messages', async (chatId) => {
    try {
      if (!isMongoConnected()) {
        socket.emit('error', { message: 'Database not available' });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(chatId)) {
        socket.emit('error', { message: 'Invalid chat ID' });
        return;
      }

      const messages = await GroupChatMessage.find({ groupChatId: chatId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      const orderedMessages = messages.reverse();
      socket.emit('group_messages_loaded', { chatId, messages: orderedMessages });
      console.log(`📤 Sent ${orderedMessages.length} group messages to client`);
    } catch (error) {
      console.error('Error loading group messages:', error);
      socket.emit('error', { message: 'Failed to load group messages' });
    }
  });

  // שליחת הודעה קבוצתית
  socket.on('send_group_message', async (data, callback) => {
    try {
      if (!isMongoConnected()) {
        callback({ success: false, message: 'Database not available' });
        return;
      }

      const { chatId, content, messageType = 'text', senderId } = data;

      if (!content || content.trim() === '') {
        callback({ success: false, message: 'Message content is required' });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(chatId)) {
        callback({ success: false, message: 'Invalid chat ID' });
        return;
      }

      const groupChat = await GroupChat.findById(chatId);
      if (!groupChat) {
        callback({ success: false, message: 'Group chat not found' });
        return;
      }

      const participant = groupChat.participants.find(p => p.userId === senderId);
      if (!participant) {
        callback({ success: false, message: 'Not authorized' });
        return;
      }

      console.log(`📤 Sending group message to chat ${chatId} from ${participant.userName}`);

      const message = new GroupChatMessage({
        groupChatId: chatId,
        senderId,
        senderName: participant.userName,
        senderAvatar: participant.userAvatar,
        content: content.trim(),
        messageType,
        readBy: [{ userId: senderId }]
      });

      await message.save();

      // עדכון הצ'אט הקבוצתי
      groupChat.lastMessage = {
        senderId,
        senderName: participant.userName,
        content: content.trim(),
        messageType,
        createdAt: message.createdAt
      };

      groupChat.participants.forEach(p => {
        if (p.userId !== senderId) {
          const currentCount = groupChat.unreadCount.get(p.userId) || 0;
          groupChat.unreadCount.set(p.userId, currentCount + 1);
        }
      });

      await groupChat.save();

      // שלח לכל המשתתפים בצ'אט הקבוצתי
      io.to(chatId).emit('group_message_received', message);
      callback({ success: true, data: message });
      console.log('✅ Group message sent successfully:', message._id);
    } catch (error) {
      console.error('Socket send_group_message error:', error);
      callback({ success: false, message: 'Failed to send group message' });
    }
  });

  // סימון צ'אט קבוצתי כנקרא
  socket.on('mark_group_as_read', async (data) => {
    try {
      const { chatId, userId } = data;
      
      if (!mongoose.Types.ObjectId.isValid(chatId)) {
        return;
      }

      const groupChat = await GroupChat.findById(chatId);
      if (groupChat) {
        groupChat.unreadCount.set(userId, 0);
        await groupChat.save();
        
        io.to(chatId).emit('group_messages_marked_read', { chatId, userId });
        console.log(`👁️ Group messages marked as read for user ${userId}`);
      }
    } catch (error) {
      console.error('Error marking group as read:', error);
    }
  });

  // התחלת הקלדה בצ'אט קבוצתי
  socket.on('start_group_typing', (data) => {
    const { chatId, userId, userName } = data;
    socket.to(chatId).emit('group_typing_started', { chatId, userId, userName });
    console.log(`⌨️ User ${userName} started typing in group chat ${chatId}`);
  });

  // עצירת הקלדה בצ'אט קבוצתי
  socket.on('stop_group_typing', (data) => {
    const { chatId, userId } = data;
    socket.to(chatId).emit('group_typing_stopped', { chatId, userId });
    console.log(`⌨️ User ${userId} stopped typing in group chat ${chatId}`);
  });

  // ========== DISCONNECT ==========

  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
  });
});




app.put('/api/chats/:chatId/read', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { chatId } = req.params;
    const currentUserId = req.headers['x-user-id'] || 'temp-user-id';

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: 'Invalid chat ID' });
    }

    console.log(`Marking messages as read for user ${currentUserId} in chat ${chatId}`);

    const chat = await PrivateChat.findById(chatId);
    if (chat) {
      chat.unreadCount.set(currentUserId, 0);
      await chat.save();
    }

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
    res.status(500).json({ message: 'Failed to mark as read' });
  }
});

app.get('/api/chats/unread-count', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

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
      _id: { $ne: currentUserId }, 
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
    res.status(500).json({ message: 'Failed to search users' });
  }
});




app.get('/api/group-chats/available-users', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const currentUserId = req.headers['x-user-id'] || 'temp-user-id';
    const { chatId } = req.query; 

    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const following = currentUser.following || [];

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

    const availableUserIds = [...new Set([...following, ...Array.from(chatPartners)])];

    let excludedUsers = [currentUserId]; 
    
    if (chatId && mongoose.Types.ObjectId.isValid(chatId)) {
      const existingChat = await GroupChat.findById(chatId);
      if (existingChat) {
        excludedUsers.push(...existingChat.participants.map(p => p.userId));
      }
    }

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
            return null;
          }
        })
    );

    const validUsers = availableUsers.filter(user => user !== null);

    validUsers.sort((a, b) => a.userName.localeCompare(b.userName));

    console.log(`Found ${validUsers.length} available users for invitation`);
    res.json(validUsers);

  } catch (error) {
    res.status(500).json({ message: 'Failed to get available users' });
  }
});

console.log('Group Chat endpoints added successfully');

const isMongoConnected = () => {
  return mongoose.connection.readyState === 1;
};

app.post('/api/auth/register', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { fullName, email, password } = req.body;
    
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
    res.status(500).json({ message: 'Login failed' });
  }
});

app.post('/api/auth/forgotpassword', async (req, res) => {
  res.json({ message: 'Password reset instructions sent' });
});

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

    if (!req.file.mimetype.startsWith('image/')) {
      console.log('ERROR: File is not an image');
      return res.status(400).json({ error: 'Only image files are allowed' });
    }

    if (req.file.size > 5 * 1024 * 1024) {
      console.log('ERROR: File too large');
      return res.status(413).json({ error: 'Image too large - maximum 5MB allowed' });
    }

    const base64Image = req.file.buffer.toString('base64');
    const imageData = `data:${req.file.mimetype};base64,${base64Image}`;
    
    console.log('Avatar converted to base64, length:', imageData.length);
    
    res.json({
      success: true,
      url: imageData, 
      filename: req.file.originalname
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

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
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

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
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

//  FOLLOW SYSTEM 
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

    console.log('User followed successfully');
    res.json({ 
      message: 'User followed successfully',
      followersCount: userToFollow.followers.length,
      followingCount: follower.following.length
    });

  } catch (error) {
    res.status(500).json({ message: 'Failed to follow user' });
  }
});

app.delete('/api/users/:userId/follow', async (req, res) => {
  try {
    console.log(' Unfollowing user...');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId } = req.params; 
    const { followerId } = req.body; 

    if (!mongoose.Types.ObjectId.isValid(userId) || !followerId) {
      return res.status(400).json({ message: 'Invalid user ID or follower ID' });
    }

    const [userToUnfollow, follower] = await Promise.all([
      User.findById(userId),
      User.findById(followerId)
    ]);

    if (!userToUnfollow || !follower) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!userToUnfollow.followers || !userToUnfollow.followers.includes(followerId)) {
      return res.status(400).json({ message: 'Not following this user' });
    }

    userToUnfollow.followers = userToUnfollow.followers.filter(id => id !== followerId);
    follower.following = follower.following ? follower.following.filter(id => id !== userId) : [];

    await Promise.all([
      userToUnfollow.save(),
      follower.save()
    ]);

    console.log('User unfollowed successfully');
    res.json({ 
      message: 'User unfollowed successfully',
      followersCount: userToUnfollow.followers.length,
      followingCount: follower.following.length
    });

  } catch (error) {
    res.status(500).json({ message: 'Failed to unfollow user' });
  }
});

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
    res.status(500).json({ message: 'Failed to get follow status' });
  }
});

//  EDIT POST ENDPOINTS 
app.put('/api/recipes/:id', upload.any(), async (req, res) => {
  try {
    console.log('Editing recipe...');
    console.log('Recipe ID:', req.params.id);
    console.log('Form data:', req.body);
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { id } = req.params;
    const formData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('Invalid recipe ID:', id);
      return res.status(400).json({ message: 'Invalid recipe ID' });
    }

    const recipe = await Recipe.findById(id);
    if (!recipe) {
      console.log('Recipe not found:', id);
      return res.status(404).json({ message: 'Recipe not found' });
    }

    console.log('Found recipe:', recipe.title);
    console.log('Recipe owner:', recipe.userId);
    console.log('Editor user:', formData.userId);

    if (recipe.userId.toString() !== formData.userId.toString()) {
      console.log('Permission denied - user mismatch');
      return res.status(403).json({ message: 'Permission denied' });
    }

    let imageData = recipe.image; 

    if (req.files && req.files.length > 0) {
      const imageFile = req.files.find(file => 
        file.fieldname === 'image' || 
        file.mimetype.startsWith('image/')
      );
      
      if (imageFile) {
        console.log('New image uploaded, size:', imageFile.size);
        const base64Image = imageFile.buffer.toString('base64');
        imageData = `data:${imageFile.mimetype};base64,${base64Image}`;
      }
    } else if (formData.image && formData.image !== recipe.image) {
      console.log('Image updated from form data');
      imageData = formData.image;
    }

    if (!formData.title || formData.title.trim().length === 0) {
      return res.status(400).json({ message: 'Title is required' });
    }

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

    console.log('Updating recipe with data:', {
      title: updateData.title,
      category: updateData.category,
      prepTime: updateData.prepTime,
      servings: updateData.servings
    });

    const updatedRecipe = await Recipe.findByIdAndUpdate(id, updateData, { 
      new: true,
      runValidators: true 
    });
    
    if (!updatedRecipe) {
      console.log('Failed to update recipe');
      return res.status(500).json({ message: 'Failed to update recipe' });
    }

    const user = await User.findById(updatedRecipe.userId);
    const enrichedRecipe = {
      ...updatedRecipe.toObject(),
      userName: user ? user.fullName : 'Unknown User',
      userAvatar: user ? user.avatar : null,
      userBio: user ? user.bio : null
    };

    console.log('Recipe edited successfully:', enrichedRecipe.title);
    res.json({
      success: true,
      data: enrichedRecipe,
      message: 'Recipe updated successfully'
    });

  } catch (error) {
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

app.put('/api/groups/:groupId/posts/:postId', upload.any(), async (req, res) => {
  try {
    console.log('Editing group post...');
    console.log('Group ID:', req.params.groupId);
    console.log('Post ID:', req.params.postId);
    console.log('Form data:', req.body);
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { groupId, postId } = req.params;
    const formData = req.body;

    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(postId)) {
      console.log('Invalid IDs - Group:', groupId, 'Post:', postId);
      return res.status(400).json({ message: 'Invalid group or post ID' });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      console.log('Group not found:', groupId);
      return res.status(404).json({ message: 'Group not found' });
    }

    const post = await GroupPost.findById(postId);
    if (!post) {
      console.log('Post not found:', postId);
      return res.status(404).json({ message: 'Post not found' });
    }

    console.log('Found post:', post.title);
    console.log('Post group:', post.groupId);
    console.log('Post owner:', post.userId);
    console.log('Editor user:', formData.userId);

    if (post.groupId.toString() !== groupId.toString()) {
      console.log('Post does not belong to group');
      return res.status(400).json({ message: 'Post does not belong to this group' });
    }

    const isPostOwner = post.userId.toString() === formData.userId.toString();
    const isGroupAdmin = group.members.some(member => 
      member.userId.toString() === formData.userId.toString() && member.role === 'admin'
    );
    const isGroupCreator = group.creatorId.toString() === formData.userId.toString();

    console.log('Permissions check:', {
      isPostOwner,
      isGroupAdmin,
      isGroupCreator
    });

    if (!isPostOwner && !isGroupAdmin && !isGroupCreator) {
      console.log('Permission denied');
      return res.status(403).json({ message: 'Permission denied' });
    }

    let imageData = post.image; 
    
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

    if (!formData.title || formData.title.trim().length === 0) {
      return res.status(400).json({ message: 'Title is required' });
    }

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

    console.log('Updating group post with data:', {
      title: updateData.title,
      category: updateData.category,
      prepTime: updateData.prepTime,
      servings: updateData.servings
    });

    const updatedPost = await GroupPost.findByIdAndUpdate(postId, updateData, { 
      new: true,
      runValidators: true 
    });
    
    if (!updatedPost) {
      console.log('Failed to update group post');
      return res.status(500).json({ message: 'Failed to update group post' });
    }

    const user = await User.findById(updatedPost.userId);
    const enrichedPost = {
      ...updatedPost.toObject(),
      userName: user ? user.fullName : 'Unknown User',
      userAvatar: user ? user.avatar : null,
      userBio: user ? user.bio : null,
      groupName: group.name
    };

    console.log('Group post edited successfully:', enrichedPost.title);
    res.json({
      success: true,
      data: enrichedPost,
      message: 'Group post updated successfully'
    });

  } catch (error) {
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

const updateUserProfile = async (req, res) => {
  try {
    console.log('=== Profile Update Debug ===');
    console.log('Request body:', req.body);
    console.log('MongoDB connected:', isMongoConnected());
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId, id, fullName, email, avatar, bio } = req.body;
    const userIdToUse = userId || id; 
    
    if (!userIdToUse) {
      console.log('ERROR: No user ID provided');
      return res.status(400).json({ message: 'User ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(userIdToUse)) {
      console.log('ERROR: Invalid user ID:', userIdToUse);
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(userIdToUse);
    if (!user) {
      console.log('ERROR: User not found:', userIdToUse);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('Found user:', user.email);

    if (fullName !== undefined) user.fullName = fullName;
    if (email !== undefined) user.email = email;
    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar; 

    console.log('Updating user profile:', {
      userId: userIdToUse,
      fullName,
      email,
      bio,
      hasAvatar: !!avatar,
      avatarLength: avatar ? avatar.length : 0
    });

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

app.put('/api/user/profile', updateUserProfile);
app.patch('/api/user/profile', updateUserProfile);
app.put('/api/auth/profile', updateUserProfile);
app.patch('/api/auth/profile', updateUserProfile);
app.put('/api/auth/update-profile', updateUserProfile);
app.patch('/api/auth/update-profile', updateUserProfile);

app.put('/api/auth/change-password', async (req, res) => {
  try {
    console.log('=== Change Password Debug ===');
    console.log('Request body:', { userId: req.body.userId, hasCurrentPassword: !!req.body.currentPassword, hasNewPassword: !!req.body.newPassword });
    
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

    console.log('Found user:', user.email);

    if (user.password !== currentPassword) {
      console.log('Current password does not match');
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
    
    console.log('Password updated successfully for user:', user.email);

    res.json({
      message: 'Password changed successfully'
    });
    
  } catch (error) {
    res.status(500).json({ message: 'Failed to change password' });
  }
});

app.patch('/api/auth/change-password', async (req, res) => {
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
    res.status(500).json({ message: 'Failed to change password' });
  }
});

app.put('/api/user/change-password', async (req, res) => {
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
    res.status(500).json({ message: 'Failed to get profile' });
  }
});

app.get('/api/recipes', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const recipes = await Recipe.find().sort({ createdAt: -1 });
    
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
    res.status(500).json({ message: 'Failed to fetch recipes' });
  }
});

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

    const formData = req.body;
    
    if (!formData.title || formData.title.trim() === '') {
      console.log('ERROR: Recipe title is missing, received:', formData.title);
      return res.status(400).json({ message: 'Recipe title is required' });
    }
    
    console.log('Title validation passed:', formData.title);
    
    let imageData = null;
    if (req.files && req.files.length > 0) {
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
        
        const base64Image = imageFile.buffer.toString('base64');
        imageData = `data:${imageFile.mimetype};base64,${base64Image}`;
        console.log('Image converted to base64, length:', imageData.length);
      }
    }
    
    if (!imageData && formData.image) {
      imageData = formData.image;
      console.log('Using image data from form field');
    }
    
    const recipeData = {
      title: formData.title.trim(),
      description: formData.description || '',
      ingredients: formData.ingredients || '',
      instructions: formData.instructions || '',
      category: formData.category || 'General',
      meatType: formData.meatType || 'Mixed',
      prepTime: parseInt(formData.prepTime) || 0,
      servings: parseInt(formData.servings) || 1,
      image: imageData, 
      userId: formData.userId || 'anonymous', 
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
    
    const user = await User.findById(savedRecipe.userId);
    const enrichedRecipe = {
      ...savedRecipe.toObject(),
      userName: user ? user.fullName : 'Unknown User',
      userAvatar: user ? user.avatar : null,
      userBio: user ? user.bio : null
    };
    
    res.status(201).json(enrichedRecipe);
  } catch (error) {
    
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

    const user = await User.findById(recipe.userId);
    const enrichedRecipe = {
      ...recipe.toObject(),
      userName: user ? user.fullName : 'Unknown User',
      userAvatar: user ? user.avatar : null,
      userBio: user ? user.bio : null
    };

    res.json(enrichedRecipe);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch recipe' });
  }
});

app.delete('/api/recipes/:id', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid recipe ID' });
    }

    const deletedRecipe = await Recipe.findByIdAndDelete(req.params.id);
    if (!deletedRecipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    res.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete recipe' });
  }
});


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
    res.status(500).json({ message: 'Failed to add comment' });
  }
});

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
    res.status(500).json({ message: 'Failed to delete comment' });
  }
});

app.post('/api/recipes/:id/like', async (req, res) => {
  try {
    console.log('Liking recipe...');
    
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
    
    console.log('Recipe liked successfully');
    res.json({ 
      message: 'Recipe liked successfully',
      likes: recipe.likes,
      likesCount: recipe.likes.length 
    });
  } catch (error) {
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
    
    const userId = 'current-user-id'; 
    
    recipe.likes = recipe.likes.filter(id => id !== userId);
    await recipe.save();
    
    res.json({ likesCount: recipe.likes.length });
  } catch (error) {
    res.status(500).json({ message: 'Failed to unlike recipe' });
  }
});

app.get('/', (req, res) => {
  res.send('Recipe Social Network API Server is running');
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    mongoConnected: isMongoConnected(),
    timestamp: new Date().toISOString()
  });
});

app.use((error, req, res, next) => {
  res.status(500).json({ message: 'Something went wrong!' });
});

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});


//  GROUP MEMBERS MANAGEMENT 

app.get('/api/groups/:groupId/members', async (req, res) => {
  try {
    console.log('Fetching group with full member details');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.groupId)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

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

    const sortedMembers = enrichedMembers.sort((a, b) => {
      const roleOrder = { owner: 3, admin: 2, member: 1 };
      const aOrder = roleOrder[a.role] || 1;
      const bOrder = roleOrder[b.role] || 1;
      
      if (aOrder !== bOrder) {
        return bOrder - aOrder; 
      }
      
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
    }

    const enrichedGroup = {
      ...group.toObject(),
      members: sortedMembers,
      ...creatorInfo  
    };

    console.log('Group with enriched members fetched successfully');
    res.json(enrichedGroup);

  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch group members' });
  }
});

app.put('/api/groups/:groupId/members/:memberUserId/role', async (req, res) => {
  try {
    console.log('Updating member role');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { groupId, memberUserId } = req.params;
    const { role, adminId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    if (!['member', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be "member" or "admin"' });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isCreator = group.creatorId === adminId || group.creatorId?.toString() === adminId?.toString();
    if (!isCreator) {
      return res.status(403).json({ message: 'Only the group creator can change member roles' });
    }

    const memberIndex = group.members.findIndex(member => 
      member.userId === memberUserId || member.userId?.toString() === memberUserId?.toString()
    );
    
    if (memberIndex === -1) {
      return res.status(404).json({ message: 'Member not found in group' });
    }

    const member = group.members[memberIndex];

    if (member.role === 'owner') {
      return res.status(403).json({ message: 'Cannot change the role of the group creator' });
    }

    group.members[memberIndex].role = role;
    await group.save();

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
    res.status(500).json({ message: 'Failed to update member role' });
  }
});

app.delete('/api/groups/:groupId/members/:memberUserId', async (req, res) => {
  try {
    console.log('Removing member from group');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { groupId, memberUserId } = req.params;
    const { adminId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(groupId) || !memberUserId || !adminId) {
      return res.status(400).json({ message: 'Invalid group ID, member ID, or admin ID' });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isAdmin = group.members.some(member => 
      (member.userId === adminId || member.userId?.toString() === adminId?.toString()) && 
      (member.role === 'admin' || member.role === 'owner')
    );
    const isCreator = group.creatorId === adminId || group.creatorId?.toString() === adminId?.toString();
    
    if (!isAdmin && !isCreator) {
      return res.status(403).json({ message: 'Only admins can remove members' });
    }

    const memberIndex = group.members.findIndex(member => 
      member.userId === memberUserId || member.userId?.toString() === memberUserId?.toString()
    );
    
    if (memberIndex === -1) {
      return res.status(404).json({ message: 'Member not found in group' });
    }

    const memberToRemove = group.members[memberIndex];

    if (memberToRemove.role === 'owner' || group.creatorId === memberUserId || group.creatorId?.toString() === memberUserId?.toString()) {
      return res.status(403).json({ message: 'Cannot remove the group creator' });
    }

    if (memberUserId === adminId) {
      return res.status(400).json({ message: 'Use leave group endpoint to remove yourself' });
    }

    const user = await User.findById(memberUserId);
    const memberName = user ? user.fullName : 'Unknown User';

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
    res.status(500).json({ message: 'Failed to remove member' });
  }
});


app.get('/api/groups/:groupId', async (req, res) => {
  try {
    console.log('Fetching group details with member info');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.groupId)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

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
    }

    const enrichedGroup = {
      ...group.toObject(),
      members: enrichedMembers,
      ...creatorInfo  
    };

    console.log('Group details with member info fetched successfully');
    res.json(enrichedGroup);

  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch group details' });
  }
});

//  PERSONALIZED FEED ENDPOINTS

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

    console.log('Building personalized feed for user:', userId, 'type:', type);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const following = user.following || [];
    console.log('User follows:', following.length, 'people');

    const userGroups = await Group.find({
      $or: [
        { 'members.userId': userId },
        { 'members.userId': userId.toString() }
      ]
    }).select('_id name');
    
    const groupIds = userGroups.map(group => group._id);
    console.log('User is member of:', groupIds.length, 'groups');

    let allPosts = [];

    if (type === 'following') {
      console.log('Loading following posts only...');
      
      const followingPosts = await Recipe.find({
        userId: { $in: [...following, userId] }
      }).sort({ createdAt: -1 });
      
      allPosts = followingPosts;
      
    } else if (type === 'groups') {
      console.log('Loading groups posts only...');
      
      const groupPosts = await GroupPost.find({
        groupId: { $in: groupIds },
        isApproved: true
      }).sort({ createdAt: -1 });
      
      allPosts = groupPosts;
      
    } else {
      console.log('Loading full personalized feed...');

      const followingPosts = await Recipe.find({
        userId: { $in: [...following, userId] }
      }).sort({ createdAt: -1 });

      console.log('Following posts:', followingPosts.length);

      const groupPosts = await GroupPost.find({
        groupId: { $in: groupIds },
        isApproved: true
      }).sort({ createdAt: -1 });

      console.log('Group posts:', groupPosts.length);

      allPosts = [...followingPosts, ...groupPosts];
    }

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

          if (post.groupId) {
            const group = userGroups.find(g => g._id.toString() === post.groupId.toString());
            enrichedPost.groupName = group ? group.name : 'Unknown Group';
            enrichedPost.postSource = 'group';
          } else {
            enrichedPost.postSource = 'personal';
          }

          return enrichedPost;
        } catch (error) {
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

    enrichedPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log(`Returning ${enrichedPosts.length} posts in personalized feed`);
    res.json(enrichedPosts);

  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch personalized feed' });
  }
});

app.get('/api/groups/my-posts', async (req, res) => {
  try {
    console.log('=== User Groups Posts Request ===');
    console.log('Groups my-posts request - userId:', req.query.userId);
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    console.log('Getting group posts for user:', userId);

    let userGroups;
    try {
      userGroups = await Group.find({
        $or: [
          { 'members.userId': userId },
          { 'members.userId': userId.toString() }
        ]
      }).select('_id name');
    } catch (error) {
      return res.status(500).json({ message: 'Failed to find user groups' });
    }
    
    console.log('User is member of:', userGroups.length, 'groups');

    if (userGroups.length === 0) {
      console.log('User is not a member of any groups');
      return res.json([]);
    }

    const groupIds = userGroups.map(group => group._id);
    console.log('Group IDs:', groupIds);

    const groupPosts = await GroupPost.find({
      groupId: { $in: groupIds },
      isApproved: true
    }).sort({ createdAt: -1 });

    console.log('Found', groupPosts.length, 'group posts');

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

    console.log(`Returning ${enrichedPosts.length} group posts`);
    res.json(enrichedPosts);

  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch user groups posts' });
  }
});

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

    console.log('Getting following posts for user:', userId);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const following = user.following || [];
    console.log('User follows:', following.length, 'people');

    if (following.length === 0) {
      console.log('User is not following anyone');
      return res.json([]);
    }

    const followingPosts = await Recipe.find({
      userId: { $in: [...following, userId] }
    }).sort({ createdAt: -1 });

    console.log('Found', followingPosts.length, 'following posts');

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

    console.log(`Returning ${enrichedPosts.length} following posts`);
    res.json(enrichedPosts);

  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch following posts' });
  }
});

app.post('/api/recipes/:id/like', async (req, res) => {
  try {
    console.log('Liking recipe...');
    
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
    
    console.log('Recipe liked successfully');
    res.json({ 
      message: 'Recipe liked successfully',
      likes: recipe.likes,
      likesCount: recipe.likes.length 
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to like recipe' });
  }
});

app.delete('/api/recipes/:id/like', async (req, res) => {
  try {
    console.log('Unliking recipe...');
    
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
    
    if (!recipe.likes || !recipe.likes.includes(userId)) {
      return res.status(400).json({ message: 'Recipe not liked yet' });
    }
    
    recipe.likes = recipe.likes.filter(id => id !== userId);
    await recipe.save();
    
    console.log('Recipe unliked successfully');
    res.json({ 
      message: 'Recipe unliked successfully',
      likes: recipe.likes,
      likesCount: recipe.likes.length 
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to unlike recipe' });
  }
});


app.get('/api/feed/stats', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId } = req.query;
    
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Valid user ID is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const following = user.following || [];
    
    const userGroups = await Group.find({
      $or: [
        { 'members.userId': userId },
        { 'members.userId': userId.toString() }
      ]
    });

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

    console.log('Feed stats for user:', userId, stats);
    res.json(stats);

  } catch (error) {
    res.status(500).json({ message: 'Failed to get feed stats' });
  }
});

app.delete('/api/auth/delete-account', async (req, res) => {
  try {
    console.log('Starting user account deletion');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ 
        success: false, 
        message: 'Database not available' 
      });
    }

    const { userId, password, confirmDelete } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }

    if (!password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password is required to delete account' 
      });
    }

    if (!confirmDelete) {
      return res.status(400).json({ 
        success: false, 
        message: 'Account deletion must be confirmed' 
      });
    }

    console.log('Finding user to delete:', userId);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    console.log('Verifying password');

    const isPasswordValid = (password.trim() === user.password.trim());

    if (!isPasswordValid) {
      console.log('Invalid password - blocking deletion');
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid password. Please enter your correct password to delete your account.' 
      });
    }

    console.log('Password verified successfully, proceeding with deletion');

    console.log('Handling regular groups where user is creator');
    
    const createdGroups = await Group.find({ creatorId: userId });
    console.log(`Found ${createdGroups.length} groups where user is creator`);

    for (const group of createdGroups) {
      console.log(`Processing group: ${group.name} (${group._id})`);
      
      const otherMembers = group.members.filter(member => 
        member.userId !== userId && member.userId?.toString() !== userId?.toString()
      );
      
      if (otherMembers.length === 0) {
        console.log(`No other members, deleting group: ${group.name}`);
        
        await GroupPost.deleteMany({ groupId: group._id });
        await Group.findByIdAndDelete(group._id);
        
        console.log(`Group ${group.name} deleted completely`);
      } else {
        const randomIndex = Math.floor(Math.random() * otherMembers.length);
        const newCreator = otherMembers[randomIndex];
        
        console.log(`Transferring group ownership to: ${newCreator.userId}`);
        
        group.creatorId = newCreator.userId;
        
        const memberIndex = group.members.findIndex(member => 
          member.userId === newCreator.userId || member.userId?.toString() === newCreator.userId?.toString()
        );
        
        if (memberIndex !== -1) {
          group.members[memberIndex].role = 'admin';
        }
        
        group.members = group.members.filter(member => 
          member.userId !== userId && member.userId?.toString() !== userId?.toString()
        );
        
        if (group.pendingRequests) {
          group.pendingRequests = group.pendingRequests.filter(request => 
            request.userId !== userId && request.userId?.toString() !== userId?.toString()
          );
        }
        
        await group.save();
        
        console.log(`Group ownership transferred successfully for: ${group.name}`);
      }
    }

    console.log('Removing user from other groups');
    
    await Group.updateMany(
      { 
        creatorId: { $ne: userId },
        'members.userId': userId 
      },
      { 
        $pull: { 
          members: { userId: userId },
          pendingRequests: { userId: userId }
        } 
      }
    );

    console.log('Handling group chats where user is admin');
    
    const adminGroups = await GroupChat.find({ adminId: userId });
    console.log(`Found ${adminGroups.length} group chats where user is admin`);

    for (const group of adminGroups) {
      console.log(`Processing group chat: ${group.name} (${group._id})`);
      
      const otherParticipants = group.participants.filter(p => p.userId !== userId);
      
      if (otherParticipants.length === 0) {
        console.log(`No other participants, deleting group chat: ${group.name}`);
        
        await GroupChatMessage.deleteMany({ groupChatId: group._id });
        await GroupChat.findByIdAndDelete(group._id);
        
        console.log(`Group chat ${group.name} deleted completely`);
      } else {
        const randomIndex = Math.floor(Math.random() * otherParticipants.length);
        const newAdmin = otherParticipants[randomIndex];
        
        console.log(`Transferring group chat admin to: ${newAdmin.userName} (${newAdmin.userId})`);
        
        group.adminId = newAdmin.userId;
        
        const adminParticipantIndex = group.participants.findIndex(p => p.userId === newAdmin.userId);
        if (adminParticipantIndex !== -1) {
          group.participants[adminParticipantIndex].role = 'admin';
        }
        
        group.participants = group.participants.filter(p => p.userId !== userId);
        
        if (group.unreadCount) {
          group.unreadCount.delete(userId);
        }
        
        await group.save();
        
        const systemMessage = new GroupChatMessage({
          groupChatId: group._id,
          senderId: 'system',
          senderName: 'System',
          content: `${user.fullName} left the group. ${newAdmin.userName} is now the group admin.`,
          messageType: 'system',
          isSystemMessage: true,
          systemMessageType: 'admin_changed',
          readBy: group.participants.map(p => ({ userId: p.userId }))
        });
        
        await systemMessage.save();
        
        console.log(`Group chat admin transferred successfully for: ${group.name}`);
      }
    }

    console.log('Handling group chats where user is a member');
    
    const memberGroups = await GroupChat.find({ 
      'participants.userId': userId,
      adminId: { $ne: userId } 
    });
    
    console.log(`Found ${memberGroups.length} group chats where user is a member`);

    for (const group of memberGroups) {
      console.log(`Removing user from group chat: ${group.name}`);
      
      group.participants = group.participants.filter(p => p.userId !== userId);
      
      if (group.unreadCount) {
        group.unreadCount.delete(userId);
      }
      
      await group.save();
      
      const systemMessage = new GroupChatMessage({
        groupChatId: group._id,
        senderId: 'system',
        senderName: 'System',
        content: `${user.fullName} left the group.`,
        messageType: 'system',
        isSystemMessage: true,
        systemMessageType: 'user_left',
        readBy: group.participants.map(p => ({ userId: p.userId }))
      });
      
      await systemMessage.save();
      
      console.log(`User removed from group chat: ${group.name}`);
    }

    console.log('Handling private chats');
    
    const privateChats = await PrivateChat.find({ 'participants.userId': userId });
    console.log(`Found ${privateChats.length} private chats`);

    for (const chat of privateChats) {
      await Message.deleteMany({ chatId: chat._id });
      await PrivateChat.findByIdAndDelete(chat._id);
    }

    console.log('Private chats cleaned up');

    console.log('Handling user posts and other content');
    
    await Recipe.deleteMany({ userId: userId });
    
    await GroupPost.deleteMany({ userId: userId });

    await Notification.deleteMany({ 
      $or: [
        { fromUserId: userId },
        { toUserId: userId }
      ]
    });

    console.log('Posts, group posts, and notifications cleaned up');

    console.log('Deleting user account');
    await User.findByIdAndDelete(userId);

    console.log('User account deletion completed successfully');

    res.json({
      success: true,
      message: 'Account deleted successfully. Groups have been transferred to other members or deleted if empty.'
    });

  } catch (error) {
    console.error('Delete user account error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while deleting the account'
    });
  }
});

app.delete('/api/user/delete', async (req, res) => {
  console.log('User delete endpoint called - redirecting to main endpoint');
  
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      data: { deleted: true, userId }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Delete failed: ' + error.message
    });
  }
});

app.delete('/api/auth/delete-user', async (req, res) => {
  console.log('Auth delete user endpoint called');
  
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await User.findByIdAndDelete(userId);

    res.json({ 
      success: true, 
      message: 'User deleted successfully',
      data: { userId }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Delete failed: ' + error.message 
    });
  }
});

app.get('/api/test-delete', (req, res) => {
  res.json({
    success: true,
    message: 'Delete endpoints are available',
    endpoints: [
      'DELETE /api/auth/delete-account',
      'DELETE /api/user/delete', 
      'DELETE /api/auth/delete-user'
    ],
    modelsAvailable: {
      User: !!User,
      Recipe: !!Recipe,
      Group: !!Group,
      GroupPost: !!GroupPost,
      PrivateChat: !!PrivateChat,
      Message: !!Message,
      GroupChat: !!GroupChat,
      GroupChatMessage: !!GroupChatMessage,
      Notification: !!Notification
    },
    timestamp: new Date()
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`MongoDB status: ${isMongoConnected() ? 'Connected' : 'Disconnected'}`);
});
