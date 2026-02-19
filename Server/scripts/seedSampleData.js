const path = require("path");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const User = require("../models/User");
const Class = require("../models/Class");
const AcademicProgram = require("../models/AcademicProgram");
const AcademicSession = require("../models/AcademicSession");
const AcademicBranch = require("../models/AcademicBranch");
const AcademicSubject = require("../models/AcademicSubject");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findByName = async (Model, name, extraFilter = {}) =>
  Model.findOne({
    ...extraFilter,
    name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
  });

const findByLabel = async (Model, label, extraFilter = {}) =>
  Model.findOne({
    ...extraFilter,
    label: { $regex: `^${escapeRegex(label)}$`, $options: "i" },
  });

const upsertUser = async ({ name, email, role, subject = "", passwordHash }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    existing.name = name;
    existing.role = role;
    existing.subject = role === "teacher" ? subject : "";
    existing.password = passwordHash;
    existing.isActive = true;
    await existing.save();
    return existing;
  }

  return User.create({
    name,
    email: normalizedEmail,
    role,
    subject: role === "teacher" ? subject : "",
    password: passwordHash,
    isActive: true,
  });
};

const upsertProgram = async ({ name, code, description = "" }) => {
  const existing = await findByName(AcademicProgram, name);
  if (existing) {
    existing.name = name;
    existing.code = code;
    existing.description = description;
    existing.isActive = true;
    await existing.save();
    return existing;
  }
  return AcademicProgram.create({
    name,
    code,
    description,
    isActive: true,
  });
};

const upsertSession = async ({ programId, label }) => {
  const existing = await findByLabel(AcademicSession, label, { program: programId });
  if (existing) {
    existing.label = label;
    existing.program = programId;
    existing.isActive = true;
    await existing.save();
    return existing;
  }
  return AcademicSession.create({
    program: programId,
    label,
    isActive: true,
  });
};

const upsertBranch = async ({ programId, sessionId, name, code = "" }) => {
  const existing = await findByName(AcademicBranch, name, {
    program: programId,
    session: sessionId,
  });
  if (existing) {
    existing.name = name;
    existing.code = code;
    existing.program = programId;
    existing.session = sessionId;
    existing.isActive = true;
    await existing.save();
    return existing;
  }
  return AcademicBranch.create({
    program: programId,
    session: sessionId,
    name,
    code,
    isActive: true,
  });
};

const upsertSubject = async ({
  programId,
  sessionId,
  branchId,
  semester,
  name,
  code = "",
}) => {
  const existing = await findByName(AcademicSubject, name, {
    program: programId,
    session: sessionId,
    branch: branchId,
    semester,
  });
  if (existing) {
    existing.name = name;
    existing.code = code;
    existing.program = programId;
    existing.session = sessionId;
    existing.branch = branchId;
    existing.semester = semester;
    existing.isActive = true;
    await existing.save();
    return existing;
  }
  return AcademicSubject.create({
    program: programId,
    session: sessionId,
    branch: branchId,
    semester,
    name,
    code,
    isActive: true,
  });
};

