const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
const client = new MongoClient(uri);

let dbConnection;

module.exports = {
  connectToServer: async function() {
    try {
      dbConnection = await client.connect();
      console.log("Successfully connected to MongoDB.");
    } catch (err) {
      console.error("MongoDB connection error:", err);
      process.exit(1);
    }
  },
  getDb: function() {
    return dbConnection.db("talrental");
  }
};