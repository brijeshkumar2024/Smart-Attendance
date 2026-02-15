import { useState } from "react";
import API from "../api/axios";

function AddUserForm({ defaultRole, onCreated }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: defaultRole,
    subject: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);
      await API.post("/users", form);
      alert("User created");
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
      alert(error.response?.data?.message || "Failed to create user");
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
        {isSubmitting ? "Creating..." : `Add ${defaultRole === "teacher" ? "Teacher" : "Student"}`}
      </button>
    </form>
  );
}

export default AddUserForm;
