/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from "react";
import API from "../api/axios";

function AdminAcademicSetup({ adminName, showToast }) {
  const [programs, setPrograms] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [summary, setSummary] = useState({
    totalPrograms: 0,
    totalSessions: 0,
    totalBranches: 0,
    totalSubjects: 0,
  });
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedSemester, setSelectedSemester] = useState(1);
  const [programForm, setProgramForm] = useState({ name: "", code: "" });
  const [sessionForm, setSessionForm] = useState({ label: "" });
  const [branchForm, setBranchForm] = useState({ name: "", code: "" });
  const [subjectForm, setSubjectForm] = useState({ name: "", code: "" });
  const [editingBranchId, setEditingBranchId] = useState("");
  const [editingSubjectId, setEditingSubjectId] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [isSavingProgram, setIsSavingProgram] = useState(false);
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [isSavingBranch, setIsSavingBranch] = useState(false);
  const [isSavingSubject, setIsSavingSubject] = useState(false);
  const [error, setError] = useState("");

  const selectedProgram = useMemo(
    () => programs.find((entry) => entry._id === selectedProgramId) || null,
    [programs, selectedProgramId]
  );

  const selectedSession = useMemo(
    () => sessions.find((entry) => entry._id === selectedSessionId) || null,
    [sessions, selectedSessionId]
  );

  const selectedBranch = useMemo(
    () => branches.find((entry) => entry._id === selectedBranchId) || null,
    [branches, selectedBranchId]
  );

  const handleError = (err, fallbackMessage) => {
    const message = err?.response?.data?.message || fallbackMessage;
    setError(message);
    if (showToast) {
      showToast(message, "error");
    }
  };

  const fetchPrograms = async () => {
    try {
      setIsLoadingPrograms(true);
      setError("");
      const res = await API.get("/admin/academic/programs");
      setPrograms(res.data);

      if (res.data.length === 0) {
        setSelectedProgramId("");
        return;
      }

      if (!selectedProgramId || !res.data.some((entry) => entry._id === selectedProgramId)) {
        setSelectedProgramId(res.data[0]._id);
      }
    } catch (err) {
      console.error(err);
      handleError(err, "Failed to load programs");
    } finally {
      setIsLoadingPrograms(false);
    }
  };

  const fetchSessions = async (programId) => {
    if (!programId) {
      setSessions([]);
      setSelectedSessionId("");
      return;
    }

    try {
      setIsLoadingSessions(true);
      setError("");
      const res = await API.get("/admin/academic/sessions", {
        params: { programId },
      });
      setSessions(res.data);

      if (res.data.length === 0) {
        setSelectedSessionId("");
        return;
      }

      if (!selectedSessionId || !res.data.some((entry) => entry._id === selectedSessionId)) {
        setSelectedSessionId(res.data[0]._id);
      }
    } catch (err) {
      console.error(err);
      handleError(err, "Failed to load sessions");
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const fetchBranches = async () => {
    if (!selectedProgramId || !selectedSessionId) {
      setBranches([]);
      setSelectedBranchId("");
      return;
    }

    try {
      setIsLoadingBranches(true);
      setError("");
      const res = await API.get("/admin/academic/branches", {
        params: {
          programId: selectedProgramId,
          sessionId: selectedSessionId,
        },
      });
      setBranches(res.data);
      if (res.data.length === 0) {
        setSelectedBranchId("");
      } else if (!res.data.some((entry) => entry._id === selectedBranchId)) {
        setSelectedBranchId(res.data[0]._id);
      }
    } catch (err) {
      console.error(err);
      handleError(err, "Failed to load branches");
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const fetchSubjects = async () => {
    if (!selectedBranchId) {
      setSubjects([]);
      return;
    }

    try {
      setIsLoadingSubjects(true);
      setError("");
      const res = await API.get("/admin/academic/subjects", {
        params: {
          branchId: selectedBranchId,
          semester: selectedSemester,
        },
      });
      setSubjects(res.data);
    } catch (err) {
      console.error(err);
      handleError(err, "Failed to load subjects");
    } finally {
      setIsLoadingSubjects(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await API.get("/admin/academic/summary", {
        params: {
          programId: selectedProgramId || undefined,
          sessionId: selectedSessionId || undefined,
        },
      });
      setSummary(res.data);
    } catch (err) {
      console.error(err);
      handleError(err, "Failed to load admin summary");
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, []);

  useEffect(() => {
    fetchSessions(selectedProgramId);
  }, [selectedProgramId]);

  useEffect(() => {
    fetchBranches();
    fetchSummary();
  }, [selectedProgramId, selectedSessionId]);

  useEffect(() => {
    fetchSubjects();
  }, [selectedBranchId, selectedSemester]);

  const createProgram = async (event) => {
    event.preventDefault();
    const payload = {
      name: programForm.name.trim(),
      code: programForm.code.trim().toUpperCase(),
    };
    if (!payload.name) {
      if (showToast) {
        showToast("Program name is required", "error");
      }
      return;
    }

    try {
      setIsSavingProgram(true);
      setError("");
      await API.post("/admin/academic/programs", payload);
      setProgramForm({ name: "", code: "" });
      if (showToast) {
        showToast("Program created");
      }
      await fetchPrograms();
      await fetchSummary();
    } catch (err) {
      console.error(err);
      handleError(err, "Failed to create program");
    } finally {
      setIsSavingProgram(false);
    }
  };

  const deactivateProgram = async () => {
    if (!selectedProgramId) {
      return;
    }
    if (!window.confirm("Deactivate selected program?")) {
      return;
    }

    try {
      setError("");
      await API.delete(`/admin/academic/programs/${selectedProgramId}`);
      if (showToast) {
        showToast("Program deactivated");
      }
      setSelectedProgramId("");
      await fetchPrograms();
      await fetchSummary();
    } catch (err) {
      console.error(err);
      handleError(err, "Failed to deactivate program");
    }
  };

  const createSession = async (event) => {
    event.preventDefault();
    if (!selectedProgramId) {
      if (showToast) {
        showToast("Select a program first", "error");
      }
      return;
    }

    const label = sessionForm.label.trim();
    if (!label) {
      if (showToast) {
        showToast("Session label is required", "error");
      }
      return;
    }

    try {
      setIsSavingSession(true);
      setError("");
      await API.post("/admin/academic/sessions", {
        programId: selectedProgramId,
        label,
      });
      setSessionForm({ label: "" });
      if (showToast) {
        showToast("Session created");
      }
      await fetchSessions(selectedProgramId);
      await fetchSummary();
    } catch (err) {
      console.error(err);
      handleError(err, "Failed to create session");
    } finally {
      setIsSavingSession(false);
    }
  };

  const deactivateSession = async () => {
    if (!selectedSessionId) {
      return;
    }
    if (!window.confirm("Deactivate selected session?")) {
      return;
    }

    try {
      setError("");
      await API.delete(`/admin/academic/sessions/${selectedSessionId}`);
      if (showToast) {
        showToast("Session deactivated");
      }
      setSelectedSessionId("");
      await fetchSessions(selectedProgramId);
      await fetchSummary();
    } catch (err) {
      console.error(err);
      handleError(err, "Failed to deactivate session");
    }
  };

  const submitBranch = async (event) => {
    event.preventDefault();
    if (!selectedProgramId || !selectedSessionId) {
      if (showToast) {
        showToast("Select program and session first", "error");
      }
      return;
    }

    const payload = {
      programId: selectedProgramId,
      sessionId: selectedSessionId,
      name: branchForm.name.trim(),
      code: branchForm.code.trim().toUpperCase(),
    };
    if (!payload.name) {
      if (showToast) {
        showToast("Branch name is required", "error");
      }
      return;
    }

    try {
      setIsSavingBranch(true);
      setError("");
      if (editingBranchId) {
        await API.patch(`/admin/academic/branches/${editingBranchId}`, payload);
        if (showToast) {
          showToast("Branch updated");
        }
      } else {
        await API.post("/admin/academic/branches", payload);
        if (showToast) {
          showToast("Branch created");
        }
      }

      setBranchForm({ name: "", code: "" });
      setEditingBranchId("");
      await fetchBranches();
      await fetchSummary();
    } catch (err) {
      console.error(err);
      handleError(err, editingBranchId ? "Failed to update branch" : "Failed to create branch");
    } finally {
      setIsSavingBranch(false);
    }
  };

  const startBranchEdit = (branch) => {
    setEditingBranchId(branch._id);
    setSelectedBranchId(branch._id);
    setBranchForm({ name: branch.name || "", code: branch.code || "" });
  };

  const cancelBranchEdit = () => {
    setEditingBranchId("");
    setBranchForm({ name: "", code: "" });
  };

  const deactivateBranch = async (branchId) => {
    if (!window.confirm("Deactivate this branch?")) {
      return;
    }
    try {
      setError("");
      await API.delete(`/admin/academic/branches/${branchId}`);
      if (showToast) {
        showToast("Branch deactivated");
      }
      if (editingBranchId === branchId) {
        cancelBranchEdit();
      }
      if (selectedBranchId === branchId) {
        setSelectedBranchId("");
      }
      await fetchBranches();
      await fetchSummary();
    } catch (err) {
      console.error(err);
      handleError(err, "Failed to deactivate branch");
    }
  };

  const submitSubject = async (event) => {
    event.preventDefault();
    if (!selectedProgramId || !selectedSessionId || !selectedBranchId) {
      if (showToast) {
        showToast("Select program, session, and branch first", "error");
      }
      return;
    }

    const payload = {
      programId: selectedProgramId,
      sessionId: selectedSessionId,
      branchId: selectedBranchId,
      semester: selectedSemester,
      name: subjectForm.name.trim(),
      code: subjectForm.code.trim().toUpperCase(),
    };

    if (!payload.name) {
      if (showToast) {
        showToast("Subject name is required", "error");
      }
      return;
    }

    try {
      setIsSavingSubject(true);
      setError("");
      if (editingSubjectId) {
        await API.patch(`/admin/academic/subjects/${editingSubjectId}`, payload);
        if (showToast) {
          showToast("Subject updated");
        }
      } else {
        await API.post("/admin/academic/subjects", payload);
        if (showToast) {
          showToast("Subject created");
        }
      }
      setSubjectForm({ name: "", code: "" });
      setEditingSubjectId("");
      await fetchSubjects();
      await fetchSummary();
    } catch (err) {
      console.error(err);
      handleError(err, editingSubjectId ? "Failed to update subject" : "Failed to create subject");
    } finally {
      setIsSavingSubject(false);
    }
  };

  const startSubjectEdit = (subject) => {
    setEditingSubjectId(subject._id);
    setSubjectForm({ name: subject.name || "", code: subject.code || "" });
    if (Number.isInteger(subject.semester)) {
      setSelectedSemester(subject.semester);
    }
  };

  const cancelSubjectEdit = () => {
    setEditingSubjectId("");
    setSubjectForm({ name: "", code: "" });
  };

  const deactivateSubject = async (subjectId) => {
    if (!window.confirm("Deactivate this subject?")) {
      return;
    }

    try {
      setError("");
      await API.delete(`/admin/academic/subjects/${subjectId}`);
      if (showToast) {
        showToast("Subject deactivated");
      }
      if (editingSubjectId === subjectId) {
        cancelSubjectEdit();
      }
      await fetchSubjects();
      await fetchSummary();
    } catch (err) {
      console.error(err);
      handleError(err, "Failed to deactivate subject");
    }
  };

  return (
    <div className="bulk-card academic-card">
      <div className="panel-head">
        <div>
          <h3 className="panel-title">Hello, {adminName || "Admin"}</h3>
          <p className="panel-subtitle">
            Configure programs, sessions, and branches for real-world structure.
          </p>
        </div>
        <div className="admin-actions">
          <button className="btn-ghost" type="button" onClick={fetchPrograms}>
            Refresh Setup
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="metrics-grid admin-kpi-grid">
        <article className="metric">
          <span className="metric-label">Programs</span>
          <div className="metric-value">{summary.totalPrograms}</div>
        </article>
        <article className="metric">
          <span className="metric-label">Sessions</span>
          <div className="metric-value">{summary.totalSessions}</div>
        </article>
        <article className="metric">
          <span className="metric-label">Branches</span>
          <div className="metric-value">{summary.totalBranches}</div>
        </article>
        <article className="metric">
          <span className="metric-label">Subjects</span>
          <div className="metric-value">{summary.totalSubjects || 0}</div>
        </article>
      </div>

      <div className="academic-grid">
        <div className="metric">
          <h4 className="panel-title" style={{ fontSize: "1rem" }}>
            Programs
          </h4>
          <div className="academic-pill-grid">
            {programs.map((program) => (
              <button
                key={program._id}
                className={`academic-pill ${selectedProgramId === program._id ? "active" : ""}`}
                type="button"
                onClick={() => setSelectedProgramId(program._id)}
              >
                {program.code ? `${program.code} - ${program.name}` : program.name}
              </button>
            ))}
          </div>
          {isLoadingPrograms && <p className="empty-state">Loading programs...</p>}
          {!isLoadingPrograms && programs.length === 0 && (
            <p className="empty-state">No programs yet. Create one to begin.</p>
          )}

          <form className="academic-form" onSubmit={createProgram}>
            <input
              className="input-field"
              placeholder="Program name (e.g., BTech)"
              value={programForm.name}
              onChange={(event) =>
                setProgramForm((prev) => ({ ...prev, name: event.target.value }))
              }
            />
            <input
              className="input-field"
              placeholder="Code (optional)"
              value={programForm.code}
              onChange={(event) =>
                setProgramForm((prev) => ({ ...prev, code: event.target.value }))
              }
            />
            <div className="admin-actions">
              <button className="btn-primary" type="submit" disabled={isSavingProgram}>
                {isSavingProgram ? "Saving..." : "Add Program"}
              </button>
              <button
                className="btn-danger-sm"
                type="button"
                onClick={deactivateProgram}
                disabled={!selectedProgramId}
              >
                Deactivate Program
              </button>
            </div>
          </form>
        </div>

        <div className="metric">
          <h4 className="panel-title" style={{ fontSize: "1rem" }}>
            Session Scope
          </h4>
          <div className="academic-scope-grid">
            <select
              className="select-field"
              value={selectedSessionId}
              onChange={(event) => setSelectedSessionId(event.target.value)}
              disabled={!selectedProgramId || isLoadingSessions}
            >
              <option value="">
                {isLoadingSessions ? "Loading sessions..." : "Select session"}
              </option>
              {sessions.map((session) => (
                <option key={session._id} value={session._id}>
                  {session.label}
                </option>
              ))}
            </select>
          </div>

          <form className="academic-form" onSubmit={createSession}>
            <input
              className="input-field"
              placeholder="Session (e.g., 2026-27)"
              value={sessionForm.label}
              onChange={(event) =>
                setSessionForm((prev) => ({ ...prev, label: event.target.value }))
              }
            />
            <div className="admin-actions">
              <button className="btn-primary" type="submit" disabled={isSavingSession}>
                {isSavingSession ? "Saving..." : "Add Session"}
              </button>
              <button
                className="btn-danger-sm"
                type="button"
                onClick={deactivateSession}
                disabled={!selectedSessionId}
              >
                Deactivate Session
              </button>
            </div>
          </form>
          {!selectedSession && selectedProgram && (
            <p className="empty-state">Create a session for this program to manage branches.</p>
          )}
        </div>
      </div>

      <div className="metric" style={{ marginTop: "0.9rem" }}>
        <h4 className="panel-title" style={{ fontSize: "1rem" }}>
          Branch Management
        </h4>

        <form className="academic-form academic-branch-form" onSubmit={submitBranch}>
          <input
            className="input-field"
            placeholder="Branch name (e.g., Computer Science)"
            value={branchForm.name}
            onChange={(event) =>
              setBranchForm((prev) => ({ ...prev, name: event.target.value }))
            }
          />
          <input
            className="input-field"
            placeholder="Branch code (optional)"
            value={branchForm.code}
            onChange={(event) =>
              setBranchForm((prev) => ({ ...prev, code: event.target.value }))
            }
          />
          <div className="admin-actions">
            <button
              className="btn-primary"
              type="submit"
              disabled={!selectedProgramId || !selectedSessionId || isSavingBranch}
            >
              {isSavingBranch
                ? "Saving..."
                : editingBranchId
                  ? "Update Branch"
                  : "Add Branch"}
            </button>
            {editingBranchId && (
              <button className="btn-ghost" type="button" onClick={cancelBranchEdit}>
                Cancel Edit
              </button>
            )}
          </div>
        </form>

        {isLoadingBranches && <p className="empty-state">Loading branches...</p>}
        {!isLoadingBranches && branches.length === 0 && selectedSessionId && (
          <p className="empty-state">No branches found for selected session.</p>
        )}

        {branches.length > 0 && (
          <div className="academic-subsection">
            <p className="panel-subtitle">Select branch</p>
            <div className="academic-pill-grid">
              {branches.map((branch) => (
                <button
                  key={branch._id}
                  className={`academic-pill ${selectedBranchId === branch._id ? "active" : ""}`}
                  type="button"
                  onClick={() => setSelectedBranchId(branch._id)}
                >
                  {branch.name}
                </button>
              ))}
            </div>
            <div className="admin-actions" style={{ marginTop: "0.7rem" }}>
              <button
                className="btn-secondary"
                type="button"
                disabled={!selectedBranch}
                onClick={() => selectedBranch && startBranchEdit(selectedBranch)}
              >
                Edit Selected Branch
              </button>
              <button
                className="btn-danger-sm"
                type="button"
                disabled={!selectedBranch}
                onClick={() => selectedBranch && deactivateBranch(selectedBranch._id)}
              >
                Deactivate Selected
              </button>
            </div>
          </div>
        )}

        {selectedBranch && (
          <div className="academic-subsection">
            <h5 className="panel-title" style={{ fontSize: "0.95rem" }}>
              Subjects - {selectedBranch.name}
            </h5>
            <p className="panel-subtitle">Choose semester</p>
            <div className="academic-pill-grid">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((semester) => (
                <button
                  key={semester}
                  className={`academic-pill ${selectedSemester === semester ? "active" : ""}`}
                  type="button"
                  onClick={() => {
                    setSelectedSemester(semester);
                    setEditingSubjectId("");
                    setSubjectForm({ name: "", code: "" });
                  }}
                >
                  Semester {semester}
                </button>
              ))}
            </div>

            <form className="academic-form academic-subject-form" onSubmit={submitSubject}>
              <input
                className="input-field"
                placeholder={`Subject name for semester ${selectedSemester}`}
                value={subjectForm.name}
                onChange={(event) =>
                  setSubjectForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
              <input
                className="input-field"
                placeholder="Subject code (optional)"
                value={subjectForm.code}
                onChange={(event) =>
                  setSubjectForm((prev) => ({ ...prev, code: event.target.value }))
                }
              />
              <div className="admin-actions">
                <button className="btn-primary" type="submit" disabled={isSavingSubject}>
                  {isSavingSubject
                    ? "Saving..."
                    : editingSubjectId
                      ? "Update Subject"
                      : "Add Subject"}
                </button>
                {editingSubjectId && (
                  <button className="btn-ghost" type="button" onClick={cancelSubjectEdit}>
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>

            {isLoadingSubjects && <p className="empty-state">Loading subjects...</p>}
            {!isLoadingSubjects && subjects.length === 0 && (
              <p className="empty-state">No subjects for semester {selectedSemester}.</p>
            )}

            {subjects.length > 0 && (
              <div className="table-wrap" style={{ marginTop: "0.8rem" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Code</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map((subject) => (
                      <tr key={subject._id}>
                        <td>{subject.name}</td>
                        <td>{subject.code || "-"}</td>
                        <td>
                          <div className="admin-actions">
                            <button
                              className="btn-secondary"
                              type="button"
                              onClick={() => startSubjectEdit(subject)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn-danger-sm"
                              type="button"
                              onClick={() => deactivateSubject(subject._id)}
                            >
                              Deactivate
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminAcademicSetup;