const buildClassName = ({ program, session, branch, semester, groupLabel }) => {
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

const upsertClassAllocation = async ({
  program,
  session,
  branch,
  subject,
  semester,
  groupLabel,
  teacherId,
}) => {
  const scopeFilter = {
    program: program._id,
    session: session._id,
    branch: branch._id,
    subjectRef: subject._id,
    academicSemester: semester,
    groupLabel,
  };

  const existing = await Class.findOne(scopeFilter);
  const className = buildClassName({
    program,
    session,
    branch,
    semester,
    groupLabel,
  });

  if (existing) {
    existing.className = className;
    existing.subject = subject.name;
    existing.teacher = teacherId;
    await existing.save();
    return existing;
  }

  return Class.create({
    className,
    subject: subject.name,
    teacher: teacherId,
    semester: null,
    program: program._id,
    session: session._id,
    branch: branch._id,
    subjectRef: subject._id,
    academicSemester: semester,
    groupLabel,
  });
};

const seed = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in Server/.env");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const defaultPassword = "Welcome@123";
  const adminPassword = "Admin@123";
  const [defaultPasswordHash, adminPasswordHash] = await Promise.all([
    bcrypt.hash(defaultPassword, 10),
    bcrypt.hash(adminPassword, 10),
  ]);

  const adminUsers = [
    { name: "Super Admin", email: "admin@smartattendance.edu", role: "admin" },
    { name: "Dean Academics", email: "dean.academics@smartattendance.edu", role: "admin" },
  ];

  const teachersSeed = [
    { name: "Aarav Gupta", email: "aarav.gupta@smartattendance.edu", subject: "Mathematics" },
    { name: "Priya Sharma", email: "priya.sharma@smartattendance.edu", subject: "Programming" },
    { name: "Rahul Verma", email: "rahul.verma@smartattendance.edu", subject: "Data Structures" },
    { name: "Diya Nair", email: "diya.nair@smartattendance.edu", subject: "Physics" },
    { name: "Karan Mehta", email: "karan.mehta@smartattendance.edu", subject: "Electronics" },
    { name: "Sana Khan", email: "sana.khan@smartattendance.edu", subject: "Electrical" },
    { name: "Vivek Reddy", email: "vivek.reddy@smartattendance.edu", subject: "Mechanical" },
    { name: "Neha Iyer", email: "neha.iyer@smartattendance.edu", subject: "Management" },
  ];

  const [admins, teachers] = await Promise.all([
    Promise.all(
      adminUsers.map((entry) =>
        upsertUser({ ...entry, passwordHash: adminPasswordHash, subject: "" })
      )
    ),
    Promise.all(
      teachersSeed.map((entry) =>
        upsertUser({
          ...entry,
          role: "teacher",
          passwordHash: defaultPasswordHash,
        })
      )
    ),
  ]);

  const teacherByEmail = Object.fromEntries(teachers.map((entry) => [entry.email, entry]));

  const btech = await upsertProgram({
    name: "Bachelor of Technology",
    code: "BTECH",
    description: "4-year undergraduate engineering program",
  });
  await upsertProgram({
    name: "Master of Technology",
    code: "MTECH",
    description: "2-year postgraduate engineering program",
  });
  await upsertProgram({
    name: "Master of Business Administration",
    code: "MBA",
    description: "2-year postgraduate management program",
  });

  const btechSession = await upsertSession({
    programId: btech._id,
    label: "2023-27",
  });

  const cseBranch = await upsertBranch({
    programId: btech._id,
    sessionId: btechSession._id,
    name: "Computer Science and Engineering",
    code: "CSE",
  });
  const eceBranch = await upsertBranch({
    programId: btech._id,
    sessionId: btechSession._id,
    name: "Electronics and Communication Engineering",
    code: "ECE",
  });
  const meBranch = await upsertBranch({
    programId: btech._id,
    sessionId: btechSession._id,
    name: "Mechanical Engineering",
    code: "ME",
  });

  const subjects = {};
  const addSubject = async (branch, semester, name, code) => {
    const key = `${branch.code}-${semester}-${code}`;
    subjects[key] = await upsertSubject({
      programId: btech._id,
      sessionId: btechSession._id,
      branchId: branch._id,
      semester,
      name,
      code,
    });
  };

  await Promise.all([
    addSubject(cseBranch, 1, "Engineering Mathematics-I", "MA101"),
    addSubject(cseBranch, 1, "Applied Physics", "PH101"),
    addSubject(cseBranch, 1, "Programming Fundamentals", "CS101"),
    addSubject(cseBranch, 3, "Data Structures", "CS201"),
    addSubject(cseBranch, 3, "Object Oriented Programming", "CS202"),
    addSubject(cseBranch, 3, "Discrete Mathematics", "MA201"),
    addSubject(eceBranch, 1, "Engineering Mathematics-I", "MA101"),
    addSubject(eceBranch, 1, "Basic Electronics", "EC101"),
    addSubject(eceBranch, 1, "Electrical Circuits", "EE101"),
    addSubject(meBranch, 1, "Engineering Mathematics-I", "MA101"),
    addSubject(meBranch, 1, "Engineering Mechanics", "ME101"),
    addSubject(meBranch, 1, "Workshop Technology", "ME102"),
  ]);

  const studentEntries = [];
  const buildStudentsForBranch = (prefix, count) => {
    for (let index = 1; index <= count; index += 1) {
      const serial = String(index).padStart(2, "0");
      studentEntries.push({
        name: `${prefix} Student ${serial}`,
        email: `${prefix.toLowerCase()}.student${serial}@smartattendance.edu`,
        role: "student",
      });
    }
  };

  buildStudentsForBranch("CSE", 12);
  buildStudentsForBranch("ECE", 12);
  buildStudentsForBranch("ME", 12);

  await Promise.all(
    studentEntries.map((entry) =>
      upsertUser({
        ...entry,
        subject: "",
        passwordHash: defaultPasswordHash,
      })
    )
  );

  const classAllocations = [
    {
      subjectKey: "CSE-1-MA101",
      branch: cseBranch,
      semester: 1,
      groupLabel: "1",
      teacherEmail: "aarav.gupta@smartattendance.edu",
    },
    {
      subjectKey: "CSE-1-PH101",
      branch: cseBranch,
      semester: 1,
      groupLabel: "1",
      teacherEmail: "diya.nair@smartattendance.edu",
    },
    {
      subjectKey: "CSE-1-CS101",
      branch: cseBranch,
      semester: 1,
      groupLabel: "1",
      teacherEmail: "priya.sharma@smartattendance.edu",
    },
    {
      subjectKey: "CSE-1-MA101",
      branch: cseBranch,
      semester: 1,
      groupLabel: "2",
      teacherEmail: "aarav.gupta@smartattendance.edu",
    },
    {
      subjectKey: "CSE-1-PH101",
      branch: cseBranch,
      semester: 1,
      groupLabel: "2",
      teacherEmail: "diya.nair@smartattendance.edu",
    },
    {
      subjectKey: "CSE-1-CS101",
      branch: cseBranch,
      semester: 1,
      groupLabel: "2",
      teacherEmail: "priya.sharma@smartattendance.edu",
    },
    {
      subjectKey: "CSE-3-CS201",
      branch: cseBranch,
      semester: 3,
      groupLabel: "1",
      teacherEmail: "rahul.verma@smartattendance.edu",
    },
    {
      subjectKey: "CSE-3-CS202",
      branch: cseBranch,
      semester: 3,
      groupLabel: "1",
      teacherEmail: "priya.sharma@smartattendance.edu",
    },
    {
      subjectKey: "CSE-3-MA201",
      branch: cseBranch,
      semester: 3,
      groupLabel: "1",
      teacherEmail: "aarav.gupta@smartattendance.edu",
    },
    {
      subjectKey: "ECE-1-MA101",
      branch: eceBranch,
      semester: 1,
      groupLabel: "1",
      teacherEmail: "aarav.gupta@smartattendance.edu",
    },
    {
      subjectKey: "ECE-1-EC101",
      branch: eceBranch,
      semester: 1,
      groupLabel: "1",
      teacherEmail: "karan.mehta@smartattendance.edu",
    },
    {
      subjectKey: "ECE-1-EE101",
      branch: eceBranch,
      semester: 1,
      groupLabel: "1",
      teacherEmail: "sana.khan@smartattendance.edu",
    },
    {
      subjectKey: "ME-1-MA101",
      branch: meBranch,
      semester: 1,
      groupLabel: "1",
      teacherEmail: "aarav.gupta@smartattendance.edu",
    },
    {
      subjectKey: "ME-1-ME101",
      branch: meBranch,
      semester: 1,
      groupLabel: "1",
      teacherEmail: "vivek.reddy@smartattendance.edu",
    },
    {
      subjectKey: "ME-1-ME102",
      branch: meBranch,
      semester: 1,
      groupLabel: "1",
      teacherEmail: "vivek.reddy@smartattendance.edu",
    },
  ];

  for (const allocation of classAllocations) {
    const subject = subjects[allocation.subjectKey];
    const teacher = teacherByEmail[allocation.teacherEmail];
    if (!subject || !teacher) {
      // Ignore invalid mapping instead of aborting whole seed.
      continue;
    }
    await upsertClassAllocation({
      program: btech,
      session: btechSession,
      branch: allocation.branch,
      subject,
      semester: allocation.semester,
      groupLabel: allocation.groupLabel,
      teacherId: teacher._id,
    });
  }

  const totalUsers = await User.countDocuments({});
  const totalTeachers = await User.countDocuments({ role: "teacher", isActive: true });
  const totalStudents = await User.countDocuments({ role: "student", isActive: true });
  const totalPrograms = await AcademicProgram.countDocuments({ isActive: true });
  const totalSessions = await AcademicSession.countDocuments({ isActive: true });
  const totalBranches = await AcademicBranch.countDocuments({ isActive: true });
  const totalSubjects = await AcademicSubject.countDocuments({ isActive: true });
  const totalClasses = await Class.countDocuments({});

  console.log("\nSample data seeded successfully.");
  console.log(`Users: ${totalUsers} (teachers: ${totalTeachers}, students: ${totalStudents})`);
  console.log(
    `Programs: ${totalPrograms}, Sessions: ${totalSessions}, Branches: ${totalBranches}, Subjects: ${totalSubjects}`
  );
  console.log(`Class allocations: ${totalClasses}`);
  console.log("\nLogin credentials:");
  console.log("Admin -> admin@smartattendance.edu / Admin@123");
  console.log("Teacher -> aarav.gupta@smartattendance.edu / Welcome@123");
  console.log("Student -> cse.student01@smartattendance.edu / Welcome@123");
  console.log(`Additional admin accounts seeded: ${admins.length}`);
};

seed()
  .catch((error) => {
    console.error("Sample seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
