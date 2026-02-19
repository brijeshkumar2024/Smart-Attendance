const express = require("express");
const mongoose = require("mongoose");
const authMiddleware = require("../config/authMiddleware");
const roleMiddleware = require("../config/roleMiddleware");
const AcademicProgram = require("../models/AcademicProgram");
const AcademicSession = require("../models/AcademicSession");
const AcademicBranch = require("../models/AcademicBranch");
const AcademicSubject = require("../models/AcademicSubject");

const router = express.Router();

const normalizeText = (value) => String(value || "").trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const parseSemester = (value) => Number.parseInt(value, 10);

router.use(authMiddleware, roleMiddleware("admin"));

router.get("/programs", async (req, res, next) => {
  try {
    const includeInactive = String(req.query.includeInactive || "false") === "true";
    const filter = includeInactive ? {} : { isActive: true };
    const programs = await AcademicProgram.find(filter).sort({ name: 1 });
    res.json(programs);
  } catch (error) {
    next(error);
  }
});

router.post("/programs", async (req, res, next) => {
  try {
    const name = normalizeText(req.body.name);
    const code = normalizeText(req.body.code).toUpperCase();
    const description = normalizeText(req.body.description);

    if (!name) {
      return res.status(400).json({ message: "Program name is required" });
    }

    const duplicate = await AcademicProgram.findOne({
      isActive: true,
      $expr: {
        $eq: [{ $toLower: "$name" }, normalizeLower(name)],
      },
    });

    if (duplicate) {
      return res.status(409).json({ message: "Program already exists" });
    }

    const created = await AcademicProgram.create({ name, code, description });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.patch("/programs/:id", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid program id" });
    }

    const program = await AcademicProgram.findById(req.params.id);
    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    const nextName = normalizeText(req.body.name || program.name);
    const nextCode = normalizeText(
      typeof req.body.code === "undefined" ? program.code : req.body.code
    ).toUpperCase();
    const nextDescription = normalizeText(
      typeof req.body.description === "undefined"
        ? program.description
        : req.body.description
    );

    if (!nextName) {
      return res.status(400).json({ message: "Program name is required" });
    }

    const duplicate = await AcademicProgram.findOne({
      _id: { $ne: program._id },
      isActive: true,
      $expr: {
        $eq: [{ $toLower: "$name" }, normalizeLower(nextName)],
      },
    });

    if (duplicate) {
      return res.status(409).json({ message: "Program with same name exists" });
    }

    program.name = nextName;
    program.code = nextCode;
    program.description = nextDescription;
    await program.save();
    res.json(program);
  } catch (error) {
    next(error);
  }
});

router.delete("/programs/:id", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid program id" });
    }

    const program = await AcademicProgram.findById(req.params.id);
    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    program.isActive = false;
    await program.save();

    await AcademicSession.updateMany({ program: program._id }, { $set: { isActive: false } });
    await AcademicBranch.updateMany({ program: program._id }, { $set: { isActive: false } });
    await AcademicSubject.updateMany({ program: program._id }, { $set: { isActive: false } });

    res.json({ message: "Program deactivated" });
  } catch (error) {
    next(error);
  }
});

router.get("/sessions", async (req, res, next) => {
  try {
    const includeInactive = String(req.query.includeInactive || "false") === "true";
    const filter = includeInactive ? {} : { isActive: true };
    if (req.query.programId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.programId)) {
        return res.status(400).json({ message: "Invalid program id" });
      }
      filter.program = req.query.programId;
    }

    const sessions = await AcademicSession.find(filter)
      .populate("program", "name code")
      .sort({ createdAt: -1 });
    res.json(sessions);
  } catch (error) {
    next(error);
  }
});

router.post("/sessions", async (req, res, next) => {
  try {
    const programId = normalizeText(req.body.programId);
    const label = normalizeText(req.body.label);

    if (!mongoose.Types.ObjectId.isValid(programId)) {
      return res.status(400).json({ message: "Valid program is required" });
    }
    if (!label) {
      return res.status(400).json({ message: "Session label is required" });
    }

    const program = await AcademicProgram.findOne({ _id: programId, isActive: true });
    if (!program) {
      return res.status(404).json({ message: "Active program not found" });
    }

    const duplicate = await AcademicSession.findOne({
      program: programId,
      isActive: true,
      $expr: {
        $eq: [{ $toLower: "$label" }, normalizeLower(label)],
      },
    });
    if (duplicate) {
      return res.status(409).json({ message: "Session already exists for this program" });
    }

    const created = await AcademicSession.create({
      program: programId,
      label,
    });
    const populated = await created.populate("program", "name code");
    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
});

router.patch("/sessions/:id", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid session id" });
    }

    const session = await AcademicSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    const nextLabel = normalizeText(req.body.label || session.label);
    if (!nextLabel) {
      return res.status(400).json({ message: "Session label is required" });
    }

    const duplicate = await AcademicSession.findOne({
      _id: { $ne: session._id },
      program: session.program,
      isActive: true,
      $expr: {
        $eq: [{ $toLower: "$label" }, normalizeLower(nextLabel)],
      },
    });
    if (duplicate) {
      return res.status(409).json({ message: "Session already exists for this program" });
    }

    session.label = nextLabel;
    await session.save();
    const populated = await session.populate("program", "name code");
    res.json(populated);
  } catch (error) {
    next(error);
  }
});

