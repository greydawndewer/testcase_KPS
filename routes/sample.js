const express = require('express');
//const User = require('../../models/User');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        console.log(req.body);
        res.send("YOO");
    } catch (err) {
      res.status(500).json(err);
    }
  });

module.exports = router;