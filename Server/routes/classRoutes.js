const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Class = require("../models/Class");
const Semester = require("../models/Semester");
const User = require("../models/User");
const AcademicProgram = require("../models/AcademicProgram");
const AcademicSession = require("../models/AcademicSession");
const AcademicBranch = require("../models/AcademicBranch");
const AcademicSubject = require("../models/AcademicSubject");
const ClassTeacherOverride = require("../models/ClassTeacherOverride");
const authMiddleware = require("../config/authMiddleware");
const roleMiddleware = require("../config/roleMiddleware");
const { normalizeDate, getTeacherClassIds } = require("../utils/teacherClassAccess");

const normalizeText = (value) => String(value || "").trim();
const parseNumber = (value) => Number.parseInt(value, 10);

const classPopulate = [
  { path: "teacher", select: "name email teacherId subject" },
  { path: "semester" },
  { path: "program", select: "name code" },
  { path: "session", select: "label" },
  { path: "branch", select: "name code" },
  { path: "subjectRef", select: "name code semester" },
];

const buildAcademicClassName = ({
  program,
  session,
  branch,
  semester,
  groupLabel,
}) => {
  const programLabel = program.code || program.name;
  const branchLabel = branch.code || branch.name;
  return [
    programLabel,
    session.label,
    branchLabel,
    `Sem ${semester}`,
    `Group ${groupLabel}`,
  ].join(" | ");
};

