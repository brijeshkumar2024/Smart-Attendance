/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from "react";
import API from "../api/axios";

const MONTH_OPTIONS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

function StudentDashboard() {
  const [data, setData] = useState([]);
  const [monthly, setMonthly] = useState(null);
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [studentError, setStudentError] = useState("");
  const [isLoadingClassWise, setIsLoadingClassWise] = useState(true);
  const [isLoadingMonthly, setIsLoadingMonthly] = useState(true);
  const [classFilter, setClassFilter] = useState("all");
  const [subjectSearch, setSubjectSearch] = useState("");
  const [sortMode, setSortMode] = useState("percentage_desc");
  const currentYear = new Date().getFullYear();

  const yearOptions = useMemo(
    () => Array.from({ length: 7 }, (_, index) => currentYear - 3 + index),
    [currentYear]
  );

  const fetchClassWise = async () => {
    try {
      setIsLoadingClassWise(true);
      setStudentError("");
      const res = await API.get("/attendance/class-wise-percentage");
      setData(res.data);
    } catch (error) {
      console.error(error);
      setStudentError(error.response?.data?.message || "Failed to load class-wise analytics");
    } finally {
      setIsLoadingClassWise(false);
    }
  };

  const fetchMonthlyReport = async () => {
    try {
      setIsLoadingMonthly(true);
      setStudentError("");
      const res = await API.get("/attendance/monthly", {
        params: { month, year },
      });
      setMonthly(res.data);
    } catch (error) {
      console.error(error);
      setStudentError(error.response?.data?.message || "Failed to load monthly report");
    } finally {
      setIsLoadingMonthly(false);
    }
  };

  const refreshStudentData = async () => {
    await Promise.all([fetchClassWise(), fetchMonthlyReport()]);
  };

  useEffect(() => {
    fetchClassWise();
  }, []);

  useEffect(() => {
    fetchMonthlyReport();
  }, [month, year]);

  const selectedMonthName =
    MONTH_OPTIONS.find((entry) => entry.value === month)?.label || `Month ${month}`;

  const overallSummary = useMemo(() => {
    const totalClasses = data.reduce((acc, item) => acc + Number(item.totalClasses || 0), 0);
    const totalPresent = data.reduce((acc, item) => acc + Number(item.present || 0), 0);
    const lowSubjects = data.filter((item) => item.isLowAttendance).length;
    const overallPercentage =
      totalClasses === 0 ? 0 : Number(((totalPresent / totalClasses) * 100).toFixed(1));

    const bestSubject =
      data.length === 0
        ? null
        : [...data].sort((a, b) => Number(b.percentage) - Number(a.percentage))[0];

    return { totalClasses, totalPresent, lowSubjects, overallPercentage, bestSubject };
  }, [data]);

  const filteredData = useMemo(() => {
    const normalizedQuery = subjectSearch.trim().toLowerCase();
    let scoped = [...data];

    if (classFilter === "warning") {
      scoped = scoped.filter((item) => item.isLowAttendance);
    }

    if (normalizedQuery) {
      scoped = scoped.filter((item) => {
        const className = String(item.className || "").toLowerCase();
        const subject = String(item.subject || "").toLowerCase();
        return className.includes(normalizedQuery) || subject.includes(normalizedQuery);
      });
    }

    scoped.sort((left, right) => {
      if (sortMode === "percentage_asc") {
        return Number(left.percentage) - Number(right.percentage);
      }
      if (sortMode === "name_asc") {
        return String(left.className || "").localeCompare(String(right.className || ""));
      }
      return Number(right.percentage) - Number(left.percentage);
    });

    return scoped;
  }, [data, classFilter, subjectSearch, sortMode]);

  const monthlyStatus = Number(monthly?.percentage || 0) < 75 ? "warning" : "healthy";

  return (
    <section className="card panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Student Analytics</h2>
          <p className="panel-subtitle">Subject-wise attendance performance.</p>
        </div>
        <div className="admin-actions">
          <button className="btn-ghost" type="button" onClick={refreshStudentData}>
            Refresh Student Data
          </button>
        </div>
      </div>

      {studentError && <div className="error-banner">{studentError}</div>}

      <div className="monthly-card">
        <div className="student-controls">
          <select
            className="select-field"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTH_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            className="select-field"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {yearOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button
            className="btn-primary"
            onClick={fetchMonthlyReport}
            type="button"
            disabled={isLoadingMonthly}
          >
            {isLoadingMonthly ? "Loading..." : "Refresh Report"}
          </button>
        </div>

        {isLoadingMonthly ? (
          <p className="empty-state">Loading monthly snapshot...</p>
        ) : (
          <div className="metrics-grid">
            <article className="metric">
              <span className="metric-label">Month</span>
              <div className="metric-value">{selectedMonthName}</div>
            </article>
            <article className="metric">
              <span className="metric-label">Total Classes</span>
              <div className="metric-value">{monthly?.totalClasses || 0}</div>
            </article>
            <article className="metric">
              <span className="metric-label">Attendance</span>
              <div className="metric-value">{monthly?.percentage || 0}%</div>
              <div className={`student-chip ${monthlyStatus}`}>
                {monthlyStatus === "warning" ? "Below 75%" : "Healthy"}
              </div>
            </article>
          </div>
        )}
      </div>

      <div className="metrics-grid student-summary-grid">
        <article className="metric">
          <span className="metric-label">Overall Attendance</span>
          <div className="metric-value">{overallSummary.overallPercentage}%</div>
        </article>
        <article className="metric">
          <span className="metric-label">Present / Total</span>
          <div className="metric-value">
            {overallSummary.totalPresent}/{overallSummary.totalClasses}
          </div>
        </article>
        <article className="metric">
          <span className="metric-label">Low Subjects</span>
          <div className="metric-value">{overallSummary.lowSubjects}</div>
        </article>
        <article className="metric">
          <span className="metric-label">Best Subject</span>
          <div className="metric-value">
            {overallSummary.bestSubject ? overallSummary.bestSubject.subject : "-"}
          </div>
          {overallSummary.bestSubject && (
            <div className="student-metric-note">{overallSummary.bestSubject.percentage}%</div>
          )}
        </article>
      </div>

      <div className="student-analytics-head">
        <h3 className="panel-title" style={{ fontSize: "1rem" }}>
          Subject Breakdown
        </h3>
        <div className="teacher-bulk-shortcuts">
          <button
            className="btn-ghost"
            type="button"
            onClick={() => setClassFilter("all")}
            disabled={classFilter === "all"}
          >
            All Subjects
          </button>
          <button
            className="btn-ghost"
            type="button"
            onClick={() => setClassFilter("warning")}
            disabled={classFilter === "warning"}
          >
            Low Attendance Only
          </button>
          <button
            className="btn-primary"
            type="button"
            onClick={fetchClassWise}
            disabled={isLoadingClassWise}
          >
            {isLoadingClassWise ? "Loading..." : "Load Analytics"}
          </button>
        </div>
      </div>

      <div className="teacher-filter-grid" style={{ marginBottom: "0.8rem" }}>
        <input
          className="input-field"
          placeholder="Search by class or subject"
          value={subjectSearch}
          onChange={(e) => setSubjectSearch(e.target.value)}
        />
        <select
          className="select-field"
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value)}
        >
          <option value="percentage_desc">Highest Attendance</option>
          <option value="percentage_asc">Lowest Attendance</option>
          <option value="name_asc">Class Name A-Z</option>
        </select>
      </div>

      {isLoadingClassWise && <p className="empty-state">Loading class-wise analytics...</p>}

      {!isLoadingClassWise && data.length === 0 && (
        <p className="empty-state">No attendance data found yet.</p>
      )}

      {!isLoadingClassWise && data.length > 0 && filteredData.length === 0 && (
        <p className="empty-state">No subjects match the selected filter.</p>
      )}

      {!isLoadingClassWise && filteredData.length > 0 && (
        <div className="analytics-grid">
          {filteredData.map((item) => (
            <article className="metric" key={item.className}>
              <h3 className="analytics-class">{item.className}</h3>
              <p className="analytics-meta">Subject: {item.subject}</p>
              <p className="analytics-meta">Attendance: {item.percentage}%</p>
              <p className="analytics-meta">
                Present {item.present} of {item.totalClasses}
              </p>
              {item.isLowAttendance && (
                <span className="warning-pill">Low Attendance</span>
              )}
              {!item.isLowAttendance && (
                <span className="status-pill">Healthy</span>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default StudentDashboard;
