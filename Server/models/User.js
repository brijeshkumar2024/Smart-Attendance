const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      unique: true
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["admin", "teacher", "student"],
      default: "student"
    },
    teacherId: {
      type: String,
      trim: true,
      default: null
    },
    subject: {
      type: String,
      default: ""
    },
    program: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicProgram",
      default: null
    },
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
      default: null
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicBranch",
      default: null
    },
    semester: {
      type: Number,
      min: 1,
      max: 8,
      default: null
    },
    groupLabel: {
      type: String,
      trim: true,
      default: ""
    },
    subjectRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSubject",
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

userSchema.index(
  { teacherId: 1 },
  { unique: true, partialFilterExpression: { teacherId: { $type: "string" } } }
);

const User = mongoose.model("User", userSchema);

module.exports = User;
