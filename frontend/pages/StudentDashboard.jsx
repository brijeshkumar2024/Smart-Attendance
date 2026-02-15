import { useEffect, useState } from "react";
import API from "../api/axios";

function StudentDashboard() {
  const [data, setData] = useState([]);
  const [monthly, setMonthly] = useState(null);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);

  const fetchClassWise = async () => {
    try {
      const res = await API.get("/attendance/class-wise-percentage");
      setData(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyReport = async () => {
    try {
      const res = await API.get("/attendance/monthly", {
        params: { month, year },
      });
      setMonthly(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchClassWise();
  }, []);

  useEffect(() => {
    fetchMonthlyReport();
  }, [month, year]);

  return (
    <section className="card panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Student Analytics</h2>
          <p className="panel-subtitle">Subject-wise attendance performance.</p>
        </div>
      </div>

      <div className="monthly-card">
        <div className="monthly-controls">
          <input
            className="input-field"
            type="number"
            min="1"
            max="12"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          />
          <input
            className="input-field"
            type="number"
            min="2000"
            max="2100"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
          <button className="btn-primary" onClick={fetchMonthlyReport} type="button">
            Refresh Report
          </button>
        </div>
        {monthly && (
          <div className="metrics-grid">
            <article className="metric">
              <span className="metric-label">Month</span>
              <div className="metric-value">{monthly.month}/{monthly.year}</div>
            </article>
            <article className="metric">
              <span className="metric-label">Total Classes</span>
              <div className="metric-value">{monthly.totalClasses}</div>
            </article>
            <article className="metric">
              <span className="metric-label">Attendance</span>
              <div className="metric-value">{monthly.percentage}%</div>
            </article>
          </div>
        )}
      </div>

      {loading && <p className="empty-state">Loading class-wise analytics...</p>}

      {!loading && data.length === 0 && (
        <p className="empty-state">No attendance data found yet.</p>
      )}

      {!loading && data.length > 0 && (
        <div className="analytics-grid">
          {data.map((item) => (
            <article className="metric" key={item.className}>
              <h3 className="analytics-class">{item.className}</h3>
              <p className="analytics-meta">Subject: {item.subject}</p>
              <p className="analytics-meta">Attendance: {item.percentage}%</p>
              {item.isLowAttendance && (
                <span className="warning-pill">Low Attendance</span>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default StudentDashboard;
