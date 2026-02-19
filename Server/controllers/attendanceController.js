const Attendance = require("../models/Attendance");
const Class = require("../models/Class");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const PDFDocument = require("pdfkit");
const mongoose = require("mongoose");
const {
  normalizeDate,
  getTeacherClassIds,
  isTeacherAuthorizedForClass,
} = require("../utils/teacherClassAccess");

const getLowAttendance = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 75;

    const result = await Attendance.aggregate([
      {
        $group: {
          _id: "$student",
          totalClasses: { $sum: 1 },
          present: {
            $sum: {
              $cond: [{ $eq: ["$status", "Present"] }, 1, 0]
            }
          }
        }
      },
      {
        $addFields: {
          percentage: {
            $round: [
              {
                $multiply: [
                  { $divide: ["$present", "$totalClasses"] },
                  100
                ]
              },
              2
            ]
          }
        }
      },
      {
        $match: {
          percentage: { $lt: limit }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "student"
        }
      },
      {
        $unwind: "$student"
      },
      {
        $match: {
          "student.role": "student",
          "student.isActive": true,
        },
      },
      {
        $project: {
          _id: 0,
          studentId: "$student._id",
          name: "$student.name",
          email: "$student.email",
          totalClasses: 1,
          present: 1,
          percentage: 1
        }
      },
      {
        $sort: { percentage: 1 }
      }
    ]);

    res.json(result);
  } catch (error) {
    next(error);
  }
};

const deleteAttendance = async (req, res, next) => {
  try {
    const attendance = await Attendance.findById(req.params.id).populate("class");

    if (!attendance) {
      return res.status(404).json({ message: "Attendance not found" });
    }

    if (
      req.user.role === "teacher" &&
      attendance.class.teacher.toString() !== req.user.id
    ) {
      return res.status(403).json({ message: "Not authorized to delete this record" });
    }

    await attendance.deleteOne();

    res.json({ message: "Attendance deleted successfully" });

  } catch (error) {
    next(error);
  }
};

const bulkMarkAttendance = async (req, res, next) => {
  try {
    const { classId, date, attendance } = req.body;

    if (!classId || !date || !attendance?.length) {
      return res.status(400).json({ message: "Invalid data" });
    }

    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({ message: "Valid class is required" });
    }

    const attendanceDate = normalizeDate(date);
    if (!attendanceDate) {
      return res.status(400).json({ message: "Valid date is required" });
    }

    const uniqueStudentIds = Array.from(
      new Set(attendance.map((entry) => String(entry.studentId || "").trim()).filter(Boolean))
    );

    if (
      uniqueStudentIds.length === 0 ||
      uniqueStudentIds.some((id) => !mongoose.Types.ObjectId.isValid(id))
    ) {
      return res.status(400).json({ message: "Valid student IDs are required" });
    }

    const activeStudents = await User.find({
      _id: { $in: uniqueStudentIds },
      role: "student",
      isActive: true,
    }).select("_id");

    const activeStudentIds = new Set(activeStudents.map((entry) => entry._id.toString()));
    const blockedStudentIds = uniqueStudentIds.filter((id) => !activeStudentIds.has(id));
    if (blockedStudentIds.length > 0) {
      return res.status(403).json({
        message:
          "One or more students are inactive. Admin must activate student account before attendance can be marked.",
      });
    }

    const foundClass = await Class.findById(classId);
    if (!foundClass) {
      return res.status(404).json({ message: "Class not found" });
    }

    const canMark = await isTeacherAuthorizedForClass({
      teacherId: req.user.id,
      classDoc: foundClass,
      date: attendanceDate,
    });
    if (!canMark) {
      return res.status(403).json({ message: "Not authorized for this class on selected date" });
    }

    const operations = attendance.map((entry) => ({
      updateOne: {
        filter: {
          student: entry.studentId,
          class: foundClass._id,
          date: attendanceDate,
        },
        update: {
          $set: {
            status: entry.status === "Absent" ? "Absent" : "Present",
            markedBy: req.user.id,
            updatedBy: req.user.id,
          },
          $setOnInsert: {
            student: entry.studentId,
            class: foundClass._id,
            date: attendanceDate,
          },
        },
        upsert: true,
      },
    }));

    const bulkResult = await Attendance.bulkWrite(operations, { ordered: false });

    await AuditLog.create({
      action: "bulk_mark",
      performedBy: req.user.id,
      details: {
        classId: foundClass._id,
        date: attendanceDate,
        matchedCount: bulkResult.matchedCount,
        modifiedCount: bulkResult.modifiedCount,
        upsertedCount: bulkResult.upsertedCount,
      },
    });

    res.status(201).json({
      message: "Bulk attendance marked successfully",
      matchedCount: bulkResult.matchedCount,
      modifiedCount: bulkResult.modifiedCount,
      upsertedCount: bulkResult.upsertedCount,
    });

  } catch (error) {
    next(error);
  }
};

