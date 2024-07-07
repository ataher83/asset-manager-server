const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const nodemailer = require('nodemailer');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://asset-manager-54e54.web.app'
  ],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Send email function
const sendEmail = (emailAddress, emailData) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use `true` for port 465, `false` for all other ports
    auth: {
      user: process.env.TRANSPORTER_EMAIL,
      pass: process.env.TRANSPORTER_PASS,
    },
  });

  // verify transporter
  transporter.verify(function (error, success) {
    if (error) {
      console.log(error);
    } else {
      console.log('Server is ready to take our messages');
    }
  });
  const mailBody = {
    from: `"AssetManager" <${process.env.TRANSPORTER_EMAIL}>`, // sender address
    to: emailAddress, // list of receivers
    subject: emailData.subject, // Subject line
    html: emailData.message, // html body
  };

  transporter.sendMail(mailBody, (error, info) => {
    if (error) {
      console.log(error);
    } else {
      console.log('Email Sent: ' + info.response);
    }
  });
};

// Verify Token Middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  console.log(token);
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: 'unauthorized access' });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0yjrwty.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const db = client.db('asset-manager');
    const usersCollection = db.collection('users');
    const assetsCollection = db.collection('assets');
    const requestsCollection = db.collection('requests');

    // HRManager signup route
    app.post('/signup/hrmanager', async (req, res) => {
      const { email, password, name, dateOfBirth, companyName, companyLogo, packageName, memberLimit } = req.body;
      const user = {
        name,
        email,
        password,
        dateOfBirth,
        companyName,
        companyLogo,
        packageName,
        memberLimit,
        role: 'HRManager',
        status: 'Verified',
        timestamp: Date.now(),
      };

      const query = { email: user.email };
      const isExist = await usersCollection.findOne(query);

      if (isExist) {
        return res.status(400).send({ message: 'User already exists' });
      }

      const result = await usersCollection.insertOne(user);
      sendEmail(user.email, {
        subject: 'Welcome to Asset Manager!',
        message: 'You have been successfully registered as an HR Manager.',
      });
      res.send(result);
    });

    // Employee signup route
    app.post('/signup/employee', async (req, res) => {
      const { email, password, name, dateOfBirth } = req.body;
      const user = {
        name,
        email,
        password,
        dateOfBirth,
        role: 'Employee',
        status: 'Verified',
        timestamp: Date.now(),
      };

      const query = { email: user.email };
      const isExist = await usersCollection.findOne(query);

      if (isExist) {
        return res.status(400).send({ message: 'User already exists' });
      }

      const result = await usersCollection.insertOne(user);
      sendEmail(user.email, {
        subject: 'Welcome to Asset Manager!',
        message: 'You have been successfully registered as an Employee.',
      });
      res.send(result);
    });

    // Signup route for all users
    app.post('/user', async (req, res) => {
      const { name, email, password, image, role, dateOfBirth, status, timestamp, companyName, companyLogo, packageName, memberLimit } = req.body;
      const user = {
        name,
        email,
        password,
        image,
        dateOfBirth,
        role,
        status,
        timestamp,
        companyName,
        companyLogo,
        packageName,
        memberLimit,
      };

      const query = { email: user.email };
      const isExist = await usersCollection.findOne(query);

      if (isExist) {
        return res.status(400).send({ message: 'User already exists' });
      }

      const result = await usersCollection.insertOne(user);
      sendEmail(user.email, {
        subject: 'Welcome to Asset Manager!',
        message: `You have been successfully registered as a ${role}.`,
      });
      res.send(result);
    });

    // Verify HRManager middleware
    const verifyHRManager = async (req, res, next) => {
      const user = req.user;
      const query = { email: user?.email };
      const result = await usersCollection.findOne(query);
      if (!result || result?.role !== 'HRManager') {
        return res.status(401).send({ message: 'unauthorized access!!' });
      }
      next();
    };

    // Verify Employee middleware
    const verifyEmployee = async (req, res, next) => {
      const user = req.user;
      const query = { email: user?.email };
      const result = await usersCollection.findOne(query);
      if (!result || result?.role !== 'Employee') {
        return res.status(401).send({ message: 'unauthorized access!!' });
      }
      next();
    };

    // Auth related API
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      });
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true });
    });

    // Logout
    app.get('/logout', async (req, res) => {
      try {
        res
          .clearCookie('token', {
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true });
        console.log('Logout successful');
      } catch (err) {
        res.status(500).send(err);
      }
    });

    // Create payment intent
    app.post('/create-payment-intent', verifyToken, async (req, res) => {
      const price = req.body.price;
      const priceInCent = parseFloat(price) * 100;
      if (!price || priceInCent < 1) return;
      const { client_secret } = await stripe.paymentIntents.create({
        amount: priceInCent,
        currency: 'usd',
        automatic_payment_methods: {
          enabled: true,
        },
      });
      res.send({ clientSecret: client_secret });
    });

    // Get a user info by email
    app.get('/user/:email', async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send(result);
    });

    // Get all users data
    app.get('/users', verifyToken, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // Update a user role
    app.patch('/users/update/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email };
      const updateDoc = {
        $set: { ...user, timestamp: Date.now() },
      };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // Update a user's company name by ID
    app.patch('/users/:id', verifyToken, verifyHRManager, async (req, res) => {
      const id = req.params.id;
      const { companyName, companyLogo, role, memberLimit, packageName, status } = req.body;
      const updateDoc = {
        $set: {
          companyName,
          companyLogo,
          role,
          memberLimit,
          packageName,
          status,
          timestamp: Date.now(),
        },
      };
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        updateDoc
      );
      res.send(result);
    });

    // Get all assets with search, filter, and sort
    app.get('/assets', verifyToken, async (req, res) => {
      const { search, sort, stockStatus, assetType } = req.query;
      const query = {};

      if (search) {
        query.assetName = { $regex: search, $options: 'i' };
      }

      if (stockStatus) {
        query.assetAvailability = stockStatus;
      }

      if (assetType) {
        query.assetType = assetType;
      }

      const sortOrder = sort === 'asc' ? 1 : -1;

      try {
        const result = await assetsCollection
          .find(query)
          .sort({ assetQuantity: sortOrder })
          .toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ error: 'Failed to fetch assets' });
      }
    });

    // Get asset details by ID
    app.get('/assets/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await assetsCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Add a new asset
    app.post('/assets', verifyToken, verifyHRManager, async (req, res) => {
      const asset = req.body;
      asset.timestamp = Date.now();
      const result = await assetsCollection.insertOne(asset);
      res.send(result);
    });

    // Update an asset by ID
    app.patch('/assets/:id', verifyToken, verifyHRManager, async (req, res) => {
      const id = req.params.id;
      const asset = req.body;
      const updateDoc = {
        $set: { ...asset, timestamp: Date.now() },
      };
      const result = await assetsCollection.updateOne(
        { _id: new ObjectId(id) },
        updateDoc
      );
      res.send(result);
    });

    // Delete an asset by ID
    app.delete('/assets/:id', verifyToken, verifyHRManager, async (req, res) => {
      const id = req.params.id;
      const result = await assetsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // Request related API
    // Get all requests
    app.get('/requests', verifyToken, async (req, res) => {
      const result = await requestsCollection.find().toArray();
      res.send(result);
    });

    // Add a new request
    app.post('/requests', verifyToken, verifyEmployee, async (req, res) => {
      const request = req.body;
      request.timestamp = Date.now();
      const result = await requestsCollection.insertOne(request);
      res.send(result);
    });

    // Update a request by ID
    app.patch('/requests/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const request = req.body;
      const updateDoc = {
        $set: { ...request, timestamp: Date.now() },
      };
      const result = await requestsCollection.updateOne(
        { _id: new ObjectId(id) },
        updateDoc
      );
      res.send(result);
    });

    // Delete a request by ID
    app.delete('/requests/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await requestsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log('Pinged your deployment. You successfully connected to MongoDB!');
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Asset Manager is Running...');
});

app.listen(port, () => {
  console.log(`Asset Manager is Running on port ${port}`);
});
