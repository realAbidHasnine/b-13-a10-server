const dns = require("node:dns")
dns.setServers(["8.8.8.8","1.1.1.1"]);

const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
require("dotenv").config();

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY environment variable is not set");
}
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const app = express();

app.use(express.json());
app.use(cors());

const uri = process.env.MONGODB_URI;
const port = process.env.PORT || 5000;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});


const authServerUrl = process.env.CLIENT_URL || "http://localhost:3000";
const JWKS = createRemoteJWKSet(new URL(`${authServerUrl}/api/auth/jwks`));


// JWT Verification Middleware
const tokenVerify = async (req, res, next) => {
  const header = req?.headers.authorization;
  if (!header) {
    return res.status(401).json({ message: "Unauthorized: Missing Authorization Header" });
  }

  const token = header.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized: Missing Token" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload; 
    next();
  } catch (error) {
    console.error("JWT Verification failed:", error.message);
    return res.status(403).json({ message: "Forbidden: Invalid Token" });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden: Insufficient role" });
  }
  next();
};

async function run() {

    try{
        await client.connect();
        console.log("Connected to MongoDB Atlas!");

        const db = client.db("blooddonation")
        const userCollection = db.collection("user")
        const requestCollection = db.collection("donation_requests")
        const fundingCollection = db.collection("funding")

        // Get active/pending donation requests (Public)
        app.get("/public-donation-requests",async(req,res)=>{
            try{
                const query = {donationStatus: "pending"};
                const result = await requestCollection.find(query).toArray();
                res.json(result)
            }
            catch(error){

                console.error(error)

                res.status(500).json({ error: "Internal server error" })

            }
        })
    }
    
    finally{

    }
}