const jwt = require("jsonwebtoken");
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const User = require("../models/User");
const AcademicProgram = require("../models/AcademicProgram");
const AcademicSession = require("../models/AcademicSession");
const AcademicBranch = require("../models/AcademicBranch");
const AcademicSubject = require("../models/AcademicSubject");
const Class = require("../models/Class");
const bcrypt = require("bcryptjs");
const authMiddleware = require("../config/authMiddleware");
const roleMiddleware = require("../config/roleMiddleware");
const { generateTeacherId } = require("../utils/generateTeacherId");
const { getTeacherClassIds } = require("../utils/teacherClassAccess");

const normalizeText = (value) => (typeof value === "string" ? value.trim() : "");
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isValidGroupLabel = (value) => ["1", "2", "3", "4"].includes(normalizeText(value));

// Create User
router.post(
  "/",
  authMiddleware,
  async (req, res, next) => {
    try {
      const name = normalizeText(req.body.name);
      const email = normalizeText(req.body.email).toLowerCase();
      const password = String(req.body.password || "");
      const role = normalizeText(req.body.role).toLowerCase();
      const subject = normalizeText(req.body.subject);
      const programId = normalizeText(req.body.programId);
      const sessionId = normalizeText(req.body.sessionId);
      const branchId = normalizeText(req.body.branchId);
      const subjectId = normalizeText(req.body.subjectId);
      const semester = Number.parseInt(req.body.semester, 10);
      const groupLabel = normalizeText(req.body.groupLabel);

      if (!name || !email || password.length < 6) {
        return res.status(400).json({ message: "Name, email and password are required" });
      }
      if (!["admin", "teacher", "student"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

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

      const userPayload = {
        name,
        email,
        password: hashedPassword,
        role,
        teacherId: null,
        subject: "",
        program: null,
        session: null,
        branch: null,
        semester: null,
        groupLabel: "",
        subjectRef: null,
      };

      const hasStudentScopeInput =
        [programId, sessionId, branchId, groupLabel].some(Boolean) || Number.isInteger(semester);

      if (role === "student") {
        if (
          req.user.role === "admin" &&
          (!programId || !sessionId || !branchId || !Number.isInteger(semester) || !groupLabel)
        ) {
          return res.status(400).json({
            message: "Program, session, branch, semester, and group are required for student",
          });
        }

        if (hasStudentScopeInput) {
          if (
            !mongoose.Types.ObjectId.isValid(programId) ||
            !mongoose.Types.ObjectId.isValid(sessionId) ||
            !mongoose.Types.ObjectId.isValid(branchId) ||
            !Number.isInteger(semester) ||
            semester < 1 ||
            semester > 8 ||
            !isValidGroupLabel(groupLabel)
          ) {
            return res.status(400).json({
              message: "Invalid program/session/branch/semester/group for student",
            });
          }

          const [program, session, branch] = await Promise.all([
            AcademicProgram.findOne({ _id: programId, isActive: true }),
            AcademicSession.findOne({ _id: sessionId, program: programId, isActive: true }),
            AcademicBranch.findOne({
              _id: branchId,
              program: programId,
              session: sessionId,
              isActive: true,
            }),
          ]);

          if (!program || !session || !branch) {
            return res.status(404).json({ message: "Selected student scope not found" });
          }

          userPayload.program = program._id;
          userPayload.session = session._id;
          userPayload.branch = branch._id;
          userPayload.semester = semester;
          userPayload.groupLabel = groupLabel;
        }
      }

      if (role === "teacher") {
        userPayload.teacherId = await generateTeacherId();

        if (subjectId) {
          if (!mongoose.Types.ObjectId.isValid(subjectId)) {
            return res.status(400).json({ message: "Invalid subject selection" });
          }

          const selectedSubject = await AcademicSubject.findOne({
            _id: subjectId,
            isActive: true,
          });
          if (!selectedSubject) {
            return res.status(404).json({ message: "Selected subject not found" });
          }

          userPayload.subject = selectedSubject.name;
          userPayload.subjectRef = selectedSubject._id;
          userPayload.program = selectedSubject.program;
          userPayload.session = selectedSubject.session;
          userPayload.branch = selectedSubject.branch;
          userPayload.semester = selectedSubject.semester;
        } else if (subject) {
          userPayload.subject = subject;
        }
      }

      const user = new User({
        ...userPayload,
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
      const users = await User.find()
        .select("-password")
        .populate("session", "label")
        .sort({ createdAt: -1 });
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
      if (role === "teacher" && !user.teacherId) {
        user.teacherId = await generateTeacherId();
      }
      if (role !== "teacher") {
        user.subject = "";
        user.subjectRef = null;
      }
      if (role !== "student") {
        user.program = null;
        user.session = null;
        user.branch = null;
        user.semester = null;
        user.groupLabel = "";
      }

      const updated = await user.save();
      res.json({ message: "Role updated", user: updated });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  "/:id/student-group",
  authMiddleware,
  roleMiddleware("admin"),
  async (req, res, next) => {
    try {
      const groupLabel = normalizeText(req.body.groupLabel);
      if (!isValidGroupLabel(groupLabel)) {
        return res.status(400).json({ message: "Group must be between 1 and 4" });
      }

      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (user.role !== "student") {
        return res.status(400).json({ message: "Group can be changed only for students" });
      }

      user.groupLabel = groupLabel;
      const updated = await user.save();
      res.json({ message: "Student group updated", user: updated });
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
  "/:id/activate",
  authMiddleware,
  roleMiddleware("admin"),
  async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      user.isActive = true;
      await user.save();

      res.json({ message: "User activated successfully" });
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
      const filter = { role: "teacher", isActive: true };
      const subjectId = normalizeText(req.query.subjectId);
      const subject = normalizeText(req.query.subject);

      if (subjectId) {
        if (!mongoose.Types.ObjectId.isValid(subjectId)) {
          return res.status(400).json({ message: "Invalid subject filter" });
        }
        filter.subjectRef = subjectId;
      } else if (subject) {
        filter.subject = new RegExp(`^${escapeRegex(subject)}$`, "i");
      }

      const teachers = await User.find(filter)
        .select("name email teacherId subject subjectRef")
        .sort({ name: 1 });
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
      const classId = normalizeText(req.query.classId);
      const filter = { role: "student", isActive: true };

      if (classId) {
        if (!mongoose.Types.ObjectId.isValid(classId)) {
          return res.status(400).json({ message: "Invalid class id" });
        }

        const targetClass = await Class.findById(classId).select(
          "program session branch academicSemester groupLabel"
        );
        if (!targetClass) {
          return res.status(404).json({ message: "Class not found" });
        }

        if (req.user.role === "teacher") {
          const teacherClassIds = await getTeacherClassIds(req.user.id, {
            includeAllOverrides: true,
          });
          if (!teacherClassIds.includes(classId)) {
            return res.status(403).json({ message: "Not authorized for this class" });
          }
        }

        const hasAcademicScope =
          targetClass.program &&
          targetClass.session &&
          targetClass.branch &&
          Number.isInteger(targetClass.academicSemester) &&
          targetClass.groupLabel;

        if (hasAcademicScope) {
          filter.program = targetClass.program;
          filter.session = targetClass.session;
          filter.branch = targetClass.branch;
          filter.semester = targetClass.academicSemester;
          filter.groupLabel = targetClass.groupLabel;
        }
      }

      const students = await User.find(filter)
        .select("name email groupLabel program session branch semester")
        .sort({ name: 1 });
      res.json(students);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
