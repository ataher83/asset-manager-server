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

    // Get a user info by email
    app.get('/user/:email', async (req, res) => {
      const email = req.params.email
      const result = await usersCollection.findOne({ email })
      res.send(result)
    })

    // Get all users data
    app.get('/users', verifyToken, async (req, res) => {
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





// Update a user's company name by ID
app.patch('/users/:id', verifyToken, verifyHRManager, async (req, res) => {
  const id = req.params.id;
  const { companyName, companyLogo, role } = req.body;
  try {
      const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { companyName: companyName, companyLogo: companyLogo, role: role } }
          // { $set: { companyName: companyName }, { companyLogo: companyLogo } }
      );
      if (result.modifiedCount === 1) {
          res.send({ success: true, message: 'User added to the team' });
      } else {
          res.status(404).send({ success: false, message: 'User not found' });
      }
  } catch (err) {
      res.status(500).send({ success: false, message: 'Failed to update user' });
  }
});











// Remove a user from team by ID 
app.delete('/users/:id', verifyToken, verifyHRManager, async (req, res) => {
  const id = req.params.id;
  try {
    const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 1) {
      res.send({ success: true, message: 'User removed from team' });
    } else {
      res.status(404).send({ success: false, message: 'User not found' });
    }
  } catch (err) {
    res.status(500).send({ success: false, message: 'Failed to remove user' });
  }
});








    // Get all assets with search, filter, and sort

    // app.get('/assets', verifyToken, async (req, res) => {
    //   const { search, sort, filter } = req.query
    //   const query = {}
    //   if (search) {
    //     query.name = { $regex: search, $options: 'i' }
    //   }
    //   if (filter) {
    //     query.category = filter
    //   }
    //   const sortOrder = sort === 'asc' ? 1 : -1
    //   const result = await assetsCollection.find(query).sort({ name: sortOrder }).toArray()
    //   res.send(result)
    // })



    // app.get('/assets', verifyToken, async (req, res) => {
    //     const { search, sort, stockStatus, assetType } = req.query;
    //     const query = {};
        
    //     if (search) {
    //       query.assetName = { $regex: search, $options: 'i' };
    //     }
        
    //     if (stockStatus) {
    //       query.assetAvailability = stockStatus;
    //     }
        
    //     if (assetType) {
    //       query.assetType = assetType;
    //     }
        
    //     const sortOrder = sort === 'asc' ? 1 : -1;
        
    //     try {
    //       const result = await assetsCollection.find(query).sort({ assetQuantity: sortOrder }).toArray();
    //       res.send(result);
    //     } catch (err) {
    //       res.status(500).send({ error: 'Failed to fetch assets' });
    //     }
    //   });



    // app.get('/assets', verifyToken, async (req, res) => {
    //     const { search, sort, stockStatus, assetType } = req.query;
    //     const query = {};
        
    //     if (search) {
    //       query.assetName = { $regex: search, $options: 'i' };
    //     }
        
    //     if (stockStatus) {
    //       query.assetAvailability = stockStatus;
    //     }
        
    //     if (assetType) {
    //       query.assetType = assetType;
    //     }
        
    //     // const sortOrder = sort == 'asc' ? 1 : -1;
    //     const sortOrder = sort === 'asc' ? 1 : -1;

    //     // const sortArray = (arr: number[], sort: 'asc' | 'desc'): number[] => {
    //     //   const sortOrder = sort === 'asc' ? 1 : -1;
    //     //   return arr.sort((a, b) => (a - b) * sortOrder);
    //     // };


    //     // const handleSort = () => {
    //     //   const sortedProducts = [...products].sort((a, b) => {
    //     //     const sortMultiplier = sortOrder === 'asc' ? 1 : -1;
    //     //     return (a.price - b.price) * sortMultiplier;
    //     //   });
    //     //   setProducts(sortedProducts);
    //     //   setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    //     // };





        
    //     try {
    //       // const result = await assetsCollection.find(query).sort({ assetQuantity: sortArray }).toArray();
    //       const result = await assetsCollection.find(query).sort({ assetQuantity: sortOrder }).toArray();
    //       res.send(result);
    //     } catch (err) {
    //       res.status(500).send({ error: 'Failed to fetch assets' });
    //     }
    //   });


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
            const result = await assetsCollection.find(query).toArray();
            
            // Sort the assets manually since MongoDB might treat numbers as strings
            result.sort((a, b) => {
                const quantityA = parseInt(a.assetQuantity, 10);
                const quantityB = parseInt(b.assetQuantity, 10);
                return (quantityA - quantityB) * sortOrder;
            });
    
            res.send(result);
        } catch (err) {
            res.status(500).send({ error: 'Failed to fetch assets' });
        }
    });
    







