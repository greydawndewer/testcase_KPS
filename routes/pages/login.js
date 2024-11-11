const express = require('express');
const User = require('../../models/User');
const router = express.Router();
  
router.get('/', async (req, res) => {
    console.log(req.body);
    const { name, password} = req.query;
    
    try {
        const user = await User.findOne({ name: name });
        console.log(user);
        if (user && user.password === password){
          res.json(user);
        } else {
          // User already exists, return a message
          return res.status(400).json({
              status: "error",
              message: "User already registered with this name.",
          });
        }
    } catch (err) {
      res.status(500).json(err);
    }
  });
  
module.exports = router;
