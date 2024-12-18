    const mongoose = require('mongoose');

    // Define the product schema
    const orderSchema = new mongoose.Schema({
        orderId: {
            type: String,
            required: true,
            unique: true  // Added a custom error message
        },
        orderType: {
            type: String,
            required: true,  // Added a custom error message
            trim: true,
            enum: ["item", "abstract", "service"],  // Example of restricted values
            default: 'Other'  // Default product type if not provided
        },
        consumerName: {
            type: String,
            required: true,
        },
        product: {
            type: mongoose.Schema.Types.ObjectId, ref: 'Product',
            required: true
        },
        dateOfOrder: {
            type: String,
            required: true
        },
        status: {
            type: String,
            required: true,
            enum: ["pending", "processing", "shipped", "outfordelivery", "delivered", "completed", "cancelled", "returned", "failed", "refunded"]
        }, 
        quantity: {
            type: Number,
            required: true
        },
        totalPrice: {
            type: Number,
            required: true
        }

    });

    // Create the model
    const Order = mongoose.model('Order', orderSchema);

    module.exports = Order;