// Get all request,  search by email 
    app.get('/requests', verifyToken, async (req, res) => {
        const { searchByEmail } = req.query;
        const query = {};
        
        if (searchByEmail) {
          // query.assetName = { $regex: searchByName, $options: 'i' };
          query.assetRequesterEmail = { $regex: searchByEmail, $options: 'i' };
        }
        
        
        try {
          const result = await requestsCollection.find(query).toArray();
          res.send(result);
        } catch (err) {
          res.status(500).send({ error: 'Failed to fetch Asset-Request' });
        }
      });


// Get all assets with search and filter for Asset Request page
    app.get('/assetsForAssetRequest', verifyToken, async (req, res) => {
        const { searchTerm, availabilityFilter, typeFilter } = req.query;
        const query = {};
        
        if (searchTerm) {
          query.assetName = { $regex: searchTerm, $options: 'i' };
        }
        
        if (availabilityFilter) {
          query.assetAvailability = availabilityFilter;
        }
        
        if (typeFilter) {
          query.assetType = typeFilter;
        }
        
        
        try {
          const result = await assetsCollection.find(query).toArray();
          res.send(result);
        } catch (err) {
          res.status(500).send({ error: 'Failed to fetch assetsForAssetRequest' });
        }
      });
      






      


    // Save asset data in db
    app.post('/asset', verifyToken, verifyHRManager, async (req, res) => {
      const assetData = req.body
      const result = await assetsCollection.insertOne(assetData)
      res.send(result)
    })

    // Save asset request in db
    app.post('/request', verifyToken, verifyEmployee, async (req, res) => {
      const requestData = req.body
      const result = await requestsCollection.insertOne(requestData)
      res.send(result)
    })














    // Get employee asset request by email
    app.get('/request/:email', verifyToken, verifyEmployee, async (req, res) => {
      const email = req.params.email
      const query = { 'assetRequesterEmail': email }
      try {
        const result = await requestsCollection.find(query).toArray()
        res.send(result)
      } catch (err) {
        res.status(500).send({ error: 'Failed to fetch requests' })
      }
    })



  // Get single employee asset request by email, with search, filter, and sort
  app.get('/myRequest/:email', verifyToken, verifyEmployee, async (req, res) => {
    const { search, status, type } = req.query;
    const email = req.params.email
    const query = { 'assetRequesterEmail': email }
    
    if (search) {
      query.assetName = { $regex: search, $options: 'i' };
    }
    
    if (status) {
      query.assetRequestStatus = status;
    }
    
    if (type) {
      query.assetType = type;
    }
    
    
    try {
      const result = await requestsCollection.find(query).toArray();
      res.send(result);
    } catch (err) {
      res.status(500).send({ error: 'Failed to fetch myRequest' });
    }
  });

























    // Get all asset requests data
    app.get('/requests', verifyToken, verifyHRManager, async (req, res) => {
      const result = await requestsCollection.find().toArray()
      res.send(result)
    })


  // Get all requests with search, filter, and sort
  // app.get('/requests', verifyToken, async (req, res) => {
  //   const { search, status, type } = req.query;
  //   const query = {};
    
  //   if (search) {
  //     query.assetName = { $regex: search, $options: 'i' };
  //   }
    
  //   if (status) {
  //     query.assetRequestStatus = status;
  //   }
    
  //   if (type) {
  //     query.assetType = type;
  //   }
    
    
  //   try {
  //     const result = await requestsCollection.find(query).toArray();
  //     res.send(result);
  //   } catch (err) {
  //     res.status(500).send({ error: 'Failed to fetch requests' });
  //   }
  // });
  







    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log('Pinged your deployment. You successfully connected to MongoDB!')
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
