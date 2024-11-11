const express = require('express');
const User = require('../../models/User');
const Producer = require('../../models/Produce/Producers');
const router = express.Router();

// Create or link a Producer to a User
router.post('/', async (req, res) => {
  console.log("BOO")
    try {
        // Find the user by the provided username

        let user = await User.findOne({ 'name': req.body.uname });
        console.log(req.body.uname)
        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User not found.",
            });
        }

        // Check if a company with this name exists in the Producer collection
        let company = await Producer.findOne({ 'company.name': req.body.name });
        console.log(company)
        if (!company) {
            // If the company doesn't exist, create a new one
            console.log("BOO")
            company = new Producer({
                company: {
                    name: req.body.name,
                    products: req.body.products || []
                }    
            });
            console.log("BOO")
            await company.save();
        } else {
            return res.status(400).json({
                status: "error",
                message: "Company already registered with this name.",
            });
        }

        // Link the producer to the user by setting the producer field to the company ID
        user.producer.push(company);
        await user.save();
        console.log("BOO")
        res.status(201).json({ message: "Producer created and linked to user.", user });
        
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/', async (req, res) => {
    try {
      const username = req.body.username;

      // Find the user by the provided username and populate the producer field
      const user = await User.findOne({ name: username }).populate('producer');
      if (!user) {
          return res.status(404).json({
              status: "error",
              message: "User not found.",
          });
      }

      // Extract companies from the populated producer field
      const companies = user.producer.flatMap(producer => producer.company);

        // Return the list of companies associated with the user
        console.log(user.producer)
        console.log(companies)
        res.status(200).json(companies);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
