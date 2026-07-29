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