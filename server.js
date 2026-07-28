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


// MongoDB connection (cached across warm serverless invocations so we
// don't reconnect on every single request)
let isConnected = false;
async function connectDB() {
    if (isConnected) return;
    await mongoose.connect(process.env.MONGO_URI);
    isConnected = true;
    console.log("MongoDB connected successfully");
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
