const express = require('express');
const User = require('../../models/User');
const router = express.Router();

// Create a product
router.post('/', async (req, res) => {

    let newUser = new User(req.body);
    console.log(req.body)
    try {
        let user = await User.findOne({ name: req.body.name });

      if (user) {
          // User already exists, return a message
          return res.status(400).json({
              status: "error",
              message: "User already registered with this name.",
          });
      }

      // Create a new user
      let newUser = new User(req.body);
      let savedUser = await newUser.save();
      user = await User.findOne({ name:  req.body.name});

      savedUser = await newUser.save();
      res.status(201).json(savedUser);

      //res.status(201).json("User already signed up.");
    } catch (err) {
      console.log(err)
      res.status(400).json(err);
    }
  });


module.exports = router;
