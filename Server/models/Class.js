const mongoose = require("mongoose");

const classSchema = new mongoose.Schema(
  {
    className: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    semester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Semester",
      default: null,
    },
    program: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicProgram",
      default: null,
    },
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
      default: null,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicBranch",
      default: null,
    },
    subjectRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSubject",
      default: null,
    },
    academicSemester: {
      type: Number,
      min: 1,
      max: 8,
      default: null,
    },
    groupLabel: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Class", classSchema);
