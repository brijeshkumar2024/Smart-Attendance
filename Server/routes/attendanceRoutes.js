const express = require("express");
const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const Class = require("../models/Class");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const authMiddleware = require("../config/authMiddleware");
const roleMiddleware = require("../config/roleMiddleware");
const {
  getLowAttendance,
  bulkMarkAttendance,
  exportAttendanceCSV,
  exportAttendancePDF,
  getMonthlyReport,
} = require("../controllers/attendanceController");
const { getIO } = require("../config/socket");
const { sendLowAttendanceEmail } = require("../utils/notifications");
const {
  normalizeDate,
  getTeacherClassIds,
  isTeacherAuthorizedForClass,
} = require("../utils/teacherClassAccess");

const router = express.Router();

const LOCK_DAYS = 3;

const getDiffDays = (oldDate, newDate = new Date()) => {
  const old = new Date(oldDate);
  old.setHours(0, 0, 0, 0);
  const current = new Date(newDate);
  current.setHours(0, 0, 0, 0);
  return (current - old) / (1000 * 60 * 60 * 24);
};

const emitAttendanceChange = (payload) => {
  const io = getIO();
  if (io) {
    io.emit("attendance:changed", {
      ...payload,
      at: new Date().toISOString(),
    });
  }
};

const createAuditLog = async ({ action, attendanceId = null, performedBy, details = {} }) => {
  try {
    await AuditLog.create({
      action,
      attendanceId,
      performedBy,
      details,
    });
  } catch (error) {
    console.error("Audit log failed:", error.message);
  }
};

const refreshStudentFlags = async (studentId) => {
  const total = await Attendance.countDocuments({ student: studentId });
  const present = await Attendance.countDocuments({ student: studentId, status: "Present" });
  const percentage = total === 0 ? 0 : Number(((present / total) * 100).toFixed(2));
  const isLowAttendance = percentage < 75;

  await Attendance.updateMany(
    { student: studentId },
    { $set: { isLowAttendance } }
  );

  if (percentage < 60) {
    const student = await User.findById(studentId).select("email name");
    if (student) {
      await sendLowAttendanceEmail({
        toEmail: student.email,
        name: student.name,
        percentage,
      });
    }
  }

  return { total, present, percentage, isLowAttendance };
};

router.get(
  "/low-attendance",
  authMiddleware,
  roleMiddleware("admin", "teacher"),
  getLowAttendance
);

router.post(
  "/",
  authMiddleware,
  roleMiddleware("teacher", "admin"),
  async (req, res, next) => {
    try {
      const { studentId, classId, date, status } = req.body;
      const classInput = typeof classId === "string" ? classId.trim() : classId;
      const attendanceDate = normalizeDate(date);
      if (!attendanceDate) {
        return res.status(400).json({ message: "Valid date is required" });
      }

      let foundClass = null;
      if (mongoose.Types.ObjectId.isValid(classInput)) {
        foundClass = await Class.findById(classInput);
      }

      if (!foundClass && typeof classInput === "string" && classInput.length) {
        foundClass = await Class.findOne({ className: classInput });
      }

      if (!foundClass) {
        res.status(404);
        throw new Error("Class not found (use valid Class ID or exact class name)");
      }

      if (req.user.role === "teacher") {
        const canMark = await isTeacherAuthorizedForClass({
          teacherId: req.user.id,
          classDoc: foundClass,
          date: attendanceDate,
        });
        if (!canMark) {
          res.status(403);
          throw new Error("Not authorized for this class on selected date");
        }
      }

      const student = await User.findById(studentId).select("role isActive");
      if (!student || student.role !== "student") {
        res.status(404);
        throw new Error("Student not found");
      }
      if (!student.isActive) {
        return res.status(403).json({
          message:
            "Student is inactive. Admin must activate student account before attendance can be marked.",
        });
      }

      const attendance = new Attendance({
        student: studentId,
        class: foundClass._id,
        date: attendanceDate,
        status,
        updatedBy: req.user.id,
      });

      const savedAttendance = await attendance.save();
      const metrics = await refreshStudentFlags(studentId);

      await createAuditLog({
        action: "mark",
        attendanceId: savedAttendance._id,
        performedBy: req.user.id,
        details: { classId: foundClass._id, studentId, status },
      });

      emitAttendanceChange({
        action: "mark",
        attendanceId: savedAttendance._id,
        classId: foundClass._id,
        studentId,
        percentage: metrics.percentage,
      });

      res.status(201).json(savedAttendance);
    } catch (error) {
      if (error?.code === 11000) {
        res.status(409);
        return next(new Error("Attendance already marked for this student/class/date"));
      }
      next(error);
    }
  }
);

router.post(
  "/bulk",
  authMiddleware,
  roleMiddleware("teacher"),
  bulkMarkAttendance
);

router.get(
  "/monthly",
  authMiddleware,
  roleMiddleware("admin", "teacher", "student"),
  getMonthlyReport
);