router.delete("/sessions/:id", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid session id" });
    }

    const session = await AcademicSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    session.isActive = false;
    await session.save();
    await AcademicBranch.updateMany({ session: session._id }, { $set: { isActive: false } });
    await AcademicSubject.updateMany({ session: session._id }, { $set: { isActive: false } });

    res.json({ message: "Session deactivated" });
  } catch (error) {
    next(error);
  }
});

router.get("/branches", async (req, res, next) => {
  try {
    const includeInactive = String(req.query.includeInactive || "false") === "true";
    const filter = includeInactive ? {} : { isActive: true };

    if (req.query.programId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.programId)) {
        return res.status(400).json({ message: "Invalid program id" });
      }
      filter.program = req.query.programId;
    }
    if (req.query.sessionId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.sessionId)) {
        return res.status(400).json({ message: "Invalid session id" });
      }
      filter.session = req.query.sessionId;
    }

    const branches = await AcademicBranch.find(filter)
      .populate("program", "name code")
      .populate("session", "label")
      .sort({ name: 1 });
    res.json(branches);
  } catch (error) {
    next(error);
  }
});

router.post("/branches", async (req, res, next) => {
  try {
    const programId = normalizeText(req.body.programId);
    const sessionId = normalizeText(req.body.sessionId);
    const name = normalizeText(req.body.name);
    const code = normalizeText(req.body.code).toUpperCase();

    if (!mongoose.Types.ObjectId.isValid(programId)) {
      return res.status(400).json({ message: "Valid program is required" });
    }
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ message: "Valid session is required" });
    }
    if (!name) {
      return res.status(400).json({ message: "Branch name is required" });
    }

    const program = await AcademicProgram.findOne({ _id: programId, isActive: true });
    if (!program) {
      return res.status(404).json({ message: "Active program not found" });
    }
    const session = await AcademicSession.findOne({
      _id: sessionId,
      program: programId,
      isActive: true,
    });
    if (!session) {
      return res.status(404).json({ message: "Active session not found for program" });
    }

    const duplicate = await AcademicBranch.findOne({
      program: programId,
      session: sessionId,
      isActive: true,
      $expr: {
        $eq: [{ $toLower: "$name" }, normalizeLower(name)],
      },
    });
    if (duplicate) {
      return res.status(409).json({
        message: "Branch already exists for selected program/session",
      });
    }

    const created = await AcademicBranch.create({
      program: programId,
      session: sessionId,
      name,
      code,
    });
    const populated = await created.populate([
      { path: "program", select: "name code" },
      { path: "session", select: "label" },
    ]);

    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
});

router.patch("/branches/:id", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid branch id" });
    }

    const branch = await AcademicBranch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ message: "Branch not found" });
    }

    const nextName = normalizeText(req.body.name || branch.name);
    const nextCode = normalizeText(
      typeof req.body.code === "undefined" ? branch.code : req.body.code
    ).toUpperCase();

    if (!nextName) {
      return res.status(400).json({ message: "Branch name is required" });
    }

    const duplicate = await AcademicBranch.findOne({
      _id: { $ne: branch._id },
      program: branch.program,
      session: branch.session,
      isActive: true,
      $expr: {
        $eq: [{ $toLower: "$name" }, normalizeLower(nextName)],
      },
    });
    if (duplicate) {
      return res.status(409).json({
        message: "Branch already exists for selected program/session",
      });
    }

    branch.name = nextName;
    branch.code = nextCode;
    await branch.save();

    const populated = await branch.populate([
      { path: "program", select: "name code" },
      { path: "session", select: "label" },
    ]);
    res.json(populated);
  } catch (error) {
    next(error);
  }
});

router.delete("/branches/:id", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid branch id" });
    }

    const branch = await AcademicBranch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ message: "Branch not found" });
    }

    branch.isActive = false;
    await branch.save();
    await AcademicSubject.updateMany({ branch: branch._id }, { $set: { isActive: false } });
    res.json({ message: "Branch deactivated" });
  } catch (error) {
    next(error);
  }
});

