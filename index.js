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

// middleware
const corsOptions = {
  origin: [
    'http://localhost:5173', 
    'http://localhost:5174',
    'https://asset-manager-54e54.web.app'
  ],
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
    secure: false, // Use `true` for port 465, `false` for all other ports
    auth: {
      user: process.env.TRANSPORTER_EMAIL,
      pass: process.env.TRANSPORTER_PASS,
    },
  })

  // verify transporter
  // verify connection configuration
  transporter.verify(function (error, success) {
    if (error) {
      console.log(error)
    } else {
      console.log('Server is ready to take our messages')
    }
  })
  const mailBody = {
    from: `"AssetManager" <${process.env.TRANSPORTER_EMAIL}>`, // sender address
    to: emailAddress, // list of receivers
    subject: emailData.subject, // Subject line
    html: emailData.message, // html body
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
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token
  console.log(token)
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

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0yjrwty.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    const usersCollection = db.collection('users')
    const assetsCollection = db.collection('assets')
    const requestsCollection = db.collection('requests')



    // HRManager signup route  //uu
    app.post('/signup/hrmanager', async (req, res) => {
      const { email, password, name, dateOfBirth, companyName, companyLogo, packageName, memberLimit,  } = req.body;
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

    // Employee signup route //uu
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


// ******  ঠিক , কাজ করে, // ঠিক,   শুধু মডাল সমস্যা 
    // // signup route  // both for 3 types signup
    app.post('/user', async (req, res) => {
      // const { name, email, password, image, role = 'guest' } = req.body; // চেক 
      const { name, email, password, image, role, dateOfBirth, status, timestamp,
        companyName,
        companyLogo,
        packageName,
        memberLimit, } = req.body; // চেক 
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




    // verify HRManager middleware
    const verifyHRManager = async (req, res, next) => {
      console.log('verify HRManager')
      const user = req.user
      const query = { email: user?.email }
      const result = await usersCollection.findOne(query)
      console.log(result?.role)
      if (!result || result?.role !== 'HRManager') {
        return res.status(401).send({ message: 'unauthorized access!!' })
      }
      next()
    }
    
    // Verify Employee middleware
    const verifyEmployee = async (req, res, next) => {
      console.log('hello')
      const user = req.user
      const query = { email: user?.email }
      const result = await usersCollection.findOne(query)
      console.log(result?.role)
      if (!result || result?.role !== 'Employee') {
        return res.status(401).send({ message: 'unauthorized access!!' })
      }

      next()
    }


    // auth related api
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





    // create-payment-intent  //uu
    app.post('/create-payment-intent', verifyToken, async (req, res) => {
      const price = req.body.price
      const priceInCent = parseFloat(price) * 100
      if (!price || priceInCent < 1) return
      // generate clientSecret
      const { client_secret } = await stripe.paymentIntents.create({
        amount: priceInCent,
        currency: 'usd',
        // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
        automatic_payment_methods: {
          enabled: true,
        },
      })
      // send client secret as response
      res.send({ clientSecret: client_secret })
    })




    // get a user info by email from db  // ঠিক 
    app.get('/user/:email', async (req, res) => {
      const email = req.params.email
      const result = await usersCollection.findOne({ email })
      res.send(result)
    })


    // get all users data from db  
    // app.get('/users', verifyToken, verifyHRManager,  async (req, res) => {
    app.get('/users', verifyToken, async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })

    //update a user role
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




    // Get all assets from db
    app.get('/assets', verifyToken, verifyHRManager,  async (req, res) => {
      const result = await assetsCollection.find().toArray()
      res.send(result)
    })





    // Save asset data in db    // ঠিক
    app.post('/asset', verifyToken, verifyHRManager, async (req, res) => {
      const assetData = req.body
      const result = await assetsCollection.insertOne(assetData)
      res.send(result)
    })

    // Save asset request in db   // ঠিক
    app.post('/request', verifyToken, verifyEmployee, async (req, res) => {
      const requestData = req.body
      const result = await requestsCollection.insertOne(requestData)
      res.send(result)
    })










    // Get employee asset request by email from db //সিজিপি //ঠিক
    app.get('/request/:email', verifyToken, verifyEmployee, async (req, res) => {
      const email = req.params.email;
      const query = { 'assetRequesterEmail': email }; // Fixed field name
      try {
        const result = await requestsCollection.find(query).toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ error: 'Failed to fetch requests' });
      }
    });



    // get all Asset requests Data  // ঠিক 
    app.get('/requests', verifyToken, verifyHRManager, async (req, res) => {
      // const email = req.params.email
      // const query = { 'guest.email': email }
      const result = await requestsCollection.find().toArray()
      res.send(result)
    })






    // নিচের ফাইলগুলো চেক কর 

    // HRManager Statistics
    app.get('/admin-stat', verifyToken, verifyHRManager, async (req, res) => {
      const bookingDetails = await bookingsCollection
        .find(
          {},
          {
            projection: {
              date: 1,
              price: 1,
            },
          }
        )
        .toArray()

      const totalUsers = await usersCollection.countDocuments()
      const totalRooms = await roomsCollection.countDocuments()
      const totalPrice = bookingDetails.reduce(
        (sum, booking) => sum + booking.price,
        0
      )
      // const data = [
      //   ['Day', 'Sales'],
      //   ['9/5', 1000],
      //   ['10/2', 1170],
      //   ['11/1', 660],
      //   ['12/11', 1030],
      // ]
      const chartData = bookingDetails.map(booking => {
        const day = new Date(booking.date).getDate()
        const month = new Date(booking.date).getMonth() + 1
        const data = [`${day}/${month}`, booking?.price]
        return data
      })
      chartData.unshift(['Day', 'Sales'])
      // chartData.splice(0, 0, ['Day', 'Sales'])

      console.log(chartData)

      console.log(bookingDetails)
      res.send({
        totalUsers,
        totalRooms,
        totalBookings: bookingDetails.length,
        totalPrice,
        chartData,
      })
    })


    // Employee Statistics
    app.get('/host-stat', verifyToken, verifyEmployee, async (req, res) => {
      const { email } = req.user
      const bookingDetails = await bookingsCollection
        .find(
          { 'employee.email': email },
          {
            projection: {
              date: 1,
              price: 1,
            },
          }
        )
        .toArray()

      const totalRooms = await roomsCollection.countDocuments({
        'employee.email': email,
      })
      const totalPrice = bookingDetails.reduce(
        (sum, booking) => sum + booking.price,
        0
      )
      const { timestamp } = await usersCollection.findOne(
        { email },
        { projection: { timestamp: 1 } }
      )

      const chartData = bookingDetails.map(booking => {
        const day = new Date(booking.date).getDate()
        const month = new Date(booking.date).getMonth() + 1
        const data = [`${day}/${month}`, booking?.price]
        return data
      })
      chartData.unshift(['Day', 'Sales'])
      // chartData.splice(0, 0, ['Day', 'Sales'])

      console.log(chartData)

      console.log(bookingDetails)
      res.send({
        totalRooms,
        totalBookings: bookingDetails.length,
        totalPrice,
        chartData,
        hostSince: timestamp,
      })
    })


    // Guest Statistics
    app.get('/guest-stat', verifyToken, async (req, res) => {
      const { email } = req.user
      const bookingDetails = await bookingsCollection
        .find(
          { 'guest.email': email },
          {
            projection: {
              date: 1,
              price: 1,
            },
          }
        )
        .toArray()

      const totalPrice = bookingDetails.reduce(
        (sum, booking) => sum + booking.price,
        0
      )
      const { timestamp } = await usersCollection.findOne(
        { email },
        { projection: { timestamp: 1 } }
      )

      const chartData = bookingDetails.map(booking => {
        const day = new Date(booking.date).getDate()
        const month = new Date(booking.date).getMonth() + 1
        const data = [`${day}/${month}`, booking?.price]
        return data
      })
      chartData.unshift(['Day', 'Sales'])
      // chartData.splice(0, 0, ['Day', 'Sales'])

      console.log(chartData)

      console.log(bookingDetails)
      res.send({
        totalBookings: bookingDetails.length,
        totalPrice,
        chartData,
        guestSince: timestamp,
      })
    })



    


    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Asset Manager is Running...')
})


app.listen(port, () => {
  console.log(`Asset Manager is Running on port ${port}`)
})