const exportAttendanceCSV = async (req, res, next) => {
  try {
    const records = await Attendance.find()
      .populate("student", "name email")
      .populate("class", "className subject");

    let csv = "Student,Email,Class,Subject,Date,Status\n";

    records.forEach((r) => {
      csv += `${r.student?.name || ""},${r.student?.email || ""},${r.class?.className || ""},${r.class?.subject || ""},${r.date.toISOString().split("T")[0]},${r.status}\n`;
    });

    res.header("Content-Type", "text/csv");
    res.attachment("attendance.csv");
    return res.send(csv);
  } catch (error) {
    next(error);
  }
};

const exportAttendancePDF = async (req, res, next) => {
  try {
    const records = await Attendance.find()
      .populate("student", "name email")
      .populate("class", "className subject")
      .sort({ date: -1 });

    const doc = new PDFDocument({ margin: 36, size: "A4" });

    res.header("Content-Type", "application/pdf");
    res.attachment("attendance.pdf");

    doc.pipe(res);

    doc.fontSize(18).text("Attendance Report", { align: "center" });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .fillColor("#666")
      .text(`Generated: ${new Date().toISOString().split("T")[0]}`, { align: "right" })
      .fillColor("#000");
    doc.moveDown(0.7);

    doc
      .fontSize(10)
      .text("Student", 36, doc.y, { continued: true, width: 90 })
      .text("Email", { continued: true, width: 130 })
      .text("Class", { continued: true, width: 80 })
      .text("Subject", { continued: true, width: 90 })
      .text("Date", { continued: true, width: 65 })
      .text("Status");

    doc.moveTo(36, doc.y + 4).lineTo(559, doc.y + 4).strokeColor("#dddddd").stroke();
    doc.moveDown(0.6);

    records.forEach((r) => {
      if (doc.y > 760) {
        doc.addPage();
      }

      doc
        .fontSize(9)
        .text(r.student?.name || "-", 36, doc.y, { continued: true, width: 90 })
        .text(r.student?.email || "-", { continued: true, width: 130 })
        .text(r.class?.className || "-", { continued: true, width: 80 })
        .text(r.class?.subject || "-", { continued: true, width: 90 })
        .text(r.date ? r.date.toISOString().split("T")[0] : "-", {
          continued: true,
          width: 65,
        })
        .text(r.status || "-");
      doc.moveDown(0.4);
    });

    doc.end();
  } catch (error) {
    next(error);
  }
};

const getMonthlyReport = async (req, res, next) => {
  try {
    const month = parseInt(req.query.month, 10);
    const year = parseInt(req.query.year, 10);
    const { classId, studentId } = req.query;

    if (!month || !year || month < 1 || month > 12) {
      return res.status(400).json({ message: "Month and year required" });
    }

    const matchFilter = {};
    const monthStart = new Date(year, month - 1, 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(year, month, 0);
    monthEnd.setHours(23, 59, 59, 999);

    if (req.user.role === "student") {
      matchFilter.student = new mongoose.Types.ObjectId(req.user.id);
    } else if (req.user.role === "teacher") {
      let classIds = await getTeacherClassIds(req.user.id, {
        start: monthStart,
        end: monthEnd,
      });

      if (classId && mongoose.Types.ObjectId.isValid(classId)) {
        classIds = classIds.filter((id) => id.toString() === classId.toString());
      }

      matchFilter.class = {
        $in: classIds.map((id) => new mongoose.Types.ObjectId(id)),
      };

      if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
        matchFilter.student = new mongoose.Types.ObjectId(studentId);
      }
    } else {
      if (classId && mongoose.Types.ObjectId.isValid(classId)) {
        matchFilter.class = new mongoose.Types.ObjectId(classId);
      }

      if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
        matchFilter.student = new mongoose.Types.ObjectId(studentId);
      }
    }

    const result = await Attendance.aggregate([
      {
        $match: {
          ...matchFilter,
          $expr: {
            $and: [
              { $eq: [{ $month: "$date" }, month] },
              { $eq: [{ $year: "$date" }, year] },
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
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
    ]);

    res.json({
      month,
      year,
      ...(result[0] || {
        totalClasses: 0,
        present: 0,
        percentage: 0,
      }),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLowAttendance,
  deleteAttendance,
  bulkMarkAttendance,
  exportAttendanceCSV,
  exportAttendancePDF,
  getMonthlyReport,
};
