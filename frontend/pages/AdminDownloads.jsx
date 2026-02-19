import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";

function AdminDownloads() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [adminError, setAdminError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState("success");
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

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

  const downloadBlob = async (endpoint, fileName, contentType, setLoading) => {
    try {
      setLoading(true);
      setAdminError("");
      const res = await API.get(endpoint, { responseType: "blob" });
      const blob = new Blob([res.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast(`${fileName} downloaded`);
    } catch (error) {
      console.error(error);
      reportAdminError(error, `Failed to download ${fileName}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = () =>
    downloadBlob("/attendance/export-csv", "attendance.csv", "text/csv", setIsDownloadingCsv);

  const downloadPdf = () =>
    downloadBlob(
      "/attendance/export-pdf",
      "attendance.pdf",
      "application/pdf",
      setIsDownloadingPdf
    );

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

  return (
    <div className="page-shell dashboard-layout">
      <span className="ambient-orb teal" />
      <span className="ambient-orb gold" />

      <header className="card topbar">
        <div>
          <h1 className="topbar-title">Download Attendance Sheet</h1>
          <p className="topbar-subtitle">Export attendance reports as CSV or PDF.</p>
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
            <h2 className="panel-title">Attendance Exports</h2>
            <p className="panel-subtitle">Admin: {profile?.name || "Admin"}</p>
          </div>
        </div>

        {adminError && <div className="error-banner">{adminError}</div>}

        <div className="admin-actions" style={{ marginTop: "0.7rem" }}>
          <button
            className="btn-secondary"
            type="button"
            onClick={downloadCsv}
            disabled={isDownloadingCsv || isDownloadingPdf}
          >
            {isDownloadingCsv ? "Downloading..." : "Download CSV"}
          </button>
          <button
            className="btn-secondary"
            type="button"
            onClick={downloadPdf}
            disabled={isDownloadingPdf || isDownloadingCsv}
          >
            {isDownloadingPdf ? "Downloading..." : "Download PDF"}
          </button>
        </div>
      </section>

      {toastMessage && <div className={`toast-msg ${toastVariant}`}>{toastMessage}</div>}
    </div>
  );
}

export default AdminDownloads;
