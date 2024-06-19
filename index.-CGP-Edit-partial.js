const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const nodemailer = require('nodemailer')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000

// Middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())

// Send email function
const sendEmail = (emailAddress, emailData) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.TRANSPORTER_EMAIL,
      pass: process.env.TRANSPORTER_PASS,
    },
  })

  transporter.verify((error, success) => {
    if (error) {
      console.log(error)
    } else {
      console.log('Server is ready to take our messages')
    }
  })

  const mailBody = {
    from: `"AssetManager" <${process.env.TRANSPORTER_EMAIL}>`,
    to: emailAddress,
    subject: emailData.subject,
    html: emailData.message,
  }

  transporter.sendMail(mailBody, (error, info) => {
    if (error) {
      console.log(error)
    } else {
      console.log('Email Sent: ' + info.response)
    }
  })
}

// Verify Token Middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err)
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
    next()
  })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0yjrwty.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {
    const db = client.db('asset-manager')
    const roomsCollection = db.collection('rooms')
    const assetsCollection = db.collection('assets')
    const usersCollection = db.collection('users')
    const bookingsCollection = db.collection('bookings')

    // HRManager signup route
    app.post('/signup/hrmanager', async (req, res) => {
      const { email, password, name } = req.body
      const user = {
        email,
        password,
        name,
        role: 'HRManager',
        status: 'Active',
        timestamp: Date.now(),
      }

      const query = { email: user.email }
      const isExist = await usersCollection.findOne(query)

      if (isExist) {
        return res.status(400).send({ message: 'User already exists' })
      }

      const result = await usersCollection.insertOne(user)
      sendEmail(user.email, {
        subject: 'Welcome to Asset Manager!',
        message: 'You have been successfully registered as an HR Manager.',
      })
      res.send(result)
    })

    // Employee signup route
    app.post('/signup/employee', async (req, res) => {
      const { email, password, name, dateOfBirth } = req.body
      const user = {
        name,
        email,
        password,
        dateOfBirth,
        role: 'Employee',
        status: 'Active',
        timestamp: Date.now(),
      }

      const query = { email: user.email }
      const isExist = await usersCollection.findOne(query)

      if (isExist) {
        return res.status(400).send({ message: 'User already exists' })
      }

      const result = await usersCollection.insertOne(user)
      sendEmail(user.email, {
        subject: 'Welcome to Asset Manager!',
        message: 'You have been successfully registered as an Employee.',
      })
      res.send(result)
    })

    // Verify HRManager middleware
    const verifyHRManager = async (req, res, next) => {
      const user = req.user
      const query = { email: user?.email }
      const result = await usersCollection.findOne(query)
      if (!result || result?.role !== 'HRManager') {
        return res.status(401).send({ message: 'unauthorized access!!' })
      }
      next()
    }

    // Verify Employee middleware
    const verifyEmployee = async (req, res, next) => {
      const user = req.user
      const query = { email: user?.email }
      const result = await usersCollection.findOne(query)
      if (!result || result?.role !== 'Employee') {
        return res.status(401).send({ message: 'unauthorized access!!' })
      }
      next()
    }

    // Auth related API
    app.post('/jwt', async (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    })

    // Logout
    app.get('/logout', async (req, res) => {
      try {
        res
          .clearCookie('token', {
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true })
        console.log('Logout successful')
      } catch (err) {
        res.status(500).send(err)
      }
    })

    // Create payment intent
    app.post('/create-payment-intent', verifyToken, async (req, res) => {
      const price = req.body.price
      const priceInCent = parseFloat(price) * 100
      if (!price || priceInCent < 1) return
      const { client_secret } = await stripe.paymentIntents.create({
        amount: priceInCent,
        currency: 'usd',
        automatic_payment_methods: {
          enabled: true,
        },
      })
      res.send({ clientSecret: client_secret })
    })

    // Save a user data in db
    app.put('/user', async (req, res) => {
      const user = req.body
      const query = { email: user?.email }
      const isExist = await usersCollection.findOne(query)
      if (isExist) {
        if (user.status === 'Requested') {
          const result = await usersCollection.updateOne(query, {
            $set: { status: user?.status },
          })
          return res.send(result)
        } else {
          return res.send(isExist)
        }
      }
      const options = { upsert: true }
      const updateDoc = {
        $set: {
          ...user,
          timestamp: Date.now(),
        },
      }
      const result = await usersCollection.updateOne(query, updateDoc, options)
      sendEmail(user?.email, {
        subject: 'Welcome to Asset Manager!',
        message: `We are delighted to have you on board as a valued client. Thank you for choosing us to manage your assets and financial goals.`,
      })
      res.send(result)
    })

    // Get a user info by email from db
    app.get('/user/:email', async (req, res) => {
      const email = req.params.email
      const result = await usersCollection.findOne({ email })
      res.send(result)
    })

    // Get all users data from db
    app.get('/users', verifyToken, verifyHRManager, async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })

    // Update a user role
    app.patch('/users/update/:email', async (req, res) => {
      const email = req.params.email
      const user = req.body
      const query = { email }
      const updateDoc = {
        $set: { ...user, timestamp: Date.now() },
      }
      const result = await usersCollection.updateOne(query, updateDoc)
      res.send(result)
    })

    // Get all rooms from db
    app.get('/rooms', async (req, res) => {
      const category = req.query.category
      let query = {}
      if (category && category !== 'null') query = { category }
      const result = await roomsCollection.find(query).toArray()
      res.send(result)
    })

    // Save asset data in db
    app.post('/asset', verifyToken
