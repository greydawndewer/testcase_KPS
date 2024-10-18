const mongoose = require('mongoose');

// Define the product schema
const productSchema = new mongoose.Schema({
    productName: {
        type: String,
        required: [true, 'Product name is required'],  // Added a custom error message
        trim: true,  // Removes leading and trailing whitespace
        minlength: [3, 'Product name must be at least 3 characters long']
    },
    productType: {
        type: String,
        required: [true, 'Product type is required'],  // Added a custom error message
        trim: true,
        enum: ['Electronics', 'Clothing', 'Food', 'Furniture', 'Other'],  // Example of restricted values
        default: 'Other'  // Default product type if not provided
    },  
    producerName: {
        type: String,
        required: [true, 'Producer is required'],
        trim: true
    },
    images: {
        type: String
    },
    categories: {
        categories: [{ type: String }],
    },
    description: {
        type: String,
        trim: true,  // Removes leading and trailing whitespace
        maxlength: [500, 'Description can be a maximum of 500 characters']  // Max length validation
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],  // Added a custom error message
        min: [0, 'Price cannot be negative']  // Enforcing non-negative price
    },
    stock: {
        form: {
            amount: {
                type: Number,
                required: true,
            }
        }
    },
    reviews: {
        consumerName: {
            type: String,
            required: true
        },
        rating: {
            type: Number,
            required: true
        },
        description: {
            type: String,
        }
    }
});

// Create the model
const Product = mongoose.model('Product', productSchema);

module.exports = Product;
