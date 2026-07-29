const express = require("express");
const router = express.Router();
const multer = require("multer");

const Employee = require("../models/Employee");
const verifyToken = require("../middleware/auth");


// ---------- Multer setup: photos are kept in memory, not written to disk ----------
// Vercel's filesystem is read-only/ephemeral in production, so we can't save
// uploaded files the way disk storage normally would. Instead we convert the
// upload to a base64 data URL and store it directly on the employee document.

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed"));
        }
    }
});

function fileToDataUrl(file) {
    if (!file) return null;
    return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
}


// Register employee (now accepts multipart/form-data with an optional photo)
router.post("/register", upload.single("photo"), async (req, res) => {

    try {

        const employeeData = { ...req.body };

        // multer keeps the uploaded file in memory; convert it to a base64
        // data URL and store it directly on the document
        if (req.file) {
            employeeData.photoUrl = fileToDataUrl(req.file);
        }

        // workDays arrives as individual form fields when sent via FormData,
        // so make sure it's always stored as an array
        if (employeeData.workDays && !Array.isArray(employeeData.workDays)) {
            employeeData.workDays = [employeeData.workDays];
        }

        const employee = new Employee(employeeData);

        await employee.save();

        res.status(201).json({
            message: "Employee registered successfully"
        });


    } catch (error) {

        // Duplicate email: MongoDB throws a specific error code (11000)
        // when a "unique" field like email already exists
        if (error.code === 11000) {
            return res.status(409).json({
                message: "That email is already registered."
            });
        }

        // Mongoose validation errors (e.g. a required field was missing/invalid)
        // come back as an object of per-field messages -- collect them into
        // one clean, readable string instead of a raw error dump
        if (error.name === "ValidationError") {
            const messages = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({
                message: messages.join(" ")
            });
        }

        // Multer errors (e.g. file too large, wrong file type)
        if (error.message === "Only image files are allowed") {
            return res.status(400).json({
                message: error.message
            });
        }

        // Anything else unexpected
        console.error(error);
        res.status(500).json({
            message: "Something went wrong on our end. Please try again."
        });

    }

});
// Get all employees -- admin-only
router.get("/", verifyToken, async (req, res) => {

    try {

        const employees = await Employee.find();

        res.json(employees);

    } catch(error) {

        res.status(500).json({
            message: error.message
        });

    }

});


// Get single employee by ID -- admin-only
router.get("/:id", verifyToken, async (req, res) => {

    try {

        const employee = await Employee.findById(req.params.id);

        if (!employee) {
            return res.status(404).json({
                message: "Employee not found"
            });
        }

        res.json(employee);

    } catch(error) {

        res.status(500).json({
            message: error.message
        });

    }

});


// Update an employee -- admin-only (admin edits a profile; photo re-upload is optional)
router.put("/:id", verifyToken, upload.single("photo"), async (req, res) => {

    try {

        const employee = await Employee.findById(req.params.id);

        if (!employee) {
            return res.status(404).json({
                message: "Employee not found"
            });
        }

        const updates = { ...req.body };

        // workDays arrives as individual form fields when sent via FormData,
        // so make sure it's always stored as an array (same as /register)
        if (updates.workDays && !Array.isArray(updates.workDays)) {
            updates.workDays = [updates.workDays];
        } else if (!updates.workDays) {
            // If no work days were checked, FormData won't send the field at
            // all -- treat that as "cleared", not "leave unchanged"
            updates.workDays = [];
        }

        // Only replace the photo if a new one was actually uploaded;
        // otherwise leave the existing photoUrl alone
        if (req.file) {
            updates.photoUrl = fileToDataUrl(req.file);
        }

        const updatedEmployee = await Employee.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true } // return the updated doc, and re-check schema rules
        );

        res.json({
            message: "Employee updated successfully",
            employee: updatedEmployee
        });

    } catch (error) {

        if (error.code === 11000) {
            return res.status(409).json({
                message: "That email is already registered to another employee."
            });
        }

        if (error.name === "ValidationError") {
            const messages = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({
                message: messages.join(" ")
            });
        }

        console.error(error);
        res.status(500).json({
            message: "Something went wrong on our end. Please try again."
        });

    }

});


// Delete an employee -- admin-only
router.delete("/:id", verifyToken, async (req, res) => {

    try {

        const employee = await Employee.findByIdAndDelete(req.params.id);

        if (!employee) {
            return res.status(404).json({
                message: "Employee not found"
            });
        }

        res.json({
            message: "Employee deleted successfully"
        });

    } catch (error) {

        console.error(error);
        res.status(500).json({
            message: "Something went wrong on our end. Please try again."
        });

    }

});


module.exports = router;