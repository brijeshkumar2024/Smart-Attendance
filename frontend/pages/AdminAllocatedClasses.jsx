/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";

const parseSessionYears = (label) => {
  const value = String(label || "").trim();
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{4})\s*[-/]\s*(\d{2,4})$/);
  if (!match) {
    return null;
  }

  const startYear = Number.parseInt(match[1], 10);
  const rawEnd = match[2];
  let endYear = Number.parseInt(rawEnd, 10);

  if (rawEnd.length === 2) {
    const century = Math.floor(startYear / 100) * 100;
    endYear = century + endYear;
    if (endYear < startYear) {
      endYear += 100;
    }
  }

  if (!Number.isInteger(startYear) || !Number.isInteger(endYear)) {
    return null;
  }

  return { startYear, endYear };
};

function AdminAllocatedClasses() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [allocatedClasses, setAllocatedClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [adminError, setAdminError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState("success");
  const [isLoadingAllocatedClasses, setIsLoadingAllocatedClasses] = useState(false);
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(false);
  const [allocatedClassTimeFilter, setAllocatedClassTimeFilter] = useState("both");
  const [allocatedClassFilters, setAllocatedClassFilters] = useState({
    programId: "all",
    sessionId: "all",
    branchId: "all",
    semester: "all",
    groupLabel: "all",
    teacherId: "all",
    subject: "all",
  });
  const [liveNow, setLiveNow] = useState(() => new Date());
  const [teacherChangeRowId, setTeacherChangeRowId] = useState("");
  const [teacherChangeForm, setTeacherChangeForm] = useState(() => ({
    teacherId: "",
    mode: "full_sem",
    date: new Date().toISOString().slice(0, 10),
  }));
  const [isChangingTeacher, setIsChangingTeacher] = useState(false);

  const showToast = (message, variant = "success") => {
    setToastVariant(variant);
    setToastMessage(message);
    setTimeout(() => setToastMessage(""), 2200);
  };

  const reportAdminError = (error, fallbackMessage) => {
    const message = error?.response?.data?.message || fallbackMessage;
    setAdminError(message);
    showToast(message, "error");
  };

  const fetchAllClasses = async () => {
    try {
      setIsLoadingAllocatedClasses(true);
      setAdminError("");
      const res = await API.get("/classes/all");
      setAllocatedClasses(res.data);
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to fetch classes");
    } finally {
      setIsLoadingAllocatedClasses(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      setIsLoadingTeachers(true);
      setAdminError("");
      const res = await API.get("/users/teachers");
      setTeachers(res.data);
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to fetch teachers");
    } finally {
      setIsLoadingTeachers(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }

    const verifyAdmin = async () => {
      try {
        const res = await API.get("/users/profile");
        if (res.data?.role !== "admin") {
          navigate("/dashboard");
          return;
        }
        setProfile(res.data);
        await Promise.all([fetchAllClasses(), fetchTeachers()]);
      } catch (error) {
        console.error(error);
        localStorage.removeItem("token");
        navigate("/");
      }
    };

    verifyAdmin();
  }, [navigate]);

  useEffect(() => {
    const timer = setInterval(() => setLiveNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  const filteredAllocatedClasses = useMemo(() => {
    const currentYear = liveNow.getFullYear();
    return allocatedClasses.filter((cls) => {
      if (allocatedClassTimeFilter !== "both") {
        const years = parseSessionYears(cls.session?.label);
        if (years) {
          const isPrevious = years.endYear < currentYear;
          if (allocatedClassTimeFilter === "previous" && !isPrevious) {
            return false;
          }
          if (allocatedClassTimeFilter === "future" && isPrevious) {
            return false;
          }
        }
      }

      if (
        allocatedClassFilters.programId !== "all" &&
        cls.program?._id !== allocatedClassFilters.programId
      ) {
        return false;
      }
      if (
        allocatedClassFilters.sessionId !== "all" &&
        cls.session?._id !== allocatedClassFilters.sessionId
      ) {
        return false;
      }
      if (
        allocatedClassFilters.branchId !== "all" &&
        cls.branch?._id !== allocatedClassFilters.branchId
      ) {
        return false;
      }
      if (
        allocatedClassFilters.semester !== "all" &&
        String(cls.academicSemester || "") !== allocatedClassFilters.semester
      ) {
        return false;
      }
      if (
        allocatedClassFilters.groupLabel !== "all" &&
        String(cls.groupLabel || "") !== allocatedClassFilters.groupLabel
      ) {
        return false;
      }
      if (
        allocatedClassFilters.teacherId !== "all" &&
        cls.teacher?._id !== allocatedClassFilters.teacherId
      ) {
        return false;
      }
      if (
        allocatedClassFilters.subject !== "all" &&
        String(cls.subject || "") !== allocatedClassFilters.subject
      ) {
        return false;
      }
      return true;
    });
  }, [allocatedClasses, allocatedClassFilters, allocatedClassTimeFilter, liveNow]);

  const openTeacherChange = (cls) => {
    setTeacherChangeRowId(cls._id);
    setTeacherChangeForm({
      teacherId: cls.teacher?._id || "",
      mode: "full_sem",
      date: new Date().toISOString().slice(0, 10),
    });
  };

  const cancelTeacherChange = () => {
    setTeacherChangeRowId("");
    setTeacherChangeForm({
      teacherId: "",
      mode: "full_sem",
      date: new Date().toISOString().slice(0, 10),
    });
  };

  const submitTeacherChange = async (classId) => {
    if (!teacherChangeForm.teacherId) {
      showToast("Select teacher", "error");
      return;
    }
    if (teacherChangeForm.mode === "one_day" && !teacherChangeForm.date) {
      showToast("Select date for one day change", "error");
      return;
    }

    try {
      setIsChangingTeacher(true);
      setAdminError("");
      const payload = {
        teacherId: teacherChangeForm.teacherId,
        mode: teacherChangeForm.mode,
      };
      if (teacherChangeForm.mode === "one_day") {
        payload.date = teacherChangeForm.date;
      }

      const res = await API.patch(`/classes/${classId}/teacher`, payload);
      showToast(res.data?.message || "Teacher changed");
      cancelTeacherChange();
      await Promise.all([fetchAllClasses(), fetchTeachers()]);
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to change teacher");
    } finally {
      setIsChangingTeacher(false);
    }
  };

  const resetFilters = () => {
    setAllocatedClassFilters({
      programId: "all",
      sessionId: "all",
      branchId: "all",
      semester: "all",
      groupLabel: "all",
      teacherId: "all",
      subject: "all",
    });
  };

  const refreshPage = async () => {
    await Promise.all([fetchAllClasses(), fetchTeachers()]);
  };

  return (
    <div className="page-shell dashboard-layout">
      <span className="ambient-orb teal" />
      <span className="ambient-orb gold" />

      <header className="card topbar">
        <div>
          <h1 className="topbar-title">Allocated Classes</h1>
          <p className="topbar-subtitle">
            View and manage class allocation with time and scope filters.
          </p>
        </div>
        <div className="admin-actions">
          <button className="btn-ghost" type="button" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </button>
          <button className="btn-secondary" type="button" onClick={refreshPage}>
            Refresh
          </button>
        </div>
      </header>

      <section className="card panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Show Allocated Classes</h2>
            <p className="panel-subtitle">Admin: {profile?.name || "Admin"}</p>
          </div>
        </div>

        {adminError && <div className="error-banner">{adminError}</div>}

        <div className="admin-actions" style={{ marginBottom: "0.7rem" }}>
          <select
            className="select-field"
            value={allocatedClassTimeFilter}
            onChange={(e) => setAllocatedClassTimeFilter(e.target.value)}
            style={{ minWidth: "190px" }}
          >
            <option value="both">Both</option>
            <option value="future">Future/Ongoing</option>
            <option value="previous">Previous</option>
          </select>
          <button className="btn-ghost" type="button" onClick={resetFilters}>
            Reset Filters
          </button>
          <span className="metric-label">Live: {liveNow.toLocaleString()}</span>
        </div>

        <div className="allocated-class-filter-grid">
          <select
            className="select-field"
            value={allocatedClassFilters.programId}
            onChange={(e) =>
              setAllocatedClassFilters((prev) => ({ ...prev, programId: e.target.value }))
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
            value={allocatedClassFilters.sessionId}
            onChange={(e) =>
              setAllocatedClassFilters((prev) => ({ ...prev, sessionId: e.target.value }))
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
            value={allocatedClassFilters.branchId}
            onChange={(e) =>
              setAllocatedClassFilters((prev) => ({ ...prev, branchId: e.target.value }))
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
            value={allocatedClassFilters.semester}
            onChange={(e) =>
              setAllocatedClassFilters((prev) => ({ ...prev, semester: e.target.value }))
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
            value={allocatedClassFilters.groupLabel}
            onChange={(e) =>
              setAllocatedClassFilters((prev) => ({ ...prev, groupLabel: e.target.value }))
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
            value={allocatedClassFilters.teacherId}
            onChange={(e) =>
              setAllocatedClassFilters((prev) => ({ ...prev, teacherId: e.target.value }))
            }
          >
            <option value="all">All Teachers</option>
            {allocatedClassFilterOptions.teachers.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            className="select-field"
            value={allocatedClassFilters.subject}
            onChange={(e) =>
              setAllocatedClassFilters((prev) => ({ ...prev, subject: e.target.value }))
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

        {isLoadingAllocatedClasses ? (
          <p className="empty-state">Loading allocated classes...</p>
        ) : filteredAllocatedClasses.length > 0 ? (
          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Program</th>
                  <th>Session</th>
                  <th>Branch</th>
                  <th>Sem</th>
                  <th>Group</th>
                  <th>Subject</th>
                  <th>Teacher</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAllocatedClasses.map((cls) => (
                  <tr key={cls._id}>
                    <td>{cls.className}</td>
                    <td>{cls.program?.code || cls.program?.name || "-"}</td>
                    <td>{cls.session?.label || "-"}</td>
                    <td>{cls.branch?.code || cls.branch?.name || "-"}</td>
                    <td>{cls.academicSemester || "-"}</td>
                    <td>{cls.groupLabel || "-"}</td>
                    <td>{cls.subject}</td>
                    <td>{cls.teacher?.name}</td>
                    <td>
                      <div className="admin-actions">
                        <button
                          className="btn-secondary"
                          type="button"
                          onClick={() => openTeacherChange(cls)}
                        >
                          Change Teacher
                        </button>
                      </div>
                      {teacherChangeRowId === cls._id && (
                        <div className="class-change-inline">
                          <select
                            className="select-field"
                            value={teacherChangeForm.teacherId}
                            onChange={(e) =>
                              setTeacherChangeForm((prev) => ({
                                ...prev,
                                teacherId: e.target.value,
                              }))
                            }
                            disabled={isChangingTeacher || isLoadingTeachers}
                          >
                            <option value="">Select Teacher</option>
                            {teachers.map((teacher) => (
                              <option key={teacher._id} value={teacher._id}>
                                {teacher.teacherId
                                  ? `${teacher.name} (${teacher.teacherId})`
                                  : teacher.name}
                              </option>
                            ))}
                          </select>
                          <select
                            className="select-field"
                            value={teacherChangeForm.mode}
                            onChange={(e) =>
                              setTeacherChangeForm((prev) => ({
                                ...prev,
                                mode: e.target.value,
                              }))
                            }
                            disabled={isChangingTeacher}
                          >
                            <option value="full_sem">Full Sem</option>
                            <option value="one_day">One Day</option>
                          </select>
                          {teacherChangeForm.mode === "one_day" && (
                            <input
                              className="date-field"
                              type="date"
                              value={teacherChangeForm.date}
                              onChange={(e) =>
                                setTeacherChangeForm((prev) => ({
                                  ...prev,
                                  date: e.target.value,
                                }))
                              }
                              disabled={isChangingTeacher}
                            />
                          )}
                          <div className="admin-actions">
                            <button
                              className="btn-primary"
                              type="button"
                              onClick={() => submitTeacherChange(cls._id)}
                              disabled={isChangingTeacher}
                            >
                              {isChangingTeacher ? "Saving..." : "Save"}
                            </button>
                            <button
                              className="btn-ghost"
                              type="button"
                              onClick={cancelTeacherChange}
                              disabled={isChangingTeacher}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">No classes found for selected filter.</p>
        )}
      </section>

      {toastMessage && <div className={`toast-msg ${toastVariant}`}>{toastMessage}</div>}
    </div>
  );
}

export default AdminAllocatedClasses;
