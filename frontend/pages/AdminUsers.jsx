/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";

function AdminUsers() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [adminError, setAdminError] = useState("");
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState("success");
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userStatusFilter, setUserStatusFilter] = useState("all");
  const [userSessionFilter, setUserSessionFilter] = useState("all");
  const [userGroupFilter, setUserGroupFilter] = useState("all");
  const [isUpdatingGroupUserId, setIsUpdatingGroupUserId] = useState("");
  const [resetPasswordState, setResetPasswordState] = useState({
    userId: "",
    userName: "",
    newPassword: "",
    isSaving: false,
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

  const fetchUsers = async () => {
    try {
      setIsLoadingUsers(true);
      setAdminError("");
      const res = await API.get("/users");
      setUsers(res.data);
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to fetch users");
    } finally {
      setIsLoadingUsers(false);
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
        fetchUsers();
      } catch (error) {
        console.error(error);
        localStorage.removeItem("token");
        navigate("/");
      }
    };

    verifyAdmin();
  }, [navigate]);

  const handleRoleChange = async (id, newRole) => {
    try {
      setAdminError("");
      await API.patch(`/users/${id}/role`, { role: newRole });
      showToast("Role updated");
      fetchUsers();
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to update role");
    }
  };

  const handleDeactivateUser = async (targetUser) => {
    const shouldDeactivate = window.confirm(
      `Deactivate ${targetUser.name}? They will not be able to log in.`
    );
    if (!shouldDeactivate) {
      return;
    }

    try {
      setAdminError("");
      await API.patch(`/users/${targetUser._id}/deactivate`);
      showToast("User deactivated");
      fetchUsers();
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to deactivate user");
    }
  };

  const handleActivateUser = async (targetUser) => {
    try {
      setAdminError("");
      await API.patch(`/users/${targetUser._id}/activate`);
      showToast("User activated");
      fetchUsers();
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to activate user");
    }
  };

  const submitResetPassword = async () => {
    const trimmedPassword = resetPasswordState.newPassword.trim();
    if (trimmedPassword.length < 6) {
      showToast("Password must be at least 6 characters", "error");
      return;
    }

    try {
      setAdminError("");
      setResetPasswordState((prev) => ({ ...prev, isSaving: true }));
      await API.patch(`/users/${resetPasswordState.userId}/reset-password`, {
        newPassword: trimmedPassword,
      });
      showToast("Password reset");
      setResetPasswordState({
        userId: "",
        userName: "",
        newPassword: "",
        isSaving: false,
      });
    } catch (error) {
      console.error(error);
      setResetPasswordState((prev) => ({ ...prev, isSaving: false }));
      reportAdminError(error, "Failed to reset password");
    }
  };

  const handleStudentGroupChange = async (studentUser, nextGroupLabel) => {
    if (studentUser.role !== "student") {
      return;
    }
    if (!["1", "2", "3", "4"].includes(nextGroupLabel)) {
      showToast("Group must be between 1 and 4", "error");
      return;
    }
    if (String(studentUser.groupLabel || "") === nextGroupLabel) {
      return;
    }

    try {
      setAdminError("");
      setIsUpdatingGroupUserId(studentUser._id);
      await API.patch(`/users/${studentUser._id}/student-group`, {
        groupLabel: nextGroupLabel,
      });
      showToast("Student group updated");
      await fetchUsers();
    } catch (error) {
      console.error(error);
      reportAdminError(error, "Failed to update student group");
    } finally {
      setIsUpdatingGroupUserId("");
    }
  };

  const sessionFilterOptions = useMemo(() => {
    const sessionMap = new Map();
    users.forEach((entry) => {
      if (entry.session?._id) {
        sessionMap.set(entry.session._id, entry.session.label || "Session");
      }
    });
    return Array.from(sessionMap.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [users]);

  const groupFilterOptions = useMemo(() => {
    const groups = new Set();
    users.forEach((entry) => {
      if (entry.role !== "student") {
        return;
      }
      if (
        userSessionFilter !== "all" &&
        String(entry.session?._id || "") !== userSessionFilter
      ) {
        return;
      }
      const groupValue = String(entry.groupLabel || "").trim();
      if (["1", "2", "3", "4"].includes(groupValue)) {
        groups.add(groupValue);
      }
    });

    return Array.from(groups).sort((left, right) => Number(left) - Number(right));
  }, [users, userSessionFilter]);

  useEffect(() => {
    if (userGroupFilter === "all") {
      return;
    }
    if (!groupFilterOptions.includes(userGroupFilter)) {
      setUserGroupFilter("all");
    }
  }, [groupFilterOptions, userGroupFilter]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = userSearch.trim().toLowerCase();
    return users.filter((entry) => {
      const matchesSearch =
        !normalizedQuery ||
        entry.name.toLowerCase().includes(normalizedQuery) ||
        entry.email.toLowerCase().includes(normalizedQuery);

      const matchesRole = userRoleFilter === "all" || entry.role === userRoleFilter;
      const matchesStatus =
        userStatusFilter === "all" ||
        (userStatusFilter === "active" ? entry.isActive : !entry.isActive);
      const matchesGroup =
        userGroupFilter === "all" ||
        (entry.role === "student" && String(entry.groupLabel || "") === userGroupFilter);
      const matchesSession =
        userSessionFilter === "all" || String(entry.session?._id || "") === userSessionFilter;

      return matchesSearch && matchesRole && matchesStatus && matchesGroup && matchesSession;
    });
  }, [users, userSearch, userRoleFilter, userStatusFilter, userGroupFilter, userSessionFilter]);

  return (
    <div className="page-shell dashboard-layout">
      <span className="ambient-orb teal" />
      <span className="ambient-orb gold" />

      <header className="card topbar">
        <div>
          <h1 className="topbar-title">Admin User Management</h1>
          <p className="topbar-subtitle">
            Manage roles, status, and password resets in a dedicated page.
          </p>
        </div>
        <div className="admin-actions">
          <button className="btn-ghost" type="button" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </button>
          <button className="btn-secondary" type="button" onClick={fetchUsers}>
            Refresh Users
          </button>
        </div>
      </header>

      <section className="card panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">User List</h2>
            <p className="panel-subtitle">Admin: {profile?.name || "Admin"}</p>
          </div>
        </div>

        {adminError && <div className="error-banner">{adminError}</div>}

        <div className="admin-filter-grid">
          <input
            className="input-field"
            placeholder="Search by name or email"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
          />
          <select
            className="select-field"
            value={userRoleFilter}
            onChange={(e) => setUserRoleFilter(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="teacher">Teacher</option>
            <option value="student">Student</option>
          </select>
          <select
            className="select-field"
            value={userStatusFilter}
            onChange={(e) => setUserStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            className="select-field"
            value={userSessionFilter}
            onChange={(e) => setUserSessionFilter(e.target.value)}
          >
            <option value="all">All Sessions</option>
            {sessionFilterOptions.map((session) => (
              <option key={session.value} value={session.value}>
                {session.label}
              </option>
            ))}
          </select>
          <select
            className="select-field"
            value={userGroupFilter}
            onChange={(e) => setUserGroupFilter(e.target.value)}
          >
            <option value="all">All Groups</option>
            {groupFilterOptions.map((groupValue) => (
              <option key={groupValue} value={groupValue}>
                Group {groupValue}
              </option>
            ))}
          </select>
        </div>

        {resetPasswordState.userId && (
          <div className="bulk-card admin-inline-card">
            <h4 className="panel-title" style={{ fontSize: "1rem" }}>
              Reset Password: {resetPasswordState.userName}
            </h4>
            <p className="panel-subtitle">Set a temporary password (minimum 6 characters).</p>
            <div className="admin-inline-form">
              <input
                className="input-field"
                type="password"
                placeholder="New password"
                value={resetPasswordState.newPassword}
                onChange={(e) =>
                  setResetPasswordState((prev) => ({
                    ...prev,
                    newPassword: e.target.value,
                  }))
                }
              />
              <button
                className="btn-secondary"
                type="button"
                onClick={submitResetPassword}
                disabled={resetPasswordState.isSaving}
              >
                {resetPasswordState.isSaving ? "Saving..." : "Save Password"}
              </button>
              <button
                className="btn-ghost"
                type="button"
                onClick={() =>
                  setResetPasswordState({
                    userId: "",
                    userName: "",
                    newPassword: "",
                    isSaving: false,
                  })
                }
                disabled={resetPasswordState.isSaving}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Session</th>
                <th>Group</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u._id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      className="status-select"
                      value={u.role}
                      onChange={(e) => handleRoleChange(u._id, e.target.value)}
                      disabled={u._id === profile?._id}
                    >
                      <option value="admin">admin</option>
                      <option value="teacher">teacher</option>
                      <option value="student">student</option>
                    </select>
                  </td>
                  <td>{u.session?.label || "-"}</td>
                  <td>
                    {u.role === "student" ? (
                      <select
                        className="status-select"
                        value={["1", "2", "3", "4"].includes(String(u.groupLabel || ""))
                          ? String(u.groupLabel)
                          : ""}
                        onChange={(e) => handleStudentGroupChange(u, e.target.value)}
                        disabled={isUpdatingGroupUserId === u._id}
                      >
                        <option value="" disabled>
                          Select Group
                        </option>
                        <option value="1">Group 1</option>
                        <option value="2">Group 2</option>
                        <option value="3">Group 3</option>
                        <option value="4">Group 4</option>
                      </select>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>{u.subject || "-"}</td>
                  <td>{u.isActive ? "Active" : "Inactive"}</td>
                  <td>
                    <div className="admin-actions">
                      <button
                        className="btn-secondary"
                        type="button"
                        onClick={() =>
                          setResetPasswordState({
                            userId: u._id,
                            userName: u.name,
                            newPassword: "",
                            isSaving: false,
                          })
                        }
                      >
                        Reset Password
                      </button>
                      {u.isActive && u._id !== profile?._id && (
                        <button
                          className="btn-danger-sm"
                          type="button"
                          onClick={() => handleDeactivateUser(u)}
                        >
                          Deactivate
                        </button>
                      )}
                      {!u.isActive && (
                        <button
                          className="btn-primary"
                          type="button"
                          onClick={() => handleActivateUser(u)}
                        >
                          Activate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isLoadingUsers && <p className="empty-state">Loading users...</p>}
        {!isLoadingUsers && filteredUsers.length === 0 && (
          <p className="empty-state">No users match your current filters.</p>
        )}
      </section>

      {toastMessage && <div className={`toast-msg ${toastVariant}`}>{toastMessage}</div>}
    </div>
  );
}

export default AdminUsers;
