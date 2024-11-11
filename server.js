const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const https = require("https");
const productRoutes = require('./routes/product');
const userRoutes = require('./routes/user');
const orderRoutes = require('./routes/order');
const loginRoutes = require('./routes/pages/login');
const signupRoutes = require('./routes/pages/signup');
const comps = require('./routes/pages/comapny');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
const uri = "mongodb+srv://username:password@ganimeindustries1000.rkmonvc.mongodb.net/data";
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

// Routes
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users/login', loginRoutes);
app.use('/api/users/signup', signupRoutes);
app.use('/api/companies', comps);


// Start server
app.listen(port, () => {
  console.log(`Server running on port: ${port}`);
});

