const express = require('express');
const User = require('../../model/User');
const router = express.Router();

// Create a product
router.post('/', async (req, res) => {
    const newUser = new User(req.body);
    try {
      const savedUser = await newUser.save();
      res.status(201).json(savedUser);
    } catch (err) {
      res.status(400).json(err);
    }
  });
  
 
module.exports = router;
