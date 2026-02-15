const express = require("express");
const router = express.Router();
const Semester = require("../models/Semester");
const authMiddleware = require("../config/authMiddleware");
const roleMiddleware = require("../config/roleMiddleware");

router.post(
  "/",
  authMiddleware,
  roleMiddleware("admin"),
  async (req, res, next) => {
    try {
      const { name, startDate, endDate } = req.body;

      const semester = new Semester({
        name,
        startDate,
        endDate,
      });

      const saved = await semester.save();
      res.status(201).json(saved);
    } catch (error) {
      next(error);
    }
  }
);

router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const semesters = await Semester.find().sort({ startDate: 1 });
    res.json(semesters);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
