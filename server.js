const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();


// Allows Express to read JSON data from requests
app.use(express.json());


// Serves your HTML, CSS, images, etc. from the public folder
app.use(express.static("public"));


// Import routes
const employeeRoutes = require("./routes/employees");
const authRoutes = require("./routes/auth");


// Connect routes
app.use("/api/employees", employeeRoutes);
app.use("/api/auth", authRoutes);


// MongoDB connection (cached across warm serverless invocations).
// We cache the CONNECTION PROMISE itself, not just a true/false flag —
// that way, if several requests arrive at the same time during a cold
// start, they all wait on the same in-flight connection attempt instead
// of each triggering their own (which is what caused the intermittent
// "could not load employees" failures).
let dbConnectionPromise = null;

function connectDB() {
    if (mongoose.connection.readyState === 1) {
        return Promise.resolve();
    }
    if (!dbConnectionPromise) {
        dbConnectionPromise = mongoose
            .connect(process.env.MONGO_URI, {
                serverSelectionTimeoutMS: 8000, // fail fast instead of hanging
                socketTimeoutMS: 20000,
                maxPoolSize: 5,
            })
            .then(() => {
                console.log("MongoDB connected successfully");
            })
            .catch((error) => {
                // Let the next request try again instead of being stuck
                // forever on a failed attempt
                dbConnectionPromise = null;
                throw error;
            });
    }
    return dbConnectionPromise;
}

app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (error) {
        console.error("MongoDB connection failed:", error);
        res.status(500).json({ message: "Database connection failed" });
    }
});


// Test route
app.get("/test", (req, res) => {
    res.send("Server is working");
});


// Only listen locally — Vercel handles this itself in production
if (!process.env.VERCEL) {
    app.listen(5000, () => {
        console.log("Server running on port 5000");
    });
}

module.exports = app;