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