// Create Class (Only Teacher or Admin)
router.post(
  "/",
  authMiddleware,
  roleMiddleware("teacher", "admin"),
  async (req, res) => {
    try {
      const className = normalizeText(req.body.className);
      const subject = normalizeText(req.body.subject);
      const semesterId = normalizeText(req.body.semesterId);

      if (!className || !subject) {
        return res.status(400).json({ message: "Class name and subject are required" });
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
        teacher: req.user.id,
        semester: semester ? semester._id : null,
      });

      const savedClass = await newClass.save();
      const populated = await savedClass.populate(classPopulate);

      res.status(201).json({ message: "Class created", class: populated });
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
      const targetDate = normalizeDate(req.query.date || new Date());
      const classIds = await getTeacherClassIds(req.user.id, {
        date: targetDate || new Date(),
      });

      const classes = await Class.find({ _id: { $in: classIds } })
        .populate(classPopulate)
        .sort({ className: 1 });
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
      const teacherId = normalizeText(req.body.teacherId);
      if (!mongoose.Types.ObjectId.isValid(teacherId)) {
        return res.status(400).json({ message: "Valid teacher is required" });
      }

      const teacher = await User.findOne({ _id: teacherId, role: "teacher", isActive: true });
      if (!teacher) {
        return res.status(404).json({ message: "Active teacher not found" });
      }

      const programId = normalizeText(req.body.programId);
      const sessionId = normalizeText(req.body.sessionId);
      const branchId = normalizeText(req.body.branchId);
      const subjectId = normalizeText(req.body.subjectId);
      const groupLabel = normalizeText(req.body.groupLabel);
      const academicSemester = parseNumber(req.body.semester);

      const hasAcademicScope = [programId, sessionId, branchId, subjectId].every((value) =>
        Boolean(value)
      );

      if (hasAcademicScope) {
        if (
          !mongoose.Types.ObjectId.isValid(programId) ||
          !mongoose.Types.ObjectId.isValid(sessionId) ||
          !mongoose.Types.ObjectId.isValid(branchId) ||
          !mongoose.Types.ObjectId.isValid(subjectId)
        ) {
          return res.status(400).json({ message: "Invalid allocation scope ids" });
        }
        if (!Number.isInteger(academicSemester) || academicSemester < 1 || academicSemester > 8) {
          return res.status(400).json({ message: "Semester must be between 1 and 8" });
        }
        if (!groupLabel) {
          return res.status(400).json({ message: "Group is required" });
        }
        if (!["1", "2", "3", "4"].includes(groupLabel)) {
          return res.status(400).json({ message: "Group must be between 1 and 4" });
        }

        const [program, session, branch, subject] = await Promise.all([
          AcademicProgram.findOne({ _id: programId, isActive: true }),
          AcademicSession.findOne({
            _id: sessionId,
            program: programId,
            isActive: true,
          }),
          AcademicBranch.findOne({
            _id: branchId,
            program: programId,
            session: sessionId,
            isActive: true,
          }),
          AcademicSubject.findOne({
            _id: subjectId,
            program: programId,
            session: sessionId,
            branch: branchId,
            semester: academicSemester,
            isActive: true,
          }),
        ]);

        if (!program || !session || !branch || !subject) {
          return res.status(404).json({
            message: "Selected program/session/branch/semester/subject scope not found",
          });
        }

        const className = buildAcademicClassName({
          program,
          session,
          branch,
          semester: academicSemester,
          groupLabel,
        });

        const scopeFilter = {
          program: program._id,
          session: session._id,
          branch: branch._id,
          subjectRef: subject._id,
          academicSemester,
          groupLabel,
        };

        const existingClass = await Class.findOne(scopeFilter);
        if (existingClass) {
          const teacherChanged = existingClass.teacher.toString() !== teacher._id.toString();
          existingClass.teacher = teacher._id;
          existingClass.className = className;
          existingClass.subject = subject.name;
          existingClass.program = program._id;
          existingClass.session = session._id;
          existingClass.branch = branch._id;
          existingClass.subjectRef = subject._id;
          existingClass.academicSemester = academicSemester;
          existingClass.groupLabel = groupLabel;
          await existingClass.save();

          const populatedExisting = await existingClass.populate(classPopulate);
          return res.json({
            message: teacherChanged
              ? "Teacher updated for selected class scope"
              : "Class scope already assigned to this teacher",
            reassigned: teacherChanged,
            class: populatedExisting,
          });
        }

        const newClass = await Class.create({
          className,
          subject: subject.name,
          teacher: teacher._id,
          semester: null,
          program: program._id,
          session: session._id,
          branch: branch._id,
          subjectRef: subject._id,
          academicSemester,
          groupLabel,
        });
        const populatedNew = await newClass.populate(classPopulate);
        return res.status(201).json({
          message: "Class allocated",
          reassigned: false,
          class: populatedNew,
        });
      }

      // Backward-compatible simple allocation mode.
      const className = normalizeText(req.body.className);
      const subject = normalizeText(req.body.subject);
      const semesterId = normalizeText(req.body.semesterId);

      if (!className || !subject) {
        return res.status(400).json({ message: "Class name and subject are required" });
      }

      let semester = null;
      if (semesterId) {
        semester = await Semester.findById(semesterId);
        if (!semester) {
          return res.status(404).json({ message: "Semester not found" });
        }
      }

      const newClass = await Class.create({
        className,
        subject,
        teacher: teacher._id,
        semester: semester ? semester._id : null,
      });
      const populated = await newClass.populate(classPopulate);
      res.status(201).json({
        message: "Class allocated",
        reassigned: false,
        class: populated,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  "/:id/teacher",
  authMiddleware,
  roleMiddleware("admin"),
  async (req, res, next) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: "Invalid class id" });
      }

      const teacherId = normalizeText(req.body.teacherId);
      const mode = normalizeText(req.body.mode).toLowerCase();
      if (!mongoose.Types.ObjectId.isValid(teacherId)) {
        return res.status(400).json({ message: "Valid teacher is required" });
      }
      if (!["full_sem", "one_day"].includes(mode)) {
        return res.status(400).json({ message: "Mode must be full_sem or one_day" });
      }

      const [targetClass, teacher] = await Promise.all([
        Class.findById(req.params.id),
        User.findOne({ _id: teacherId, role: "teacher", isActive: true }),
      ]);

      if (!targetClass) {
        return res.status(404).json({ message: "Class not found" });
      }
      if (!teacher) {
        return res.status(404).json({ message: "Active teacher not found" });
      }

      if (mode === "full_sem") {
        const changed = targetClass.teacher.toString() !== teacher._id.toString();
        targetClass.teacher = teacher._id;
        await targetClass.save();
        const populated = await targetClass.populate(classPopulate);
        return res.json({
          message: changed ? "Teacher changed for full semester" : "Teacher already assigned",
          mode,
          changed,
          class: populated,
        });
      }

      const overrideDate = normalizeDate(req.body.date);
      if (!overrideDate) {
        return res.status(400).json({ message: "Valid date is required for one_day mode" });
      }

      const override = await ClassTeacherOverride.findOneAndUpdate(
        { class: targetClass._id, date: overrideDate },
        {
          $set: {
            teacher: teacher._id,
            assignedBy: req.user.id,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ).populate("teacher", "name email teacherId subject");

      const populated = await targetClass.populate(classPopulate);
      res.json({
        message: `Teacher assigned for ${overrideDate.toISOString().slice(0, 10)}`,
        mode,
        changed: true,
        class: populated,
        override,
      });
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
        .populate(classPopulate)
        .sort({ updatedAt: -1 });
      res.json(classes);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
