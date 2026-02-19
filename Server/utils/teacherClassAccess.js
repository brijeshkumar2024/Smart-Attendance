const Class = require("../models/Class");
const ClassTeacherOverride = require("../models/ClassTeacherOverride");

const normalizeDate = (value = new Date()) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const buildOverrideDateFilter = ({ start, end, date, includeAllOverrides = false }) => {
  if (includeAllOverrides) {
    return {};
  }

  if (start && end) {
    const startDate = normalizeDate(start);
    const endDate = normalizeDate(end);
    if (!startDate || !endDate) {
      return null;
    }
    return { date: { $gte: startDate, $lte: endDate } };
  }

  const exactDate = normalizeDate(date || new Date());
  if (!exactDate) {
    return null;
  }
  return { date: exactDate };
};

const getTeacherClassIds = async (
  teacherId,
  { start, end, date, includeAllOverrides = false } = {}
) => {
  const [permanentClasses, overrideClasses] = await Promise.all([
    Class.find({ teacher: teacherId }).select("_id"),
    (async () => {
      const dateFilter = buildOverrideDateFilter({ start, end, date, includeAllOverrides });
      if (dateFilter === null) {
        return [];
      }
      return ClassTeacherOverride.find({
        teacher: teacherId,
        ...dateFilter,
      }).select("class");
    })(),
  ]);

  const classIdSet = new Set(permanentClasses.map((entry) => entry._id.toString()));
  overrideClasses.forEach((entry) => {
    if (entry.class) {
      classIdSet.add(entry.class.toString());
    }
  });

  return Array.from(classIdSet);
};

const isTeacherAuthorizedForClass = async ({ teacherId, classDoc, date }) => {
  if (!classDoc) {
    return false;
  }

  if (classDoc.teacher && classDoc.teacher.toString() === teacherId.toString()) {
    return true;
  }

  const exactDate = normalizeDate(date || new Date());
  if (!exactDate) {
    return false;
  }

  const override = await ClassTeacherOverride.findOne({
    class: classDoc._id,
    teacher: teacherId,
    date: exactDate,
  }).select("_id");

  return Boolean(override);
};

module.exports = {
  normalizeDate,
  getTeacherClassIds,
  isTeacherAuthorizedForClass,
};
