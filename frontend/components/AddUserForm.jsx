import { useEffect, useState } from "react";
import API from "../api/axios";

function AddUserForm({ defaultRole, onCreated, onSuccess, onError }) {
  const roleLabel = defaultRole === "teacher"
    ? "Teacher"
    : defaultRole === "admin"
      ? "Admin"
      : "Student";

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: defaultRole,
    subject: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setForm({
      name: "",
      email: "",
      password: "",
      role: defaultRole,
      subject: "",
    });
  }, [defaultRole]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);
      await API.post("/users", form);
      if (onSuccess) {
        onSuccess(`${roleLabel} created`);
      } else {
        alert("User created");
      }
      setForm({
        name: "",
        email: "",
        password: "",
        role: defaultRole,
        subject: "",
      });
      if (onCreated) {
        onCreated();
      }
    } catch (error) {
      console.error(error);
      const message = error.response?.data?.message || "Failed to create user";
      if (onError) {
        onError(message);
      } else {
        alert(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="stack" onSubmit={handleSubmit} style={{ gap: "0.6rem" }}>
      <input
        className="input-field"
        placeholder="Name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        required
      />
      <input
        className="input-field"
        type="email"
        placeholder="Email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        required
      />
      <input
        className="input-field"
        type="password"
        placeholder="Password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        required
      />
      {defaultRole === "teacher" && (
        <input
          className="input-field"
          placeholder="Subject Specialization"
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          required
        />
      )}

      <button className="btn-primary" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Creating..." : `Add ${roleLabel}`}
      </button>
    </form>
  );
}

export default AddUserForm;
