const express = require('express');
const Product = require('../models/Produce/Product');
const Prod = require('../models/Produce/Producers');
const Order = require('../models/Produce/Orders');
const User = require('../models/User');
const router = express.Router();

// Create a product
router.post('/', async (req, res) => {
      try {
          // Find the user by the provided username
          const com = req.query.com;
          const product = req.query.name;
          const consumername = req.query.conname;
          let p = await Prod.findOne({ "company.name": com });
          console.log(p)
          if (!p) {
              return res.status(404).json({
                  status: "error",
                  message: "Company not found.",
              });
          }
          
          let x = await Product.findOne({ 'productName': product });
          if (!x) {
              return res.status(404).json({
                  status: "error",
                  message: "Product not found.",
              });
          }
          let cuser = await User.findOne({ "name": consumername });
          console.log("BOO");
          if (!cuser) {
              return res.status(404).json({
                  status: "error",
                  message: "Consumer  not found.",
              });
          }
          let user = await User.findOne({ "name": x.producerName.toString() });
          console.log("BOO");
          if (!user) {
              return res.status(404).json({
                  status: "error",
                  message: "Producer  not found.",
              });
          }
          console.log(p._id.toString())
          // Find the matched producers
          let matchedProducers = user.producer.filter(d => d.toString() == p._id.toString());
          console.log(matchedProducers)
          // Check if there are any matched producers
          if (matchedProducers.length > 0) {
              let matchedProd = p.company.products.filter(d => d.toString() === x._id.toString());
          
              // Check if the desired product was found
              if (matchedProd.length > 0) {
                  // matchedProd contains the desired product
                  console.log("Desired product found:", matchedProd);
              } else {
                    return res.status(404).json({
                        status: "error",
                        message: "Product not found.",
                    });
              }
          } else {
                return res.status(404).json({
                    status: "error",
                    message: "Company not found.",
                });
          }  
          const latestOrder = await Order.findOne().sort({ orderId: -1 });
          const newOrderId = latestOrder ? (parseInt(latestOrder.orderId) + 1).toString() : 1;
  
          // Create a new order object
          const newOrder = new Order({
              orderId: newOrderId,
              orderType: req.query.orderType || 'item', // Default to 'item' if not provided
              consumerName: consumername,
              product: x._id.toString(), // Reference to the product
              dateOfOrder: new Date().toISOString(), // Current date in ISO format
              status: 'pending', // Default status
              quantity: req.query.qty,
              totalPrice: (parseInt(req.query.qty) * parseInt(x.price.toString())).toString()
          });
  
          // Save the new order to the database
          await newOrder.save();
  
          res.status(201).json({
              status: "success",
              message: "Order created successfully.",
              order: newOrder
          });      
      } catch (err) {
          console.log(err);
          res.status(500).json({ error: err.message });
      }
  });
  
  // Read all products
router.get('/', async (req, res) => {
    try {
        const com = req.query.com;
        const product = req.query.name;
        let user = await User.findOne({ "name": req.query.conname });
        console.log("BOO");
        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User  not found.",
            });
        }
        
        let p = await Prod.findOne({ "company.name": com });
        if (!p) {
            return res.status(404).json({
                status: "error",
                message: "Company not found.",
            });
        }
        
        let x = await Product.findOne({ 'productName': product });
        if (!x) {
            return res.status(404).json({
                status: "error",
                message: "Product not found.",
            });
        }
        
        // Find the matched producers
        const matchedProducers = user.producer.filter(d => d.toString() === p._id.toString());
        
        // Check if there are any matched producers
        if (matchedProducers.length > 0) {
            // Access the first matched producer
            const matchedProducer = matchedProducers[0];
        
            // Now filter the products of the matched producer
            const matchedProd = matchedProducer.company.products.filter(d => d.toString() === x._id.toString());
        
            // Check if the desired product was found
            if (matchedProd.length > 0) {
                // matchedProd contains the desired product
                console.log("Desired product found:", matchedProd);
            } else {
                  return res.status(404).json({
                      status: "error",
                      message: "Product not found.",
                  });
            }
        } else {
              return res.status(404).json({
                  status: "error",
                  message: "Company not found.",
              });
        } 

        // Find all orders for the specified product ID
        const orders = await Order.find({ product: x._id });

        if (orders.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "No orders found for this product."
            });
        }

        res.status(200).json({
            status: "success",
            orders: orders
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: err.message });
    }
});
router.delete('/', async (req, res) => {
    try {
        const orderId = req.query.orderId; // Get the order ID from the query parameters

        // Find the order by ID
        const order = await Order.findOne({ orderId: orderId });

        if (!order) {
            return res.status(404).json({
                status: "error",
                message: "Order not found."
            });
        }

        // Delete the order
        await Order.deleteOne({ orderId: orderId });

        res.status(200).json({
            status: "success",
            message: "Order deleted successfully."
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
