import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../api/axios";

const defaultFilters = {
  programId: "all",
  sessionId: "all",
  branchId: "all",
  semester: "all",
  groupLabel: "all",
  subject: "all",
};

function AdminRanking() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [profile, setProfile] = useState(null);
  const [adminError, setAdminError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState("success");
  const [isLoading, setIsLoading] = useState(false);
  const [ranking, setRanking] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [filters, setFilters] = useState(defaultFilters);

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
      setAdminError("");
      const res = await API.get("/classes/all");
      setAllClasses(res.data || []);
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to fetch classes");
    }
  };

  const fetchRanking = async (activeFilters = filters) => {
    try {
      setIsLoading(true);
      setAdminError("");
      const params = {};
      if (activeFilters.programId !== "all") {
        params.programId = activeFilters.programId;
      }
      if (activeFilters.sessionId !== "all") {
        params.sessionId = activeFilters.sessionId;
      }
      if (activeFilters.branchId !== "all") {
        params.branchId = activeFilters.branchId;
      }
      if (activeFilters.semester !== "all") {
        params.semester = activeFilters.semester;
      }
      if (activeFilters.groupLabel !== "all") {
        params.groupLabel = activeFilters.groupLabel;
      }
      if (activeFilters.subject !== "all") {
        params.subject = activeFilters.subject;
      }

      const res = await API.get("/attendance/ranking", {
        params: Object.keys(params).length > 0 ? params : undefined,
      });
      setRanking(res.data || []);
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to fetch ranking");
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
        await fetchAllClasses();

        if (searchParams.get("reset") === "1") {
          setFilters(defaultFilters);
          showToast("Ranking filters reset");
          await fetchRanking(defaultFilters);
          return;
        }

        await fetchRanking();
      } catch (error) {
        console.error(error);
        localStorage.removeItem("token");
        navigate("/");
      }
    };

    verifyAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const filterOptions = useMemo(() => {
    const createSortedList = (items) =>
      Array.from(items.values()).sort((left, right) => left.label.localeCompare(right.label));

    const programMap = new Map();
    const sessionMap = new Map();
    const branchMap = new Map();
    const semesterMap = new Map();
    const groupMap = new Map();
    const subjectMap = new Map();

    allClasses.forEach((cls) => {
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
      subjects: createSortedList(subjectMap),
    };
  }, [allClasses]);

  const handleReset = () => {
    setFilters(defaultFilters);
    fetchRanking(defaultFilters);
  };

  return (
    <div className="page-shell dashboard-layout">
      <span className="ambient-orb teal" />
      <span className="ambient-orb gold" />

      <header className="card topbar">
        <div>
          <h1 className="topbar-title">Attendance Ranking</h1>
          <p className="topbar-subtitle">Filter by scope and view ranked student attendance.</p>
        </div>
        <div className="admin-actions">
          <button className="btn-ghost" type="button" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </button>
        </div>
      </header>

      <section className="card panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Ranking</h2>
            <p className="panel-subtitle">Admin: {profile?.name || "Admin"}</p>
          </div>
        </div>

        {adminError && <div className="error-banner">{adminError}</div>}

        <div className="allocated-class-filter-grid">
          <select
            className="select-field"
            value={filters.programId}
            onChange={(e) => setFilters((prev) => ({ ...prev, programId: e.target.value }))}
          >
            <option value="all">All Programs</option>
            {filterOptions.programs.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            className="select-field"
            value={filters.sessionId}
            onChange={(e) => setFilters((prev) => ({ ...prev, sessionId: e.target.value }))}
          >
            <option value="all">All Sessions</option>
            {filterOptions.sessions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            className="select-field"
            value={filters.branchId}
            onChange={(e) => setFilters((prev) => ({ ...prev, branchId: e.target.value }))}
          >
            <option value="all">All Branches</option>
            {filterOptions.branches.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            className="select-field"
            value={filters.semester}
            onChange={(e) => setFilters((prev) => ({ ...prev, semester: e.target.value }))}
          >
            <option value="all">All Semesters</option>
            {filterOptions.semesters.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            className="select-field"
            value={filters.groupLabel}
            onChange={(e) => setFilters((prev) => ({ ...prev, groupLabel: e.target.value }))}
          >
            <option value="all">All Groups</option>
            {filterOptions.groups.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            className="select-field"
            value={filters.subject}
            onChange={(e) => setFilters((prev) => ({ ...prev, subject: e.target.value }))}
          >
            <option value="all">All Subjects</option>
            {filterOptions.subjects.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-actions" style={{ marginTop: "0.7rem" }}>
          <button className="btn-ghost" type="button" onClick={() => fetchRanking()}>
            {isLoading ? "Loading..." : "View Ranking"}
          </button>
          <button className="btn-secondary" type="button" onClick={handleReset}>
            Reset Ranking Filters
          </button>
        </div>

        {isLoading && <p className="empty-state">Loading ranking...</p>}

        {!isLoading && ranking.length === 0 && (
          <p className="empty-state">No ranking data found for selected filter.</p>
        )}

        {!isLoading && ranking.length > 0 && (
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

      {toastMessage && <div className={`toast-msg ${toastVariant}`}>{toastMessage}</div>}
    </div>
  );
}

export default AdminRanking;
