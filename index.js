const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

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
    return res
      .status(401)
      .json({ message: "Unauthorized: Missing Authorization Header" });
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

const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: Insufficient role" });
    }
    next();
  };

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB Atlas!");

    const db = client.db("blooddonation");
    const userCollection = db.collection("user");
    const requestCollection = db.collection("donation_requests");
    const fundingCollection = db.collection("funding");

    // Get active/pending donation requests (Public)
    app.get("/public-donation-requests", async (req, res) => {
      try {
        const query = { donationStatus: "pending" };
        const result = await requestCollection.find(query).toArray();
        res.json(result);
      } catch (error) {
        console.error(error);

        res.status(500).json({ error: "Internal server error" });
      }
    });

    // Search active donors (Public)
    app.get("/donors", async (req, res) => {
      try {
        const { bloodGroup, district, upazila } = req.query;
        let query = {
          role: "donor",
          status: "active",
        };

        if (bloodGroup) query.bloodGroup = bloodGroup;
        if (district) query.district = district;
        if (upazila) query.upazila = upazila;

        const result = await userCollection.find(query).toArray();
        res.json(result);
      } catch (error) {
        console.error(error);

        res.status(500).json({ error: "Internal server error" });
      }
    });

    // Get current user details (Private)
    app.get("/users/me", tokenVerify, async (req, res) => {
      try {
        const email = req.user.email;
        const user = await userCollection.findOne({ email });
        if (!user) return res.statusq(404).json({ error: "User not found" });
        res.json(user);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // User registration (Public)
    app.post("/users", async (req, res) => {
      try {
        const { email, name, bloodGroup, district, upazila, image } = req.body;
        // Check if user already exists (prevent duplicates on page reload)
        const existing = await userCollection.findOne({ email });
        if (existing) return res.json({ message: "User already exists" });
        const newUser = {
          email,
          name,
          bloodGroup,
          district,
          upazila,
          image,
          role: "donor",
          status: "active",
          createdAt: new Date(),
        };
        const result = await userCollection.insertOne(newUser);
        res.json(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // Get specific user details (Admin Only)
    app.get(
      "/users/:id",
      tokenVerify,
      requireRole("admin"),
      async (req, res) => {
        try {
          const { id } = req.params;
          const user = await userCollection.findOne({ _id: id });
          if (!user) return res.status(404).json({ error: "User not found" });
          res.json(user);
        } catch (error) {
          console.error(error);
          res.status(500).json({ error: "Internal server error" });
        }
      },
    );

    // Get all users (Admin Only)
    app.get("/users", tokenVerify, requireRole("admin"), async (req, res) => {
      try {
        const { status } = req.query;
        let query = {};
        if (status && status !== "all") {
          query.status = status;
        }
        const result = await userCollection.find(query).toArray();
        res.json(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // Block/unblock user (Admin Only)
    app.patch(
      "/users/:id/status",
      tokenVerify,
      requireRole("admin"),
      async (req, res) => {
        try {
          const id = req.params.id;
          const { status } = req.body;
          const filter = { _id: id };
          const updateDoc = {
            $set: { status: status },
          };
          const result = await userCollection.updateOne(filter, updateDoc);
          res.json(result);
        } catch (error) {
          console.error(error);
          res.status(500).json({ error: "Internal server error" });
        }
      },
    );

    // Change user role (Admin Only)
    app.patch(
      "/users/:id/role",
      tokenVerify,
      requireRole("admin"),
      async (req, res) => {
        try {
          const id = req.params.id;
          const { role } = req.body;
          const filter = { _id: id }; // Better Auth uses string IDs
          const updateDoc = {
            $set: { role: role },
          };
          const result = await userCollection.updateOne(filter, updateDoc);
          res.json(result);
        } catch (error) {
          console.error(error);
          res.status(500).json({ error: "Internal server error" });
        }
      },
    );

    // Update user profile info (Private)
    app.patch("/users/update-profile", tokenVerify, async (req, res) => {
      try {
        const { userId, name, bloodGroup, district, upazila, image } = req.body;
        const filter = { _id: userId };
        const updateDoc = {
          $set: {
            name,
            bloodGroup,
            district,
            upazila,
            image,
          },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.json(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
  } finally {
  }
}
