const Counter = require("../models/Counter");

const TEACHER_COUNTER_KEY = "teacher_id";
const TEACHER_ID_PREFIX = "TCH";
const TEACHER_ID_PAD = 4;

const generateTeacherId = async () => {
  const counter = await Counter.findOneAndUpdate(
    { key: TEACHER_COUNTER_KEY },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return `${TEACHER_ID_PREFIX}${String(counter.seq).padStart(TEACHER_ID_PAD, "0")}`;
};

module.exports = { generateTeacherId };
