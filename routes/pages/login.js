const express = require('express');
const User = require('../../model/User');
const router = express.Router();
  
router.get('/', async (req, res) => {
    console.log("yo");
    const { name, password} = req.query;
    
    try {
      const user = await User.findOne({ name: name });
      console.log(user);
      if (user && user.password === password){
        res.json(user);
      }  
    } catch (err) {
      res.status(500).json(err);
    }
  });
  
module.exports = router;
