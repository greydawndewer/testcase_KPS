const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const productRoutes = require('./routes/product');
const userRoutes = require('./routes/user');
const loginRoutes = require('./routes/pages/login');
const signupRoutes = require('./routes/pages/signup');

const app = express();
const port = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
const uri = "mongodb+srv://Ganime_Dewer:jamshedpur_1000@ganimeindustries1000.rkmonvc.mongodb.net/data";
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

  
  app.use('/api/products', productRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/users/login', loginRoutes)
  app.use('/api/users/signup', signupRoutes)
  
app.listen(port, () => {
  console.log(`Server running on port: ${port}`);
});
