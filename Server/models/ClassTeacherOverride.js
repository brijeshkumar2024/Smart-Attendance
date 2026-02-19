const mongoose = require("mongoose");

const classTeacherOverrideSchema = new mongoose.Schema(
  {
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

classTeacherOverrideSchema.pre("validate", function normalizeDateOnly(next) {
  if (this.date) {
    const normalized = new Date(this.date);
    normalized.setHours(0, 0, 0, 0);
    this.date = normalized;
  }
  next();
});

classTeacherOverrideSchema.index({ class: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("ClassTeacherOverride", classTeacherOverrideSchema);