router.get("/subjects", async (req, res, next) => {
  try {
    const includeInactive = String(req.query.includeInactive || "false") === "true";
    const filter = includeInactive ? {} : { isActive: true };

    const branchId = normalizeText(req.query.branchId);
    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({ message: "Valid branch is required" });
    }
    filter.branch = branchId;

    const semester = parseSemester(req.query.semester);
    if (!Number.isInteger(semester) || semester < 1 || semester > 8) {
      return res.status(400).json({ message: "Semester must be between 1 and 8" });
    }
    filter.semester = semester;

    const subjects = await AcademicSubject.find(filter)
      .populate("program", "name code")
      .populate("session", "label")
      .populate("branch", "name code")
      .sort({ name: 1 });

    res.json(subjects);
  } catch (error) {
    next(error);
  }
});

router.post("/subjects", async (req, res, next) => {
  try {
    const programId = normalizeText(req.body.programId);
    const sessionId = normalizeText(req.body.sessionId);
    const branchId = normalizeText(req.body.branchId);
    const semester = parseSemester(req.body.semester);
    const name = normalizeText(req.body.name);
    const code = normalizeText(req.body.code).toUpperCase();

    if (!mongoose.Types.ObjectId.isValid(programId)) {
      return res.status(400).json({ message: "Valid program is required" });
    }
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ message: "Valid session is required" });
    }
    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({ message: "Valid branch is required" });
    }
    if (!Number.isInteger(semester) || semester < 1 || semester > 8) {
      return res.status(400).json({ message: "Semester must be between 1 and 8" });
    }
    if (!name) {
      return res.status(400).json({ message: "Subject name is required" });
    }

    const branch = await AcademicBranch.findOne({
      _id: branchId,
      program: programId,
      session: sessionId,
      isActive: true,
    });
    if (!branch) {
      return res.status(404).json({ message: "Active branch not found for selected scope" });
    }

    const duplicate = await AcademicSubject.findOne({
      program: programId,
      session: sessionId,
      branch: branchId,
      semester,
      isActive: true,
      $expr: {
        $eq: [{ $toLower: "$name" }, normalizeLower(name)],
      },
    });
    if (duplicate) {
      return res.status(409).json({
        message: "Subject already exists for selected branch and semester",
      });
    }

    const created = await AcademicSubject.create({
      program: programId,
      session: sessionId,
      branch: branchId,
      semester,
      name,
      code,
    });
    const populated = await created.populate([
      { path: "program", select: "name code" },
      { path: "session", select: "label" },
      { path: "branch", select: "name code" },
    ]);

    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
});

router.patch("/subjects/:id", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid subject id" });
    }

    const subject = await AcademicSubject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ message: "Subject not found" });
    }

    const nextName = normalizeText(req.body.name || subject.name);
    const nextCode = normalizeText(
      typeof req.body.code === "undefined" ? subject.code : req.body.code
    ).toUpperCase();
    const nextSemesterRaw =
      typeof req.body.semester === "undefined" ? subject.semester : req.body.semester;
    const nextSemester = parseSemester(nextSemesterRaw);

    if (!nextName) {
      return res.status(400).json({ message: "Subject name is required" });
    }
    if (!Number.isInteger(nextSemester) || nextSemester < 1 || nextSemester > 8) {
      return res.status(400).json({ message: "Semester must be between 1 and 8" });
    }

    const duplicate = await AcademicSubject.findOne({
      _id: { $ne: subject._id },
      program: subject.program,
      session: subject.session,
      branch: subject.branch,
      semester: nextSemester,
      isActive: true,
      $expr: {
        $eq: [{ $toLower: "$name" }, normalizeLower(nextName)],
      },
    });
    if (duplicate) {
      return res.status(409).json({
        message: "Subject already exists for selected branch and semester",
      });
    }

    subject.name = nextName;
    subject.code = nextCode;
    subject.semester = nextSemester;
    await subject.save();

    const populated = await subject.populate([
      { path: "program", select: "name code" },
      { path: "session", select: "label" },
      { path: "branch", select: "name code" },
    ]);

    res.json(populated);
  } catch (error) {
    next(error);
  }
});

router.delete("/subjects/:id", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid subject id" });
    }

    const subject = await AcademicSubject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ message: "Subject not found" });
    }

    subject.isActive = false;
    await subject.save();

    res.json({ message: "Subject deactivated" });
  } catch (error) {
    next(error);
  }
});

router.get("/summary", async (req, res, next) => {
  try {
    const filter = { isActive: true };
    if (req.query.programId && mongoose.Types.ObjectId.isValid(req.query.programId)) {
      filter.program = req.query.programId;
    }
    if (req.query.sessionId && mongoose.Types.ObjectId.isValid(req.query.sessionId)) {
      filter.session = req.query.sessionId;
    }

    const totalPrograms = await AcademicProgram.countDocuments({ isActive: true });
    const totalSessions = await AcademicSession.countDocuments({ isActive: true });
    const totalBranches = await AcademicBranch.countDocuments(filter);
    const totalSubjects = await AcademicSubject.countDocuments(filter);

    res.json({ totalPrograms, totalSessions, totalBranches, totalSubjects });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
