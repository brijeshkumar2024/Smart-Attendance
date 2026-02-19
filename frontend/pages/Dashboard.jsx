/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import { io } from "socket.io-client";
import StudentDashboard from "./StudentDashboard";
import AdminAcademicSetup from "../components/AdminAcademicSetup";
import { SOCKET_URL } from "../src/config";

const socket = io(SOCKET_URL, { autoConnect: false });

function Dashboard() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [lowAttendance, setLowAttendance] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [studentId, setStudentId] = useState("");
  const [date, setDate] = useState("");
  const [bulkDate, setBulkDate] = useState("");
  const [bulkRows, setBulkRows] = useState([]);
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);
  const [isBulkDateLocked, setIsBulkDateLocked] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState("success");
  const [filterDate, setFilterDate] = useState("");
  const [status, setStatus] = useState("Present");
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [users, setUsers] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [allocatedClasses, setAllocatedClasses] = useState([]);
  const [allocationForm, setAllocationForm] = useState({
    programId: "",
    sessionId: "",
    branchId: "",
    semester: "1",
    groupLabel: "1",
    subjectId: "",
    teacherId: "",
  });
  const [allocationPrograms, setAllocationPrograms] = useState([]);
  const [allocationSessions, setAllocationSessions] = useState([]);
  const [allocationBranches, setAllocationBranches] = useState([]);
  const [allocationSubjects, setAllocationSubjects] = useState([]);
  const [adminError, setAdminError] = useState("");
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(false);
  const [isLoadingAllocationPrograms, setIsLoadingAllocationPrograms] = useState(false);
  const [isLoadingAllocationSessions, setIsLoadingAllocationSessions] = useState(false);
  const [isLoadingAllocationBranches, setIsLoadingAllocationBranches] = useState(false);
  const [isLoadingAllocationSubjects, setIsLoadingAllocationSubjects] = useState(false);
  const [isLoadingLowAttendance, setIsLoadingLowAttendance] = useState(false);
  const [isLoadingRanking, setIsLoadingRanking] = useState(false);
  const [isAllocatingClass, setIsAllocatingClass] = useState(false);
  const [teacherError, setTeacherError] = useState("");
  const [isLoadingTeacherClasses, setIsLoadingTeacherClasses] = useState(false);
  const [isLoadingTeacherStudents, setIsLoadingTeacherStudents] = useState(false);
  const [isLoadingTeacherAttendance, setIsLoadingTeacherAttendance] = useState(false);
  const [isMarkingAttendance, setIsMarkingAttendance] = useState(false);
  const [isUpdatingAttendanceId, setIsUpdatingAttendanceId] = useState("");
  const [isDeletingAttendanceId, setIsDeletingAttendanceId] = useState("");
  const [teacherAttendanceSearch, setTeacherAttendanceSearch] = useState("");
  const [teacherStudentSearch, setTeacherStudentSearch] = useState("");
  const [teacherStudentGroupFilter, setTeacherStudentGroupFilter] = useState("all");
  const [rankingFilters, setRankingFilters] = useState({
    programId: "all",
    sessionId: "all",
    branchId: "all",
    semester: "all",
    groupLabel: "all",
    subject: "all",
  });
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/");
      return;
    }

    try {
      const decoded = jwtDecode(token);
      setUser(decoded);
    } catch {
      localStorage.removeItem("token");
      navigate("/");
    }
  }, [navigate]);

  useEffect(() => {
    if (user?.role === "teacher") {
      fetchTeacherClasses();
      setStudents([]);
    }
    if (user?.role === "admin") {
      fetchUsers();
      fetchTeachers();
      fetchAllClasses();
      fetchAllocationPrograms();
    }
  }, [user]);

  useEffect(() => {
    if (user?.role !== "teacher") {
      return;
    }
    const targetDate = date || bulkDate || filterDate || new Date().toISOString().slice(0, 10);
    fetchTeacherClasses(targetDate);
  }, [user?.role, date, bulkDate, filterDate]);

  useEffect(() => {
    if (user?.role !== "admin") {
      return;
    }

    if (!allocationForm.programId) {
      setAllocationSessions([]);
      setAllocationBranches([]);
      setAllocationSubjects([]);
      setAllocationForm((prev) => ({
        ...prev,
        sessionId: "",
        branchId: "",
        subjectId: "",
      }));
      return;
    }

    fetchAllocationSessions(allocationForm.programId);
  }, [user?.role, allocationForm.programId]);

  useEffect(() => {
    if (user?.role !== "admin") {
      return;
    }

    if (!allocationForm.programId || !allocationForm.sessionId) {
      setAllocationBranches([]);
      setAllocationSubjects([]);
      setAllocationForm((prev) => ({
        ...prev,
        branchId: "",
        subjectId: "",
      }));
      return;
    }

    fetchAllocationBranches(allocationForm.programId, allocationForm.sessionId);
  }, [user?.role, allocationForm.programId, allocationForm.sessionId]);

  useEffect(() => {
    if (user?.role !== "admin") {
      return;
    }

    if (!allocationForm.branchId || !allocationForm.semester) {
      setAllocationSubjects([]);
      setAllocationForm((prev) => ({ ...prev, subjectId: "" }));
      return;
    }

    fetchAllocationSubjects(allocationForm.branchId, allocationForm.semester);
  }, [user?.role, allocationForm.branchId, allocationForm.semester]);

  useEffect(() => {
    if (user?.role !== "teacher") {
      return;
    }
    if (!selectedClass) {
      setStudents([]);
      setStudentId("");
      return;
    }
    fetchStudents(selectedClass);
  }, [user?.role, selectedClass]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await API.get("/users/profile");
        setProfile(res.data);
      } catch (error) {
        console.error(error);
      }
    };

    fetchProfile();
  }, []);

  useEffect(() => {
    let active = true;

    const checkDateLock = async () => {
      if (!selectedClass || !bulkDate || user?.role !== "teacher") {
        if (active) {
          setIsBulkDateLocked(false);
        }
        return;
      }

      try {
        const res = await API.get("/attendance", {
          params: {
            classId: selectedClass,
            start: bulkDate,
            end: bulkDate,
          },
        });
        if (active) {
          setIsBulkDateLocked(res.data.length > 0);
        }
      } catch (error) {
        if (active) {
          setIsBulkDateLocked(false);
        }
        console.error(error);
      }
    };

    checkDateLock();

    return () => {
      active = false;
    };
  }, [selectedClass, bulkDate, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (!socket.connected) {
      socket.connect();
    }

    const handleChange = () => {
      if (user.role === "admin") {
        fetchLowAttendance();
        fetchRanking();
      }
      if (user.role === "teacher" && selectedClass) {
        fetchAttendanceByClass();
      }
    };

    socket.on("attendance:changed", handleChange);

    return () => {
      socket.off("attendance:changed", handleChange);
      socket.disconnect();
    };
  }, [user, selectedClass, filterDate, rankingFilters]);

  const reportAdminError = (error, fallbackMessage) => {
    const message = error?.response?.data?.message || fallbackMessage;
    setAdminError(message);
    showToast(message, "error");
  };

  const reportTeacherError = (error, fallbackMessage) => {
    const message = error?.response?.data?.message || fallbackMessage;
    setTeacherError(message);
    showToast(message, "error");
  };

  const fetchLowAttendance = async () => {
    try {
      setIsLoadingLowAttendance(true);
      setAdminError("");
      const res = await API.get("/attendance/low-attendance?limit=75");
      setLowAttendance(res.data);
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to fetch low attendance");
    } finally {
      setIsLoadingLowAttendance(false);
    }
  };

  const fetchTeacherClasses = async (forDate = "") => {
    try {
      setIsLoadingTeacherClasses(true);
      setTeacherError("");
      const params = forDate ? { date: forDate } : undefined;
      const res = await API.get("/classes/my-classes", { params });
      setClasses(res.data);
    } catch (error) {
      console.error(error);
      reportTeacherError(error, "Failed to fetch your classes");
    } finally {
      setIsLoadingTeacherClasses(false);
    }
  };

  const fetchRanking = async () => {
    try {
      setIsLoadingRanking(true);
      setAdminError("");
      const params = {};
      if (rankingFilters.programId !== "all") {
        params.programId = rankingFilters.programId;
      }
      if (rankingFilters.sessionId !== "all") {
        params.sessionId = rankingFilters.sessionId;
      }
      if (rankingFilters.branchId !== "all") {
        params.branchId = rankingFilters.branchId;
      }
      if (rankingFilters.semester !== "all") {
        params.semester = rankingFilters.semester;
      }
      if (rankingFilters.groupLabel !== "all") {
        params.groupLabel = rankingFilters.groupLabel;
      }
      if (rankingFilters.subject !== "all") {
        params.subject = rankingFilters.subject;
      }

      const res = await API.get("/attendance/ranking", {
        params: Object.keys(params).length > 0 ? params : undefined,
      });
      setRanking(res.data);
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to fetch ranking");
    } finally {
      setIsLoadingRanking(false);
    }
  };

  const fetchStudents = async (classId = "") => {
    try {
      setIsLoadingTeacherStudents(true);
      setTeacherError("");
      const res = await API.get("/users/students", {
        params: classId ? { classId } : undefined,
      });
      setStudents(res.data);
      if (studentId && !res.data.some((entry) => entry._id === studentId)) {
        setStudentId("");
      }
    } catch (error) {
      console.error(error);
      reportTeacherError(error, "Failed to fetch students");
    } finally {
      setIsLoadingTeacherStudents(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setAdminError("");
      const res = await API.get("/users");
      setUsers(res.data);
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to fetch users");
    }
  };

  const fetchTeachers = async () => {
    try {
      setIsLoadingTeachers(true);
      setAdminError("");
      const res = await API.get("/users/teachers");
      setTeachers(res.data);
      setAllocationForm((prev) => {
        if (!prev.teacherId) {
          return prev;
        }
        const stillAvailable = res.data.some((entry) => entry._id === prev.teacherId);
        if (stillAvailable) {
          return prev;
        }
        return { ...prev, teacherId: "" };
      });
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to fetch teachers");
    } finally {
      setIsLoadingTeachers(false);
    }
  };

  const fetchAllocationPrograms = async () => {
    try {
      setIsLoadingAllocationPrograms(true);
      setAdminError("");
      const res = await API.get("/admin/academic/programs");
      setAllocationPrograms(res.data);
      setAllocationForm((prev) => {
        const keepProgram = res.data.some((entry) => entry._id === prev.programId);
        return {
          ...prev,
          programId: keepProgram ? prev.programId : res.data[0]?._id || "",
        };
      });
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to load programs for allocation");
    } finally {
      setIsLoadingAllocationPrograms(false);
    }
  };

  const fetchAllocationSessions = async (programId) => {
    try {
      setIsLoadingAllocationSessions(true);
      setAdminError("");
      const res = await API.get("/admin/academic/sessions", {
        params: { programId },
      });
      setAllocationSessions(res.data);
      setAllocationForm((prev) => {
        const keepSession = res.data.some((entry) => entry._id === prev.sessionId);
        return {
          ...prev,
          sessionId: keepSession ? prev.sessionId : res.data[0]?._id || "",
        };
      });
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to load sessions for allocation");
    } finally {
      setIsLoadingAllocationSessions(false);
    }
  };

  const fetchAllocationBranches = async (programId, sessionId) => {
    try {
      setIsLoadingAllocationBranches(true);
      setAdminError("");
      const res = await API.get("/admin/academic/branches", {
        params: { programId, sessionId },
      });
      setAllocationBranches(res.data);
      setAllocationForm((prev) => {
        const keepBranch = res.data.some((entry) => entry._id === prev.branchId);
        return {
          ...prev,
          branchId: keepBranch ? prev.branchId : res.data[0]?._id || "",
        };
      });
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to load branches for allocation");
    } finally {
      setIsLoadingAllocationBranches(false);
    }
  };

  const fetchAllocationSubjects = async (branchId, semester) => {
    try {
      setIsLoadingAllocationSubjects(true);
      setAdminError("");
      const res = await API.get("/admin/academic/subjects", {
        params: { branchId, semester },
      });
      setAllocationSubjects(res.data);
      setAllocationForm((prev) => {
        const keepSubject = res.data.some((entry) => entry._id === prev.subjectId);
        return {
          ...prev,
          subjectId: keepSubject ? prev.subjectId : res.data[0]?._id || "",
        };
      });
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to load subjects for allocation");
    } finally {
      setIsLoadingAllocationSubjects(false);
    }
  };

  const fetchAllClasses = async () => {
    try {
      setAdminError("");
      const res = await API.get("/classes/all");
      setAllocatedClasses(res.data);
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to fetch classes");
    }
  };

  const handleAllocateClass = async () => {
    try {
      const semester = Number.parseInt(allocationForm.semester, 10);
      if (
        !allocationForm.programId ||
        !allocationForm.sessionId ||
        !allocationForm.branchId ||
        !allocationForm.subjectId ||
        !allocationForm.teacherId ||
        !allocationForm.groupLabel ||
        !Number.isInteger(semester)
      ) {
        showToast("Program, session, branch, semester, group, subject, and teacher are required", "error");
        return;
      }

      setAdminError("");
      setIsAllocatingClass(true);
      const res = await API.post("/classes/allocate", {
        programId: allocationForm.programId,
        sessionId: allocationForm.sessionId,
        branchId: allocationForm.branchId,
        semester,
        groupLabel: allocationForm.groupLabel,
        subjectId: allocationForm.subjectId,
        teacherId: allocationForm.teacherId,
      });
      showToast(
        res.data?.reassigned
          ? "Teacher updated for selected class scope"
          : "Class allocated"
      );
      setAllocationForm((prev) => ({ ...prev, teacherId: "" }));
      fetchAllClasses();
      fetchTeachers();
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to allocate class");
    } finally {
      setIsAllocatingClass(false);
    }
  };

  const showToast = (message, variant = "success") => {
    setToastVariant(variant);
    setToastMessage(message);
    setTimeout(() => setToastMessage(""), 2200);
  };

  const fetchAttendanceByClass = async () => {
    if (!selectedClass) {
      showToast("Please select a class first", "error");
      return;
    }

    try {
      setIsLoadingTeacherAttendance(true);
      setTeacherError("");
      const params = { classId: selectedClass };
      if (filterDate) {
        params.start = filterDate;
        params.end = filterDate;
      }

      const res = await API.get(`/attendance`, { params });
      setAttendanceRecords(res.data);
    } catch (error) {
      console.error(error);
      reportTeacherError(error, "Failed to fetch attendance records");
    } finally {
      setIsLoadingTeacherAttendance(false);
    }
  };

  const handleUpdateAttendance = async (id, newStatus) => {
    try {
      setIsUpdatingAttendanceId(id);
      setTeacherError("");
      await API.put(`/attendance/${id}`, {
        status: newStatus,
      });

      fetchAttendanceByClass();
    } catch (error) {
      console.error(error);
      reportTeacherError(error, "Failed to update attendance");
    } finally {
      setIsUpdatingAttendanceId("");
    }
  };

  const handleDelete = async (id) => {
    const shouldDelete = window.confirm("Delete this attendance record?");
    if (!shouldDelete) {
      return;
    }

    try {
      setIsDeletingAttendanceId(id);
      setTeacherError("");
      await API.delete(`/attendance/${id}`);
      fetchAttendanceByClass();
    } catch (error) {
      console.error(error);
      reportTeacherError(error, "Failed to delete attendance");
    } finally {
      setIsDeletingAttendanceId("");
    }
  };

  const loadBulkRows = () => {
    if (!selectedClass || !bulkDate) {
      showToast("Select class and date for bulk attendance", "error");
      return;
    }

    if (students.length === 0) {
      showToast("No students available for bulk attendance", "error");
      return;
    }

    const rows = students.map((student) => ({
      studentId: student._id,
      name: student.name,
      status: "Present",
    }));
    setBulkRows(rows);
  };

  const updateBulkStatus = (studentIdValue, newStatus) => {
    setBulkRows((prev) =>
      prev.map((row) =>
        row.studentId === studentIdValue ? { ...row, status: newStatus } : row
      )
    );
  };

  const submitBulkAttendance = async () => {
    if (!selectedClass || !bulkDate || bulkRows.length === 0) {
      showToast("Prepare bulk attendance first", "error");
      return;
    }

    try {
      setIsSubmittingBulk(true);
      setTeacherError("");
      await API.post("/attendance/bulk", {
        classId: selectedClass,
        date: bulkDate,
        attendance: bulkRows.map((row) => ({
          studentId: row.studentId,
          status: row.status,
        })),
      });
      showToast("Attendance Submitted");
      await fetchAttendanceByClass();
    } catch (error) {
      console.error(error);
      reportTeacherError(error, "Bulk attendance failed");
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  const markAttendance = async () => {
    if (!selectedClass || !studentId || !date) {
      showToast("Select class, student and date", "error");
      return;
    }

    try {
      setIsMarkingAttendance(true);
      setTeacherError("");
      await API.post("/attendance", {
        studentId,
        classId: selectedClass,
        date,
        status,
      });

      showToast("Attendance marked successfully");
      setStudentId("");
      setDate("");
      setStatus("Present");
      await fetchAttendanceByClass();
    } catch (error) {
      console.error(error);
      reportTeacherError(error, "Error marking attendance");
    } finally {
      setIsMarkingAttendance(false);
    }
  };

  const applyBulkStatusToAll = (nextStatus) => {
    setBulkRows((prev) => prev.map((row) => ({ ...row, status: nextStatus })));
  };

  const refreshTeacherPanel = async () => {
    await fetchTeacherClasses();
    if (selectedClass) {
      await fetchStudents(selectedClass);
    } else {
      setStudents([]);
    }
    if (selectedClass) {
      await fetchAttendanceByClass();
    }
  };

  const refreshAdminPanel = () => {
    fetchUsers();
    fetchTeachers();
    fetchAllClasses();
    fetchAllocationPrograms();
    fetchLowAttendance();
    fetchRanking();
  };

  const adminSummary = useMemo(() => {
    const totalUsers = users.length;
    const activeUsers = users.filter((entry) => entry.isActive).length;
    const teacherCount = users.filter((entry) => entry.role === "teacher").length;
    const studentCount = users.filter((entry) => entry.role === "student").length;

    return { totalUsers, activeUsers, teacherCount, studentCount };
  }, [users]);

  const allocationGroupOptions = useMemo(() => ["1", "2", "3", "4"], []);

  const allocatedClassFilterOptions = useMemo(() => {
    const createSortedList = (items) =>
      Array.from(items.values()).sort((left, right) => left.label.localeCompare(right.label));

    const programMap = new Map();
    const sessionMap = new Map();
    const branchMap = new Map();
    const semesterMap = new Map();
    const groupMap = new Map();
    const teacherMap = new Map();
    const subjectMap = new Map();

    allocatedClasses.forEach((cls) => {
      if (cls.program?._id) {
        programMap.set(cls.program._id, {
          value: cls.program._id,
          label: cls.program.code || cls.program.name,
        });
      }
      if (cls.session?._id) {
        sessionMap.set(cls.session._id, {
          value: cls.session._id,
          label: cls.session.label || "Session",
        });
      }
      if (cls.branch?._id) {
        branchMap.set(cls.branch._id, {
          value: cls.branch._id,
          label: cls.branch.code || cls.branch.name,
        });
      }
      if (cls.academicSemester) {
        const semesterValue = String(cls.academicSemester);
        semesterMap.set(semesterValue, {
          value: semesterValue,
          label: `Semester ${semesterValue}`,
        });
      }
      if (cls.groupLabel) {
        const groupValue = String(cls.groupLabel);
        groupMap.set(groupValue, {
          value: groupValue,
          label: `Group ${groupValue}`,
        });
      }
      if (cls.teacher?._id) {
        teacherMap.set(cls.teacher._id, {
          value: cls.teacher._id,
          label: cls.teacher.name || "Teacher",
        });
      }
      if (cls.subject) {
        subjectMap.set(cls.subject, {
          value: cls.subject,
          label: cls.subject,
        });
      }
    });

    return {
      programs: createSortedList(programMap),
      sessions: createSortedList(sessionMap),
      branches: createSortedList(branchMap),
      semesters: Array.from(semesterMap.values()).sort(
        (left, right) => Number.parseInt(left.value, 10) - Number.parseInt(right.value, 10)
      ),
      groups: Array.from(groupMap.values()).sort(
        (left, right) => Number.parseInt(left.value, 10) - Number.parseInt(right.value, 10)
      ),
      teachers: createSortedList(teacherMap),
      subjects: createSortedList(subjectMap),
    };
  }, [allocatedClasses]);

  const selectedTeacherClass = useMemo(
    () => classes.find((entry) => entry._id === selectedClass) || null,
    [classes, selectedClass]
  );

  const selectedTeacherClassScope = useMemo(() => {
    if (!selectedTeacherClass) {
      return "";
    }

    const parts = [];
    if (selectedTeacherClass.program?.code || selectedTeacherClass.program?.name) {
      parts.push(selectedTeacherClass.program?.code || selectedTeacherClass.program?.name);
    }
    if (selectedTeacherClass.session?.label) {
      parts.push(selectedTeacherClass.session.label);
    }
    if (selectedTeacherClass.branch?.code || selectedTeacherClass.branch?.name) {
      parts.push(selectedTeacherClass.branch?.code || selectedTeacherClass.branch?.name);
    }
    if (selectedTeacherClass.academicSemester) {
      parts.push(`Sem ${selectedTeacherClass.academicSemester}`);
    }
    if (selectedTeacherClass.groupLabel) {
      parts.push(`Group ${selectedTeacherClass.groupLabel}`);
    }
    return parts.join(" | ");
  }, [selectedTeacherClass]);

  const teacherStudentGroupOptions = useMemo(() => {
    const groups = new Set();
    students.forEach((student) => {
      const groupValue = String(student.groupLabel || "").trim();
      if (["1", "2", "3", "4"].includes(groupValue)) {
        groups.add(groupValue);
      }
    });
    return Array.from(groups).sort((left, right) => Number(left) - Number(right));
  }, [students]);

  const filteredTeacherStudents = useMemo(() => {
    const normalizedQuery = teacherStudentSearch.trim().toLowerCase();
    return students.filter((student) => {
      const matchesSearch =
        !normalizedQuery ||
        String(student.name || "").toLowerCase().includes(normalizedQuery) ||
        String(student.email || "").toLowerCase().includes(normalizedQuery);
      const matchesGroup =
        teacherStudentGroupFilter === "all" ||
        String(student.groupLabel || "") === teacherStudentGroupFilter;
      return matchesSearch && matchesGroup;
    });
  }, [students, teacherStudentSearch, teacherStudentGroupFilter]);

  const filteredAttendanceRecords = useMemo(() => {
    const normalizedQuery = teacherAttendanceSearch.trim().toLowerCase();
    if (!normalizedQuery) {
      return attendanceRecords;
    }

    return attendanceRecords.filter((record) => {
      const studentName = String(record.student?.name || "").toLowerCase();
      const studentEmail = String(record.student?.email || "").toLowerCase();
      return studentName.includes(normalizedQuery) || studentEmail.includes(normalizedQuery);
    });
  }, [attendanceRecords, teacherAttendanceSearch]);

  const teacherSummary = useMemo(() => {
    const total = attendanceRecords.length;
    const present = attendanceRecords.filter((record) => record.status === "Present").length;
    const percentage = total === 0 ? 0 : Number(((present / total) * 100).toFixed(1));

    return { total, present, percentage };
  }, [attendanceRecords]);

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  if (!user) {
    return (
      <div className="page-shell">
        <div className="card panel">
          <p className="empty-state">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell dashboard-layout">
      <span className="ambient-orb teal" />
      <span className="ambient-orb gold" />

      <header className="card topbar">
        <div>
          <h1 className="topbar-title">Attendance Command Center</h1>
          <p className="topbar-subtitle">
            Track, mark, and monitor attendance from one place.
          </p>
        </div>
        <div className="stack" style={{ gap: "0.5rem", justifyItems: "end" }}>
          <span className="role-chip">{user.role}</span>
          <button className="btn-ghost" onClick={logout} type="button">
            Logout
          </button>
        </div>
      </header>

      {user.role === "student" && <StudentDashboard />}

      {user.role === "teacher" && (
        <section className="card panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Teacher Panel</h2>
              <p className="panel-subtitle">
                Mark daily attendance quickly using your assigned classes.
              </p>
              {profile?.subject && (
                <p className="panel-subtitle" style={{ marginTop: "0.35rem" }}>
                  Specialization: <strong>{profile.subject}</strong>
                </p>
              )}
            </div>
            <div className="admin-actions">
              <button className="btn-ghost" type="button" onClick={refreshTeacherPanel}>
                Refresh Teacher Data
              </button>
            </div>
          </div>

          {teacherError && <div className="error-banner">{teacherError}</div>}

          <div className="metrics-grid teacher-kpi-grid">
            <article className="metric">
              <span className="metric-label">Selected Class</span>
              <div className="metric-value teacher-kpi-text">
                {selectedTeacherClass
                  ? `${selectedTeacherClass.className} (${selectedTeacherClass.subject})`
                  : "None"}
              </div>
            </article>
            <article className="metric">
              <span className="metric-label">Records Loaded</span>
              <div className="metric-value">{teacherSummary.total}</div>
            </article>
            <article className="metric">
              <span className="metric-label">Present</span>
              <div className="metric-value">{teacherSummary.present}</div>
            </article>
            <article className="metric">
              <span className="metric-label">Present %</span>
              <div className="metric-value">{teacherSummary.percentage}%</div>
            </article>
          </div>

          {isLoadingTeacherClasses && (
            <p className="empty-state">Loading assigned classes...</p>
          )}

          {!isLoadingTeacherClasses && classes.length === 0 && (
            <div className="bulk-lock-note" style={{ marginBottom: "0.85rem" }}>
              No classes are allocated to this teacher yet. Ask admin to allocate class + subject in
              the Admin Panel.
            </div>
          )}

          <div className="bulk-lock-note" style={{ marginBottom: "0.85rem" }}>
            Student account creation is admin-controlled in this workflow. Teachers can mark
            attendance only for students in the selected class scope.
          </div>

          {selectedClass && !isLoadingTeacherStudents && students.length === 0 && (
            <p className="empty-state">
              No active students available. Create students first to mark attendance.
            </p>
          )}

          <div className="panel-form">
            <div>
              <label className="field-label" htmlFor="class-select">
                Class
              </label>
              <select
                id="class-select"
                className="select-field"
                value={selectedClass}
                onChange={(e) => {
                  const nextClassId = e.target.value;
                  setSelectedClass(nextClassId);
                  setAttendanceRecords([]);
                  setBulkRows([]);
                  setStudentId("");
                  setTeacherStudentSearch("");
                  setTeacherStudentGroupFilter("all");
                }}
                disabled={isLoadingTeacherClasses}
              >
                <option value="">
                  {isLoadingTeacherClasses ? "Loading classes..." : "Select Class"}
                </option>
                {classes.map((cls) => (
                  <option key={cls._id} value={cls._id}>
                    {cls.className} - {cls.subject}
                  </option>
                ))}
              </select>
              {selectedTeacherClassScope && (
                <p className="panel-subtitle" style={{ marginTop: "0.35rem" }}>
                  Scope: {selectedTeacherClassScope}
                </p>
              )}
            </div>

            <div>
              <label className="field-label" htmlFor="student-select">
                Student
              </label>
              <select
                id="student-select"
                className="select-field"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                disabled={isLoadingTeacherStudents}
              >
                <option value="">
                  {isLoadingTeacherStudents ? "Loading students..." : "Select Student"}
                </option>
                {filteredTeacherStudents.map((student) => (
                  <option key={student._id} value={student._id}>
                    {student.groupLabel ? `${student.name} (Group ${student.groupLabel})` : student.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-full teacher-student-controls">
              <div className="admin-actions">
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={() => selectedClass && fetchStudents(selectedClass)}
                  disabled={!selectedClass || isLoadingTeacherStudents}
                >
                  {isLoadingTeacherStudents ? "Loading..." : "Load Students"}
                </button>
              </div>
              <div className="teacher-filter-grid">
                <input
                  className="input-field"
                  placeholder="Search student name/email"
                  value={teacherStudentSearch}
                  onChange={(e) => setTeacherStudentSearch(e.target.value)}
                />
                <select
                  className="select-field"
                  value={teacherStudentGroupFilter}
                  onChange={(e) => setTeacherStudentGroupFilter(e.target.value)}
                >
                  <option value="all">All Groups</option>
                  {teacherStudentGroupOptions.map((groupValue) => (
                    <option key={groupValue} value={groupValue}>
                      Group {groupValue}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="field-label" htmlFor="attendance-date">
                Date
              </label>
              <input
                id="attendance-date"
                className="date-field"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="attendance-status">
                Status
              </label>
              <select
                id="attendance-status"
                className="select-field"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
              </select>
            </div>

            <div className="field-full">
              <button
                className="btn-primary"
                onClick={fetchAttendanceByClass}
                type="button"
                disabled={isLoadingTeacherAttendance || !selectedClass}
              >
                {isLoadingTeacherAttendance ? "Loading Records..." : "View Attendance Records"}
              </button>
            </div>

            <div className="field-full">
              <button
                className="btn-secondary"
                onClick={markAttendance}
                type="button"
                disabled={
                  isMarkingAttendance || !selectedClass || !studentId || !date || isLoadingTeacherStudents
                }
              >
                {isMarkingAttendance ? "Saving..." : "Mark Attendance"}
              </button>
            </div>
          </div>

          <div className="bulk-card">
            <h3 className="panel-title">Bulk Attendance</h3>
            <p className="panel-subtitle">
              Load all students and mark attendance in one submission.
            </p>
            <div className="bulk-actions">
              <input
                className="date-field"
                type="date"
                value={bulkDate}
                onChange={(e) => setBulkDate(e.target.value)}
                disabled={isBulkDateLocked || isLoadingTeacherClasses}
              />
              <button
                className="btn-primary"
                onClick={loadBulkRows}
                type="button"
                disabled={isLoadingTeacherStudents || isLoadingTeacherClasses}
              >
                {isLoadingTeacherStudents ? "Loading..." : "Load Students"}
              </button>
              <button
                className="btn-secondary"
                onClick={submitBulkAttendance}
                type="button"
                disabled={isSubmittingBulk || bulkRows.length === 0}
              >
                {isSubmittingBulk ? "Submitting..." : "Submit Bulk"}
              </button>
            </div>
            {bulkRows.length > 0 && (
              <div className="teacher-bulk-shortcuts">
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={() => applyBulkStatusToAll("Present")}
                >
                  Mark All Present
                </button>
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={() => applyBulkStatusToAll("Absent")}
                >
                  Mark All Absent
                </button>
              </div>
            )}
            {isBulkDateLocked && (
              <div className="bulk-lock-note">
                Attendance already exists for this class/date. Date is locked.
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={() => {
                    setIsBulkDateLocked(false);
                    setBulkDate("");
                  }}
                  style={{ marginLeft: "0.6rem", height: "32px" }}
                >
                  Change Date
                </button>
              </div>
            )}

            {bulkRows.length > 0 && (
              <div className="table-wrap" style={{ marginTop: "1rem" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.map((row) => (
                      <tr key={row.studentId}>
                        <td>{row.name}</td>
                        <td>
                          <select
                            className={`status-select ${
                              row.status === "Present" ? "is-present" : "is-absent"
                            }`}
                            value={row.status}
                            onChange={(e) => updateBulkStatus(row.studentId, e.target.value)}
                          >
                            <option value="Present">Present</option>
                            <option value="Absent">Absent</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="teacher-filter-grid">
            <div>
              <label className="field-label" htmlFor="filter-date">
                Filter by Date
              </label>
              <input
                id="filter-date"
                className="date-field"
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="attendance-search">
                Search Attendance
              </label>
              <input
                id="attendance-search"
                className="input-field"
                placeholder="Search by student name/email"
                value={teacherAttendanceSearch}
                onChange={(e) => setTeacherAttendanceSearch(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="attendance-load-btn">
                Load
              </label>
              <button
                id="attendance-load-btn"
                className="btn-secondary"
                type="button"
                onClick={fetchAttendanceByClass}
                disabled={isLoadingTeacherAttendance || !selectedClass}
              >
                {isLoadingTeacherAttendance ? "Loading..." : "Load Records"}
              </button>
            </div>
          </div>

          {selectedClass && isLoadingTeacherAttendance && (
            <p className="empty-state">Loading attendance records...</p>
          )}

          {selectedClass && !isLoadingTeacherAttendance && attendanceRecords.length === 0 && (
            <p className="empty-state">No attendance records found for the current filter.</p>
          )}

          {!isLoadingTeacherAttendance && filteredAttendanceRecords.length > 0 && (
            <div className="table-wrap" style={{ marginTop: "20px" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendanceRecords.map((record) => (
                  <tr key={record._id}>
                    <td>{record.student?.name}</td>
                    <td>{new Date(record.date).toLocaleDateString()}</td>
                    <td>
                      <select
                        className={`status-select ${
                          record.status === "Present" ? "is-present" : "is-absent"
                        }`}
                        value={record.status}
                        onChange={(e) =>
                          handleUpdateAttendance(record._id, e.target.value)
                        }
                        disabled={
                          isUpdatingAttendanceId === record._id ||
                          isDeletingAttendanceId === record._id
                        }
                        aria-label={`Attendance status for ${record.student?.name || "student"}`}
                      >
                        <option value="Present">Present</option>
                        <option value="Absent">Absent</option>
                      </select>
                    </td>
                    <td>
                      <button
                        className="btn-danger-sm"
                        onClick={() => handleDelete(record._id)}
                        type="button"
                        disabled={
                          isDeletingAttendanceId === record._id ||
                          isUpdatingAttendanceId === record._id
                        }
                      >
                        {isDeletingAttendanceId === record._id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {user.role === "admin" && (
        <section className="card panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Admin Panel</h2>
              <p className="panel-subtitle">
                Manage setup, users, and attendance analytics from one place.
              </p>
            </div>
          </div>

          {adminError && <div className="error-banner">{adminError}</div>}

          <div className="bulk-card admin-quick-actions-card">
            <h3 className="panel-title">Quick Actions</h3>
            <p className="panel-subtitle">
              Keep admin operations in one place: users, reports, ranking, and allocated classes.
            </p>
            <div className="admin-actions admin-quick-actions">
              <button
                className="btn-primary"
                onClick={() => navigate("/admin/add-student")}
                type="button"
              >
                Add New Student
              </button>
              <button
                className="btn-primary"
                onClick={() => navigate("/admin/add-teacher")}
                type="button"
              >
                Add New Teacher
              </button>
              <button
                className="btn-secondary"
                onClick={() => navigate("/admin/users")}
                type="button"
              >
                Show User List
              </button>
              <button
                className="btn-secondary"
                type="button"
                onClick={() => navigate("/admin/allocated-classes")}
              >
                Show Allocated Classes
              </button>
              <button
                className="btn-primary"
                onClick={() => navigate("/admin/low-attendance")}
                type="button"
              >
                View Low Attendance
              </button>
              <button className="btn-secondary" type="button" onClick={() => navigate("/admin/downloads")}>
                Download Attendance Sheet
              </button>
              <button
                className="btn-ghost"
                onClick={() => navigate("/admin/ranking")}
                type="button"
              >
                View Ranking
              </button>
              <button
                className="btn-secondary"
                type="button"
                onClick={() => navigate("/admin/ranking?reset=1")}
              >
                Reset Ranking Filters
              </button>
              <button className="btn-ghost" onClick={refreshAdminPanel} type="button">
                Refresh Admin Data
              </button>
            </div>
          </div>

          <AdminAcademicSetup adminName={profile?.name || "Admin"} showToast={showToast} />

          <div className="metrics-grid admin-kpi-grid">
            <article className="metric">
              <span className="metric-label">Total Users</span>
              <div className="metric-value">{adminSummary.totalUsers}</div>
            </article>
            <article className="metric">
              <span className="metric-label">Active Users</span>
              <div className="metric-value">{adminSummary.activeUsers}</div>
            </article>
            <article className="metric">
              <span className="metric-label">Teachers</span>
              <div className="metric-value">{adminSummary.teacherCount}</div>
            </article>
            <article className="metric">
              <span className="metric-label">Students</span>
              <div className="metric-value">{adminSummary.studentCount}</div>
            </article>
          </div>

          <div className="bulk-card">
            <h3 className="panel-title">Attendance Insights</h3>
            <p className="panel-subtitle">
              Choose scope (program, sem, branch, etc.) before loading ranking.
            </p>
            <div className="allocated-class-filter-grid">
              <select
                className="select-field"
                value={rankingFilters.programId}
                onChange={(e) =>
                  setRankingFilters((prev) => ({ ...prev, programId: e.target.value }))
                }
              >
                <option value="all">All Programs</option>
                {allocatedClassFilterOptions.programs.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select
                className="select-field"
                value={rankingFilters.sessionId}
                onChange={(e) =>
                  setRankingFilters((prev) => ({ ...prev, sessionId: e.target.value }))
                }
              >
                <option value="all">All Sessions</option>
                {allocatedClassFilterOptions.sessions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select
                className="select-field"
                value={rankingFilters.branchId}
                onChange={(e) =>
                  setRankingFilters((prev) => ({ ...prev, branchId: e.target.value }))
                }
              >
                <option value="all">All Branches</option>
                {allocatedClassFilterOptions.branches.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select
                className="select-field"
                value={rankingFilters.semester}
                onChange={(e) =>
                  setRankingFilters((prev) => ({ ...prev, semester: e.target.value }))
                }
              >
                <option value="all">All Semesters</option>
                {allocatedClassFilterOptions.semesters.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select
                className="select-field"
                value={rankingFilters.groupLabel}
                onChange={(e) =>
                  setRankingFilters((prev) => ({ ...prev, groupLabel: e.target.value }))
                }
              >
                <option value="all">All Groups</option>
                {allocatedClassFilterOptions.groups.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select
                className="select-field"
                value={rankingFilters.subject}
                onChange={(e) =>
                  setRankingFilters((prev) => ({ ...prev, subject: e.target.value }))
                }
              >
                <option value="all">All Subjects</option>
                {allocatedClassFilterOptions.subjects.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bulk-card">
            <h3 className="panel-title">Teacher-Class Allocation</h3>
            <p className="panel-subtitle">
              Select scope from database. Existing scope keeps same teacher until you change it.
            </p>
            <div className="admin-allocation-grid">
              <select
                className="select-field"
                value={allocationForm.programId}
                onChange={(e) =>
                  setAllocationForm((prev) => ({ ...prev, programId: e.target.value }))
                }
                disabled={isLoadingAllocationPrograms}
              >
                <option value="">
                  {isLoadingAllocationPrograms ? "Loading programs..." : "Select Program"}
                </option>
                {allocationPrograms.map((program) => (
                  <option key={program._id} value={program._id}>
                    {program.code ? `${program.code} - ${program.name}` : program.name}
                  </option>
                ))}
              </select>
              <select
                className="select-field"
                value={allocationForm.sessionId}
                onChange={(e) =>
                  setAllocationForm((prev) => ({ ...prev, sessionId: e.target.value }))
                }
                disabled={!allocationForm.programId || isLoadingAllocationSessions}
              >
                <option value="">
                  {isLoadingAllocationSessions ? "Loading sessions..." : "Select Session"}
                </option>
                {allocationSessions.map((session) => (
                  <option key={session._id} value={session._id}>
                    {session.label}
                  </option>
                ))}
              </select>
              <select
                className="select-field"
                value={allocationForm.branchId}
                onChange={(e) =>
                  setAllocationForm((prev) => ({ ...prev, branchId: e.target.value }))
                }
                disabled={!allocationForm.sessionId || isLoadingAllocationBranches}
              >
                <option value="">
                  {isLoadingAllocationBranches ? "Loading branches..." : "Select Branch"}
                </option>
                {allocationBranches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.code ? `${branch.code} - ${branch.name}` : branch.name}
                  </option>
                ))}
              </select>
              <select
                className="select-field"
                value={allocationForm.semester}
                onChange={(e) =>
                  setAllocationForm((prev) => ({ ...prev, semester: e.target.value }))
                }
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((semester) => (
                  <option key={semester} value={semester}>
                    Semester {semester}
                  </option>
                ))}
              </select>
              <select
                className="select-field"
                value={allocationForm.groupLabel}
                onChange={(e) =>
                  setAllocationForm((prev) => ({ ...prev, groupLabel: e.target.value }))
                }
              >
                {allocationGroupOptions.map((groupValue) => (
                  <option key={groupValue} value={groupValue}>
                    Group {groupValue}
                  </option>
                ))}
              </select>
              <select
                className="select-field"
                value={allocationForm.subjectId}
                onChange={(e) =>
                  setAllocationForm((prev) => ({ ...prev, subjectId: e.target.value }))
                }
                disabled={!allocationForm.branchId || isLoadingAllocationSubjects}
              >
                <option value="">
                  {isLoadingAllocationSubjects ? "Loading subjects..." : "Select Subject"}
                </option>
                {allocationSubjects.map((subject) => (
                  <option key={subject._id} value={subject._id}>
                    {subject.code ? `${subject.code} - ${subject.name}` : subject.name}
                  </option>
                ))}
              </select>
              <select
                className="select-field"
                value={allocationForm.teacherId}
                onChange={(e) =>
                  setAllocationForm((prev) => ({ ...prev, teacherId: e.target.value }))
                }
                disabled={isLoadingTeachers}
              >
                <option value="">
                  {isLoadingTeachers ? "Loading teachers..." : "Select Teacher"}
                </option>
                {teachers.map((teacher) => (
                  <option key={teacher._id} value={teacher._id}>
                    {teacher.teacherId ? `${teacher.name} (${teacher.teacherId})` : teacher.name}
                  </option>
                ))}
              </select>
              {!isLoadingTeachers && teachers.length === 0 && (
                <p className="panel-subtitle" style={{ marginTop: "0.2rem" }}>
                  No active teachers available.
                </p>
              )}
            </div>

            <div className="admin-actions" style={{ marginTop: "0.7rem" }}>
              <button
                className="btn-primary"
                onClick={handleAllocateClass}
                type="button"
                disabled={isAllocatingClass || isLoadingTeachers}
              >
                {isAllocatingClass ? "Allocating..." : "Allocate Class"}
              </button>
            </div>
          </div>

          {isLoadingLowAttendance && (
            <p className="empty-state">Loading low-attendance records...</p>
          )}

          {!isLoadingLowAttendance && lowAttendance.length === 0 && (
            <p className="empty-state">
              Use Quick Actions above to open low-attendance and ranking pages.
            </p>
          )}

          {!isLoadingLowAttendance && lowAttendance.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Total Classes</th>
                    <th>Present</th>
                    <th>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {lowAttendance.map((student) => (
                    <tr key={student.studentId}>
                      <td>{student.name}</td>
                      <td>{student.email}</td>
                      <td>{student.totalClasses}</td>
                      <td>{student.present}</td>
                      <td>
                        <span className="status-pill">{student.percentage}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {isLoadingRanking && (
            <p className="empty-state">Loading ranking...</p>
          )}

          {!isLoadingRanking && ranking.length > 0 && (
            <div className="table-wrap" style={{ marginTop: "1rem" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Percentage</th>
                    <th>Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((item) => (
                    <tr key={item.studentId}>
                      <td>{item.rank}</td>
                      <td>{item.name}</td>
                      <td>{item.email}</td>
                      <td>{item.percentage}%</td>
                      <td>
                        {item.isLowAttendance ? (
                          <span className="warning-pill">Below 75%</span>
                        ) : (
                          <span className="status-pill">Healthy</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      {toastMessage && <div className={`toast-msg ${toastVariant}`}>{toastMessage}</div>}
    </div>
  );
}

export default Dashboard;
