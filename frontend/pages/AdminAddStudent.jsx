/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";

function AdminAddStudent() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [adminError, setAdminError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState("success");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    programId: "",
    sessionId: "",
    branchId: "",
    semester: "1",
    groupLabel: "1",
  });

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

  const fetchPrograms = async () => {
    try {
      setIsLoadingPrograms(true);
      setAdminError("");
      const res = await API.get("/admin/academic/programs");
      setPrograms(res.data || []);
      setForm((prev) => {
        const keepProgram = (res.data || []).some((entry) => entry._id === prev.programId);
        return { ...prev, programId: keepProgram ? prev.programId : res.data?.[0]?._id || "" };
      });
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to load programs");
    } finally {
      setIsLoadingPrograms(false);
    }
  };

  const fetchSessions = async (programId) => {
    try {
      setIsLoadingSessions(true);
      setAdminError("");
      const res = await API.get("/admin/academic/sessions", { params: { programId } });
      setSessions(res.data || []);
      setForm((prev) => {
        const keepSession = (res.data || []).some((entry) => entry._id === prev.sessionId);
        return { ...prev, sessionId: keepSession ? prev.sessionId : res.data?.[0]?._id || "" };
      });
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to load sessions");
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const fetchBranches = async (programId, sessionId) => {
    try {
      setIsLoadingBranches(true);
      setAdminError("");
      const res = await API.get("/admin/academic/branches", {
        params: { programId, sessionId },
      });
      setBranches(res.data || []);
      setForm((prev) => {
        const keepBranch = (res.data || []).some((entry) => entry._id === prev.branchId);
        return { ...prev, branchId: keepBranch ? prev.branchId : res.data?.[0]?._id || "" };
      });
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to load branches");
    } finally {
      setIsLoadingBranches(false);
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
        fetchPrograms();
      } catch (error) {
        console.error(error);
        localStorage.removeItem("token");
        navigate("/");
      }
    };

    verifyAdmin();
  }, [navigate]);

  useEffect(() => {
    if (!form.programId) {
      setSessions([]);
      setBranches([]);
      setForm((prev) => ({ ...prev, sessionId: "", branchId: "" }));
      return;
    }
    fetchSessions(form.programId);
  }, [form.programId]);

  useEffect(() => {
    if (!form.programId || !form.sessionId) {
      setBranches([]);
      setForm((prev) => ({ ...prev, branchId: "" }));
      return;
    }
    fetchBranches(form.programId, form.sessionId);
  }, [form.programId, form.sessionId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (
      !form.name.trim() ||
      !form.email.trim() ||
      !form.password ||
      !form.programId ||
      !form.sessionId ||
      !form.branchId ||
      !form.semester ||
      !form.groupLabel
    ) {
      showToast("Please fill all required fields", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      setAdminError("");
      await API.post("/users", {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: "student",
        programId: form.programId,
        sessionId: form.sessionId,
        branchId: form.branchId,
        semester: Number.parseInt(form.semester, 10),
        groupLabel: form.groupLabel,
      });
      showToast("Student created");
      setForm((prev) => ({
        ...prev,
        name: "",
        email: "",
        password: "",
      }));
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to create student");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-shell dashboard-layout">
      <span className="ambient-orb teal" />
      <span className="ambient-orb gold" />

      <header className="card topbar">
        <div>
          <h1 className="topbar-title">Add New Student</h1>
          <p className="topbar-subtitle">Name, email, scope selection, then create student.</p>
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
            <h2 className="panel-title">Student Creation</h2>
            <p className="panel-subtitle">Admin: {profile?.name || "Admin"}</p>
          </div>
        </div>

        {adminError && <div className="error-banner">{adminError}</div>}

        <div className="bulk-card">
          <form className="stack" onSubmit={handleSubmit} style={{ gap: "0.6rem" }}>
            <input
              className="input-field"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
            <input
              className="input-field"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
            <input
              className="input-field"
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />

            <select
              className="select-field"
              value={form.programId}
              onChange={(e) => setForm((prev) => ({ ...prev, programId: e.target.value }))}
              disabled={isLoadingPrograms}
              required
            >
              <option value="">
                {isLoadingPrograms ? "Loading programs..." : "Select Program"}
              </option>
              {programs.map((program) => (
                <option key={program._id} value={program._id}>
                  {program.code ? `${program.code} - ${program.name}` : program.name}
                </option>
              ))}
            </select>

            <select
              className="select-field"
              value={form.sessionId}
              onChange={(e) => setForm((prev) => ({ ...prev, sessionId: e.target.value }))}
              disabled={!form.programId || isLoadingSessions}
              required
            >
              <option value="">
                {isLoadingSessions ? "Loading sessions..." : "Select Session"}
              </option>
              {sessions.map((session) => (
                <option key={session._id} value={session._id}>
                  {session.label}
                </option>
              ))}
            </select>

            <select
              className="select-field"
              value={form.branchId}
              onChange={(e) => setForm((prev) => ({ ...prev, branchId: e.target.value }))}
              disabled={!form.sessionId || isLoadingBranches}
              required
            >
              <option value="">
                {isLoadingBranches ? "Loading branches..." : "Select Branch"}
              </option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.code ? `${branch.code} - ${branch.name}` : branch.name}
                </option>
              ))}
            </select>

            <select
              className="select-field"
              value={form.semester}
              onChange={(e) => setForm((prev) => ({ ...prev, semester: e.target.value }))}
              required
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((semester) => (
                <option key={semester} value={semester}>
                  Semester {semester}
                </option>
              ))}
            </select>

            <select
              className="select-field"
              value={form.groupLabel}
              onChange={(e) => setForm((prev) => ({ ...prev, groupLabel: e.target.value }))}
              required
            >
              {["1", "2", "3", "4"].map((groupValue) => (
                <option key={groupValue} value={groupValue}>
                  Group {groupValue}
                </option>
              ))}
            </select>

            <button className="btn-primary" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Creating..." : "Add Student"}
            </button>
          </form>
        </div>
      </section>

      {toastMessage && <div className={`toast-msg ${toastVariant}`}>{toastMessage}</div>}
    </div>
  );
}

export default AdminAddStudent;
