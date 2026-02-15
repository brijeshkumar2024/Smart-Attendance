const express = require("express");
const router = express.Router();
const Class = require("../models/Class");
const Semester = require("../models/Semester");
const User = require("../models/User");
const authMiddleware = require("../config/authMiddleware");
const roleMiddleware = require("../config/roleMiddleware");

// Create Class (Only Teacher or Admin)
router.post(
  "/",
  authMiddleware,
  roleMiddleware("teacher", "admin"),
  async (req, res) => {
    try {
      const { className, subject, semesterId } = req.body;

      let semester = null;
      if (semesterId) {
        semester = await Semester.findById(semesterId);
        if (!semester) {
          res.status(404);
          throw new Error("Semester not found");
        }
      }

      const newClass = new Class({
        className,
        subject,
        teacher: req.user.id,
        semester: semester ? semester._id : null,
      });

      const savedClass = await newClass.save();

      res.status(201).json(savedClass);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

router.get(
  "/my-classes",
  authMiddleware,
  roleMiddleware("teacher"),
  async (req, res, next) => {
    try {
      const classes = await Class.find({ teacher: req.user.id }).populate("semester");
      res.json(classes);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/allocate",
  authMiddleware,
  roleMiddleware("admin"),
  async (req, res, next) => {
    try {
      const { className, subject, teacherId, semesterId } = req.body;

      const teacher = await User.findOne({ _id: teacherId, role: "teacher", isActive: true });
      if (!teacher) {
        res.status(404);
        throw new Error("Active teacher not found");
      }

      let semester = null;
      if (semesterId) {
        semester = await Semester.findById(semesterId);
        if (!semester) {
          res.status(404);
          throw new Error("Semester not found");
        }
      }

      const newClass = new Class({
        className,
        subject,
        teacher: teacher._id,
        semester: semester ? semester._id : null,
      });

      const savedClass = await newClass.save();
      res.status(201).json(savedClass);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/all",
  authMiddleware,
  roleMiddleware("admin"),
  async (req, res, next) => {
    try {
      const classes = await Class.find()
        .populate("teacher", "name email subject")
        .populate("semester");
      res.json(classes);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
