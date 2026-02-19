import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";

function AdminAddTeacher() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [adminError, setAdminError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState("success");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastGeneratedTeacherId, setLastGeneratedTeacherId] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
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
      } catch (error) {
        console.error(error);
        localStorage.removeItem("token");
        navigate("/");
      }
    };

    verifyAdmin();
  }, [navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      showToast("Please fill all required fields", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      setAdminError("");

      const res = await API.post("/users", {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: "teacher",
      });

      const generatedTeacherId = String(res.data?.teacherId || "");
      setLastGeneratedTeacherId(generatedTeacherId);
      showToast(
        generatedTeacherId ? `Teacher created with ID ${generatedTeacherId}` : "Teacher created"
      );

      setForm({
        name: "",
        email: "",
        password: "",
      });
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to create teacher");
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
          <h1 className="topbar-title">Add New Teacher</h1>
          <p className="topbar-subtitle">
            Only basic details are needed. Branch/semester/subject allocation is done later.
          </p>
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
            <h2 className="panel-title">Teacher Creation</h2>
            <p className="panel-subtitle">Admin: {profile?.name || "Admin"}</p>
          </div>
        </div>

        {adminError && <div className="error-banner">{adminError}</div>}

        <div className="bulk-card">
          <form className="stack" onSubmit={handleSubmit} style={{ gap: "0.6rem" }}>
            <input
              className="input-field"
              placeholder="Teacher ID (auto generated)"
              value={lastGeneratedTeacherId}
              readOnly
            />
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

            <button className="btn-primary" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Creating..." : "Add Teacher"}
            </button>
          </form>
        </div>
      </section>

      {toastMessage && <div className={`toast-msg ${toastVariant}`}>{toastMessage}</div>}
    </div>
  );
}

export default AdminAddTeacher;
