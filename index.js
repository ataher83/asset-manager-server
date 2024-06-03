const express = require('express')
const app = express()
const cors = require('cors')
const port = process.env.PORT || 5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')

const jwt = require('jsonwebtoken')
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
}


app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0yjrwty.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

app.get('/', (req, res) => {
  res.send('Asset Manager is Running...')
})


app.listen(port, () => {
  console.log(`Asset Manager is Running on port ${port}`)
})
