const express = require('express');
const Product = require('../models/Produce/Product');
const Prod = require('../models/Produce/Producers');
const User = require('../models/User');
const router = express.Router();

// Create a product
router.post('/', async (req, res) => {
      try {
          // Find the user by the provided username
          let user = await User.findOne({ "name": req.query.uname });
          console.log("BOO")
          if (!user) {
              return res.status(404).json({
                  status: "error",
                  message: "User not found.",
              });
          }
          
          let p = await Prod.findOne({ "company.name": req.query.img });
          if (!p) {
              return res.status(404).json({
                  status: "error",
                  message: "Company not found.",
              });
          }
  
  
          // Check if a company with this name exists in the Producer collection
          let company = await Product.findOne({ 'productName': req.query.name });
          if (!company) {
              // If the company doesn't exist, create a new one
              company = new Product({
                productName: req.query.name,
                productType: req.query.type,
                producerName: req.query.uname,
                images: req.query.img,
                categories: req.query.cats,
                description: req.query.des,
                price: req.query.price,
                stock: {
                    amount: req.query.amt
                }
              });
              console.log("BOO")
              await company.save();
          } else {
              return res.status(400).json({
                  status: "error",
                  message: "Producer already registered.",
              });
          }
  
          // Link the producer to the user by setting the producer field to the company ID
          p.company.products.push(company); // Assuming product._id is available after saving the product
          await p.save();
          user.producer = user.producer.filter(d => d.toString() !== p._id.toString());
          user.producer.push(p);
          await user.save();
          console.log("BOO")
          res.status(201).json({ message: "Producer created and linked to user.", user });
          
      } catch (err) {
          console.log(err);
          res.status(500).json({ error: err.message });
      }
  });
  
  // Read all products
router.get('/', async (req, res) => {
    try {
        const username = req.query.name;
        const com = req.query.com;
  
        // Find the user by the provided username and populate the producer field
        const user = await User.findOne({ "name": username }).populate('producer');
        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User not found.",
            });
        }
        let p = await Prod.findOne({ "company.name": com });
        if (!p) {
            return res.status(404).json({
                status: "error",
                message: "Company not found.",
            });
        }
  
        // Extract companies from the populated producer field
          const matchedProducers = user.producer.filter(d => d.toString() === p._id.toString());
          const products = matchedProducers.length > 0 ? matchedProducers[0].company.products : [];
          // Return the list of companies associated with the user
          console.log(products)
          res.status(200).json(products);
      } catch (err) {
          console.log(err);
          res.status(500).json({ error: err.message });
      }
});
router.delete('/', async (req, res) => {
    try {
        const product = req.query.name;
        let idd;
        // Find the product by ID and remove it
        let x = await Product.findOne({ 'productName': product });
        if (!x) {
            return res.status(404).json({
                status: "error",
                message: "Product not found.",
            });
        }
        idd = x._id.toString();
        const prod = await Product.findOneAndDelete(product);
        if (!prod) {
            return res.status(404).json({
                status: "error",
                message: "Product not found.",
            });
        }

        // Find the producer associated with the product
        const producer = await Prod.findOne({ "company.products": prod });
        if (producer) {
            // Remove the product from the producer's product list
            producer.company.products = producer.company.products.filter(prodId => prodId.toString() !== idd.toString());
            await producer.save();
        }

        // Find the user associated with the producer
        const user = await User.findOne({ "producer": producer._id });
        if (user) {
            // Update the user's producer list if necessary
            user.producer = user.producer.filter(prod => prod.toString() !== producer._id.toString());
            await user.save();
        }

        res.status(204).send(); // No content to send back
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: err.message });
    }
});
  /*
  // Update a product
  router.put('/:id', async (req, res) => {
    try {
      const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
      res.json(updatedProduct);
    } catch (err) {
      res.status(400).json(err);
    }
  });
  
  // Delete a product
  router.delete('/:id', async (req, res) => {
    try {
      await Product.findByIdAndDelete(req.params.id);
      res.status(204).send();
    } catch (err) {
      res.status(400).json(err);
    }
  });*/

module.exports = router;
