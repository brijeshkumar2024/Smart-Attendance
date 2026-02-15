const jwt = require("jsonwebtoken");
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const authMiddleware = require("../config/authMiddleware");
const roleMiddleware = require("../config/roleMiddleware");




// Create User
router.post(
  "/",
  authMiddleware,
  async (req, res, next) => {
    try {
      const { name, email, password, role, subject } = req.body;

      if (req.user.role === "student") {
        return res.status(403).json({
          message: "Students cannot create users",
        });
      }

      if (req.user.role === "teacher" && role !== "student") {
        return res.status(403).json({
          message: "Teachers can create only students",
        });
      }

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          message: "User already exists",
        });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const user = new User({
        name,
        email,
        password: hashedPassword,
        role,
        subject: role === "teacher" ? (subject || "") : "",
      });

      const savedUser = await user.save();

      res.status(201).json(savedUser);

    } catch (error) {
      next(error);
    }
  }
);


// Login User
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      res.status(400);
      throw new Error("Invalid email or password");
    }

    if (!user.isActive) {
      res.status(403);
      throw new Error("Account is deactivated. Contact admin.");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(400);
      throw new Error("Invalid email or password");
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      message: "Login successful",
      token
    });

  } catch (error) {
    next(error);
  }
});

// Protected Route
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get(
  "/",
  authMiddleware,
  roleMiddleware("admin"),
  async (req, res, next) => {
    try {
      const users = await User.find().select("-password").sort({ createdAt: -1 });
      res.json(users);
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  "/:id/role",
  authMiddleware,
  roleMiddleware("admin"),
  async (req, res, next) => {
    try {
      const { role } = req.body;
      if (!["admin", "teacher", "student"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      user.role = role;
      if (role !== "teacher") {
        user.subject = "";
      }

      const updated = await user.save();
      res.json({ message: "Role updated", user: updated });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  "/:id/deactivate",
  authMiddleware,
  roleMiddleware("admin"),
  async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      user.isActive = false;
      await user.save();

      res.json({ message: "User deactivated successfully" });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  "/:id/reset-password",
  authMiddleware,
  roleMiddleware("admin"),
  async (req, res, next) => {
    try {
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({
          message: "New password is required and must be at least 6 characters",
        });
      }

      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
      await user.save();

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/teachers",
  authMiddleware,
  roleMiddleware("admin"),
  async (req, res, next) => {
    try {
      const teachers = await User.find({ role: "teacher", isActive: true }).select("name email subject");
      res.json(teachers);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/admin-dashboard",
  authMiddleware,
  roleMiddleware("admin"),
  (req, res) => {
    res.json({ message: "Welcome Admin" });
  }
);

router.get(
  "/students",
  authMiddleware,
  roleMiddleware("teacher", "admin"),
  async (req, res, next) => {
    try {
      const students = await User.find({ role: "student", isActive: true }).select("name email");
      res.json(students);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