router.get(
  "/ranking",
  authMiddleware,
  roleMiddleware("admin", "teacher"),
  async (req, res, next) => {
    try {
      const match = {};
      const classFilter = {};
      const programId = String(req.query.programId || "").trim();
      const sessionId = String(req.query.sessionId || "").trim();
      const branchId = String(req.query.branchId || "").trim();
      const semesterRaw = String(req.query.semester || "").trim();
      const groupLabel = String(req.query.groupLabel || "").trim();
      const subject = String(req.query.subject || "").trim();

      if (programId) {
        if (!mongoose.Types.ObjectId.isValid(programId)) {
          return res.status(400).json({ message: "Invalid program filter" });
        }
        classFilter.program = programId;
      }
      if (sessionId) {
        if (!mongoose.Types.ObjectId.isValid(sessionId)) {
          return res.status(400).json({ message: "Invalid session filter" });
        }
        classFilter.session = sessionId;
      }
      if (branchId) {
        if (!mongoose.Types.ObjectId.isValid(branchId)) {
          return res.status(400).json({ message: "Invalid branch filter" });
        }
        classFilter.branch = branchId;
      }
      if (semesterRaw) {
        const semester = Number.parseInt(semesterRaw, 10);
        if (!Number.isInteger(semester) || semester < 1 || semester > 8) {
          return res.status(400).json({ message: "Semester must be between 1 and 8" });
        }
        classFilter.academicSemester = semester;
      }
      if (groupLabel) {
        classFilter.groupLabel = groupLabel;
      }
      if (subject) {
        classFilter.subject = subject;
      }

      let scopedClassIds = null;
      if (Object.keys(classFilter).length > 0) {
        const classes = await Class.find(classFilter).select("_id");
        scopedClassIds = classes.map((entry) => entry._id.toString());
      }

      if (req.user.role === "teacher") {
        const teacherClassIds = await getTeacherClassIds(req.user.id, {
          includeAllOverrides: true,
        });
        const filteredClassIds = scopedClassIds
          ? teacherClassIds.filter((id) => scopedClassIds.includes(id.toString()))
          : teacherClassIds;
        match.class = {
          $in: filteredClassIds.map((id) => new mongoose.Types.ObjectId(id)),
        };
      } else if (scopedClassIds) {
        match.class = {
          $in: scopedClassIds.map((id) => new mongoose.Types.ObjectId(id)),
        };
      }

      const ranking = await Attendance.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$student",
            totalClasses: { $sum: 1 },
            present: {
              $sum: {
                $cond: [{ $eq: ["$status", "Present"] }, 1, 0],
              },
            },
          },
        },
        {
          $addFields: {
            percentage: {
              $round: [
                {
                  $multiply: [{ $divide: ["$present", "$totalClasses"] }, 100],
                },
                2,
              ],
            },
          },
        },
        { $sort: { percentage: -1 } },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "student",
          },
        },
        { $unwind: "$student" },
        {
          $project: {
            _id: 0,
            studentId: "$student._id",
            name: "$student.name",
            email: "$student.email",
            totalClasses: 1,
            present: 1,
            percentage: 1,
            isLowAttendance: { $lt: ["$percentage", 75] },
          },
        },
      ]);

      const withRank = ranking.map((item, index) => ({
        rank: index + 1,
        ...item,
      }));

      res.json(withRank);
    } catch (error) {
      next(error);
    }
  }
);

router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const { start, end, classId } = req.query;
    const filter = {};
    let startDate = null;
    let endDate = null;

    if (start && end) {
      startDate = normalizeDate(start);
      endDate = normalizeDate(end);
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Invalid start or end date" });
      }
      endDate.setHours(23, 59, 59, 999);
      filter.date = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    let attendance;

    if (req.user.role === "admin") {
      if (classId && mongoose.Types.ObjectId.isValid(classId)) {
        filter.class = classId;
      }

      attendance = await Attendance.find(filter)
        .populate("student", "name email")
        .populate("class", "className subject teacher");
    } else if (req.user.role === "teacher") {
      const classIds = await getTeacherClassIds(req.user.id, {
        start: startDate,
        end: endDate,
        includeAllOverrides: !startDate || !endDate,
      });

      let teacherClassFilter = classIds;
      if (classId && mongoose.Types.ObjectId.isValid(classId)) {
        teacherClassFilter = classIds.includes(classId) ? [classId] : [];
      }

      attendance = await Attendance.find({
        ...filter,
        class: { $in: teacherClassFilter },
      })
        .populate("student", "name email")
        .populate("class", "className subject teacher");
    } else {
      if (classId && mongoose.Types.ObjectId.isValid(classId)) {
        filter.class = classId;
      }

      attendance = await Attendance.find({
        ...filter,
        student: req.user.id,
      }).populate("class", "className subject teacher");
    }

    res.json(attendance);
  } catch (error) {
    next(error);
  }
});

