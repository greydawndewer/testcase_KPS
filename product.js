const express = require('express');
const Product = require('../models/Produce/Product');
const router = express.Router();

// Create a product
router.post('/', async (req, res) => {
    const newProduct = new Product(req.body);
    try {
      const savedProduct = await newProduct.save();
      res.status(201).json(savedProduct);
    } catch (err) {
      res.status(400).json(err);
    }
  });
  
  // Read all products
  router.get('/', async (req, res) => {
    try {
      const products = await Product.find();
      res.json(products);
    } catch (err) {
      res.status(500).json(err);
    }
  });
  
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
  });

module.exports = router;
