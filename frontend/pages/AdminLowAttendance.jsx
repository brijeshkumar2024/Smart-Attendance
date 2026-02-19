/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";

function AdminLowAttendance() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [adminError, setAdminError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState("success");
  const [isLoading, setIsLoading] = useState(false);
  const [isDeactivatingAll, setIsDeactivatingAll] = useState(false);
  const [deactivatingStudentId, setDeactivatingStudentId] = useState("");
  const [records, setRecords] = useState([]);

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

  const fetchLowAttendance = async () => {
    try {
      setIsLoading(true);
      setAdminError("");
      const res = await API.get("/attendance/low-attendance", {
        params: { limit: 75 },
      });
      setRecords(res.data || []);
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to fetch low attendance");
    } finally {
      setIsLoading(false);
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
        fetchLowAttendance();
      } catch (error) {
        console.error(error);
        localStorage.removeItem("token");
        navigate("/");
      }
    };

    verifyAdmin();
  }, [navigate]);

  const deactivateStudent = async (student) => {
    if (!student?.studentId) {
      return;
    }

    const confirmed = window.confirm(`Deactivate ${student.name}?`);
    if (!confirmed) {
      return;
    }

    try {
      setAdminError("");
      setDeactivatingStudentId(student.studentId);
      await API.patch(`/users/${student.studentId}/deactivate`);
      showToast(`${student.name} deactivated`);
      await fetchLowAttendance();
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to deactivate student");
    } finally {
      setDeactivatingStudentId("");
    }
  };

  const deactivateAllListed = async () => {
    if (records.length === 0) {
      showToast("No students to deactivate", "error");
      return;
    }

    const confirmed = window.confirm(
      `Deactivate all ${records.length} listed low-attendance students?`
    );
    if (!confirmed) {
      return;
    }

    try {
      setAdminError("");
      setIsDeactivatingAll(true);

      const results = await Promise.allSettled(
        records.map((student) => API.patch(`/users/${student.studentId}/deactivate`))
      );

      const successCount = results.filter((entry) => entry.status === "fulfilled").length;
      const failedCount = results.length - successCount;

      if (failedCount > 0) {
        showToast(
          `${successCount} deactivated, ${failedCount} failed. Please retry remaining.`,
          "error"
        );
      } else {
        showToast(`Deactivated all ${successCount} students`);
      }

      await fetchLowAttendance();
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to deactivate all listed students");
    } finally {
      setIsDeactivatingAll(false);
    }
  };

  return (
    <div className="page-shell dashboard-layout">
      <span className="ambient-orb teal" />
      <span className="ambient-orb gold" />

      <header className="card topbar">
        <div>
          <h1 className="topbar-title">Low Attendance</h1>
          <p className="topbar-subtitle">Students below 75% attendance (admin view).</p>
        </div>
        <div className="admin-actions">
          <button className="btn-ghost" type="button" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </button>
          <button className="btn-secondary" type="button" onClick={fetchLowAttendance}>
            Refresh
          </button>
        </div>
      </header>

      <section className="card panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Low Attendance Report</h2>
            <p className="panel-subtitle">Admin: {profile?.name || "Admin"}</p>
          </div>
          <div className="admin-actions">
            <button
              className="btn-danger-sm"
              type="button"
              onClick={deactivateAllListed}
              disabled={isLoading || isDeactivatingAll || records.length === 0}
            >
              {isDeactivatingAll ? "Deactivating..." : "Deactivate All Listed"}
            </button>
          </div>
        </div>

        {adminError && <div className="error-banner">{adminError}</div>}

        {isLoading && <p className="empty-state">Loading low-attendance records...</p>}

        {!isLoading && records.length === 0 && (
          <p className="empty-state">No low-attendance records found.</p>
        )}

        {!isLoading && records.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Total Classes</th>
                  <th>Present</th>
                  <th>Percentage</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((student) => (
                  <tr key={student.studentId}>
                    <td>{student.name}</td>
                    <td>{student.email}</td>
                    <td>{student.totalClasses}</td>
                    <td>{student.present}</td>
                    <td>
                      <span className="status-pill">{student.percentage}%</span>
                    </td>
                    <td>
                      <button
                        className="btn-danger-sm"
                        type="button"
                        onClick={() => deactivateStudent(student)}
                        disabled={isDeactivatingAll || deactivatingStudentId === student.studentId}
                      >
                        {deactivatingStudentId === student.studentId
                          ? "Deactivating..."
                          : "Deactivate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {toastMessage && <div className={`toast-msg ${toastVariant}`}>{toastMessage}</div>}
    </div>
  );
}

export default AdminLowAttendance;