router.get("/class-wise-percentage", authMiddleware, async (req, res, next) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Access denied" });
    }

    const records = await Attendance.find({ student: req.user.id }).populate(
      "class",
      "className subject"
    );

    const grouped = {};

    records.forEach((record) => {
      if (!record.class) {
        return;
      }

      const classId = record.class._id.toString();

      if (!grouped[classId]) {
        grouped[classId] = {
          className: record.class.className,
          subject: record.class.subject,
          total: 0,
          present: 0,
        };
      }

      grouped[classId].total += 1;
      if (record.status === "Present") {
        grouped[classId].present += 1;
      }
    });

    const result = Object.values(grouped).map((item) => ({
      className: item.className,
      subject: item.subject,
      totalClasses: item.total,
      present: item.present,
      percentage:
        item.total === 0 ? 0 : Number(((item.present / item.total) * 100).toFixed(2)),
      isLowAttendance:
        item.total === 0 ? false : Number(((item.present / item.total) * 100).toFixed(2)) < 75,
    }));

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get(
  "/export-csv",
  authMiddleware,
  roleMiddleware("admin"),
  exportAttendanceCSV
);

router.get(
  "/export-pdf",
  authMiddleware,
  roleMiddleware("admin"),
  exportAttendancePDF
);

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("teacher", "admin"),
  async (req, res, next) => {
    try {
      const { status } = req.body;
      const attendance = await Attendance.findById(req.params.id).populate("class");

      if (!attendance) {
        res.status(404);
        throw new Error("Attendance record not found");
      }

      if (req.user.role === "teacher") {
        const canUpdate = await isTeacherAuthorizedForClass({
          teacherId: req.user.id,
          classDoc: attendance.class,
          date: attendance.date,
        });
        if (!canUpdate) {
          res.status(403);
          throw new Error("Not authorized to update this record");
        }
      }

      const diffDays = getDiffDays(attendance.date);
      if (diffDays > LOCK_DAYS) {
        return res.status(403).json({
          message: `Attendance locked after ${LOCK_DAYS} days`,
        });
      }

      attendance.status = status;
      attendance.updatedBy = req.user.id;
      const updated = await attendance.save();
      const metrics = await refreshStudentFlags(updated.student);

      await createAuditLog({
        action: "update",
        attendanceId: updated._id,
        performedBy: req.user.id,
        details: { status },
      });

      emitAttendanceChange({
        action: "update",
        attendanceId: updated._id,
        classId: updated.class,
        studentId: updated.student,
        percentage: metrics.percentage,
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("teacher", "admin"),
  async (req, res, next) => {
    try {
      const attendance = await Attendance.findById(req.params.id).populate("class");

      if (!attendance) {
        return res.status(404).json({ message: "Attendance not found" });
      }

      if (req.user.role === "teacher") {
        const canDelete = await isTeacherAuthorizedForClass({
          teacherId: req.user.id,
          classDoc: attendance.class,
          date: attendance.date,
        });
        if (!canDelete) {
          return res.status(403).json({ message: "Not authorized to delete this record" });
        }
      }

      const diffDays = getDiffDays(attendance.date);
      if (diffDays > LOCK_DAYS) {
        return res.status(403).json({
          message: `Attendance locked after ${LOCK_DAYS} days`,
        });
      }

      const studentId = attendance.student;
      const classId = attendance.class._id;
      await attendance.deleteOne();
      const metrics = await refreshStudentFlags(studentId);

      await createAuditLog({
        action: "delete",
        attendanceId: attendance._id,
        performedBy: req.user.id,
        details: { studentId, classId },
      });

      emitAttendanceChange({
        action: "delete",
        attendanceId: attendance._id,
        classId,
        studentId,
        percentage: metrics.percentage,
      });

      res.json({ message: "Attendance deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
);

router.get("/percentage/:studentId", authMiddleware, async (req, res) => {
  try {
    const { studentId } = req.params;

    if (req.user.role === "student" && req.user.id !== studentId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const total = await Attendance.countDocuments({ student: studentId });
    const present = await Attendance.countDocuments({
      student: studentId,
      status: "Present",
    });

    const percentage = total === 0 ? 0 : ((present / total) * 100).toFixed(2);

    res.json({
      totalClasses: total,
      present,
      percentage: Number(percentage),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/class-percentage/:studentId", authMiddleware, async (req, res, next) => {
  try {
    const { studentId } = req.params;

    if (req.user.role === "student" && req.user.id !== studentId) {
      res.status(403);
      throw new Error("Access denied");
    }

    const records = await Attendance.find({ student: studentId }).populate(
      "class",
      "className subject"
    );

    const grouped = {};

    records.forEach((record) => {
      if (!record.class) {
        return;
      }

      const classId = record.class._id.toString();

      if (!grouped[classId]) {
        grouped[classId] = {
          className: record.class.className,
          subject: record.class.subject,
          total: 0,
          present: 0,
        };
      }

      grouped[classId].total += 1;

      if (record.status === "Present") {
        grouped[classId].present += 1;
      }
    });

    const result = Object.values(grouped).map((item) => ({
      className: item.className,
      subject: item.subject,
      totalClasses: item.total,
      present: item.present,
      percentage:
        item.total === 0 ? 0 : Number(((item.present / item.total) * 100).toFixed(2)),
    }));

    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
