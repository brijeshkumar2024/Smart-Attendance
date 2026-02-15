import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import { io } from "socket.io-client";
import StudentDashboard from "./StudentDashboard";
import AddUserForm from "../components/AddUserForm";

const socket = io("http://localhost:5000", { autoConnect: false });

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
  const [filterDate, setFilterDate] = useState("");
  const [status, setStatus] = useState("Present");
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [users, setUsers] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [allocatedClasses, setAllocatedClasses] = useState([]);
  const [allocationForm, setAllocationForm] = useState({
    className: "",
    subject: "",
    teacherId: "",
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
      fetchStudents();
    }
    if (user?.role === "admin") {
      fetchUsers();
      fetchTeachers();
      fetchAllClasses();
    }
  }, [user]);

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
  }, [user, selectedClass, filterDate]);

  const fetchLowAttendance = async () => {
    try {
      const res = await API.get("/attendance/low-attendance?limit=75");
      setLowAttendance(res.data);
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Failed to fetch low attendance");
    }
  };

  const fetchTeacherClasses = async () => {
    try {
      const res = await API.get("/classes/my-classes");
      setClasses(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchRanking = async () => {
    try {
      const res = await API.get("/attendance/ranking");
      setRanking(res.data);
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Failed to fetch ranking");
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await API.get("/users/students");
      setStudents(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await API.get("/users");
      setUsers(res.data);
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Failed to fetch users");
    }
  };

  const fetchTeachers = async () => {
    try {
      const res = await API.get("/users/teachers");
      setTeachers(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchAllClasses = async () => {
    try {
      const res = await API.get("/classes/all");
      setAllocatedClasses(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleRoleChange = async (id, newRole) => {
    try {
      await API.patch(`/users/${id}/role`, { role: newRole });
      showToast("Role updated");
      fetchUsers();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Failed to update role");
    }
  };

  const handleDeactivateUser = async (id) => {
    try {
      await API.patch(`/users/${id}/deactivate`);
      showToast("User deactivated");
      fetchUsers();
      fetchTeachers();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Failed to deactivate user");
    }
  };

  const handleResetPassword = async (id) => {
    const newPassword = window.prompt("Enter new password");
    if (!newPassword) {
      return;
    }

    try {
      await API.patch(`/users/${id}/reset-password`, { newPassword });
      showToast("Password reset");
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Failed to reset password");
    }
  };

  const handleAllocateClass = async () => {
    try {
      if (!allocationForm.className || !allocationForm.subject || !allocationForm.teacherId) {
        alert("Class name, subject and teacher are required");
        return;
      }

      await API.post("/classes/allocate", allocationForm);
      showToast("Class allocated");
      setAllocationForm({ className: "", subject: "", teacherId: "" });
      fetchAllClasses();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Failed to allocate class");
    }
  };

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(""), 2200);
  };

  const fetchAttendanceByClass = async () => {
    if (!selectedClass) {
      alert("Please select class");
      return;
    }

    try {
      const params = { classId: selectedClass };
      if (filterDate) {
        params.start = filterDate;
        params.end = filterDate;
      }

      const res = await API.get(`/attendance`, { params });
      setAttendanceRecords(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateAttendance = async (id, newStatus) => {
    try {
      await API.put(`/attendance/${id}`, {
        status: newStatus,
      });

      fetchAttendanceByClass();

    } catch (error) {
      console.error(error);
      alert("Failed to update attendance");
    }
  };

  const handleDelete = async (id) => {
    try {
      await API.delete(`/attendance/${id}`);
      fetchAttendanceByClass();
    } catch (error) {
      console.error(error);
      alert("Failed to delete attendance");
    }
  };

  const loadBulkRows = () => {
    if (!selectedClass || !bulkDate) {
      alert("Select class and date for bulk attendance");
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
      alert("Prepare bulk attendance first");
      return;
    }

    try {
      setIsSubmittingBulk(true);
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
      alert(error.response?.data?.message || "Bulk attendance failed");
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  const downloadCSV = () => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please login again");
      return;
    }

    window.open(
      `http://localhost:5000/api/attendance/export-csv?token=${encodeURIComponent(token)}`,
      "_blank"
    );
  };

  const downloadPDF = () => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please login again");
      return;
    }

    window.open(
      `http://localhost:5000/api/attendance/export-pdf?token=${encodeURIComponent(token)}`,
      "_blank"
    );
  };

  const markAttendance = async () => {
    try {
      await API.post("/attendance", {
        studentId,
        classId: selectedClass,
        date,
        status,
      });

      alert("Attendance marked successfully");
      setStudentId("");
      setDate("");
      setStatus("Present");
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Error marking attendance");
    }
  };

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
          </div>

          {classes.length === 0 && (
            <div className="bulk-lock-note" style={{ marginBottom: "0.85rem" }}>
              No classes are allocated to this teacher yet. Ask admin to allocate class + subject in
              the Admin Panel.
            </div>
          )}

          <div className="bulk-card">
            <h3 className="panel-title">Add Student</h3>
            <p className="panel-subtitle">
              Teachers can create student accounts only.
            </p>
            <AddUserForm defaultRole="student" onCreated={fetchStudents} />
          </div>

          <div className="panel-form">
            <div>
              <label className="field-label" htmlFor="class-select">
                Class
              </label>
              <select
                id="class-select"
                className="select-field"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                <option value="">Select Class</option>
                {classes.map((cls) => (
                  <option key={cls._id} value={cls._id}>
                    {cls.className} - {cls.subject}
                  </option>
                ))}
              </select>
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
              >
                <option value="">Select Student</option>
                {students.map((student) => (
                  <option key={student._id} value={student._id}>
                    {student.name}
                  </option>
                ))}
              </select>
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
              <button className="btn-primary" onClick={fetchAttendanceByClass} type="button">
                View Attendance Records
              </button>
            </div>

            <div className="field-full">
              <button className="btn-secondary" onClick={markAttendance} type="button">
                Mark Attendance
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
                disabled={isBulkDateLocked}
              />
              <button className="btn-primary" onClick={loadBulkRows} type="button">
                Load Students
              </button>
              <button
                className="btn-secondary"
                onClick={submitBulkAttendance}
                type="button"
                disabled={isSubmittingBulk}
              >
                {isSubmittingBulk ? "Submitting..." : "Submit Bulk"}
              </button>
            </div>
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

          <div style={{ marginTop: "1rem", maxWidth: "280px" }}>
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

          {attendanceRecords.length > 0 && (
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
                  {attendanceRecords.map((record) => (
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
                      >
                        Delete
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
                Find students under attendance threshold and take action.
              </p>
            </div>
            <div className="admin-actions">
              <button className="btn-primary" onClick={fetchLowAttendance} type="button">
                View Low Attendance
              </button>
              <button className="btn-secondary" onClick={downloadCSV} type="button">
                Download CSV
              </button>
              <button className="btn-secondary" onClick={downloadPDF} type="button">
                Download PDF
              </button>
              <button className="btn-ghost" onClick={fetchRanking} type="button">
                View Ranking
              </button>
            </div>
          </div>

          <div className="add-user-grid">
            <div className="bulk-card">
              <h3 className="panel-title">Add Teacher</h3>
              <p className="panel-subtitle">Create teacher accounts.</p>
              <AddUserForm
                defaultRole="teacher"
                onCreated={() => {
                  fetchUsers();
                  fetchTeachers();
                }}
              />
            </div>
            <div className="bulk-card">
              <h3 className="panel-title">Add Student</h3>
              <p className="panel-subtitle">Create student accounts.</p>
              <AddUserForm
                defaultRole="student"
                onCreated={fetchUsers}
              />
            </div>
          </div>

          <div className="bulk-card">
            <h3 className="panel-title">Teacher-Class Allocation</h3>
            <p className="panel-subtitle">Assign class and subject to a teacher.</p>
            <div className="add-user-grid">
              <input
                className="input-field"
                placeholder="Class Name"
                value={allocationForm.className}
                onChange={(e) =>
                  setAllocationForm({ ...allocationForm, className: e.target.value })
                }
              />
              <input
                className="input-field"
                placeholder="Subject"
                value={allocationForm.subject}
                onChange={(e) =>
                  setAllocationForm({ ...allocationForm, subject: e.target.value })
                }
              />
              <select
                className="select-field"
                value={allocationForm.teacherId}
                onChange={(e) =>
                  setAllocationForm({ ...allocationForm, teacherId: e.target.value })
                }
              >
                <option value="">Select Teacher</option>
                {teachers.map((teacher) => (
                  <option key={teacher._id} value={teacher._id}>
                    {teacher.name} ({teacher.subject || "No subject"})
                  </option>
                ))}
              </select>
              <button className="btn-primary" onClick={handleAllocateClass} type="button">
                Allocate Class
              </button>
            </div>
          </div>

          {allocatedClasses.length > 0 && (
            <div className="table-wrap" style={{ marginTop: "1rem" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Subject</th>
                    <th>Teacher</th>
                  </tr>
                </thead>
                <tbody>
                  {allocatedClasses.map((cls) => (
                    <tr key={cls._id}>
                      <td>{cls.className}</td>
                      <td>{cls.subject}</td>
                      <td>{cls.teacher?.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="bulk-card">
            <h3 className="panel-title">User List</h3>
            <p className="panel-subtitle">Manage role, status, and password.</p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <select
                          className="status-select"
                          value={u.role}
                          onChange={(e) => handleRoleChange(u._id, e.target.value)}
                          disabled={u._id === user.id}
                        >
                          <option value="admin">admin</option>
                          <option value="teacher">teacher</option>
                          <option value="student">student</option>
                        </select>
                      </td>
                      <td>{u.subject || "-"}</td>
                      <td>{u.isActive ? "Active" : "Inactive"}</td>
                      <td>
                        <div className="admin-actions">
                          <button
                            className="btn-secondary"
                            type="button"
                            onClick={() => handleResetPassword(u._id)}
                          >
                            Reset Password
                          </button>
                          {u.isActive && u._id !== user.id && (
                            <button
                              className="btn-danger-sm"
                              type="button"
                              onClick={() => handleDeactivateUser(u._id)}
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {lowAttendance.length === 0 && (
            <p className="empty-state">
              No records loaded yet. Click "View Low Attendance" to fetch data.
            </p>
          )}

          {lowAttendance.length > 0 && (
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

          {ranking.length > 0 && (
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
      {toastMessage && <div className="toast-msg">{toastMessage}</div>}
    </div>
  );
}

export default Dashboard;
