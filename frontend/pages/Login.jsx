import { useState } from "react";
import API from "../api/axios";
import { useNavigate } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await API.post("/users/login", {
        email,
        password,
      });

      localStorage.setItem("token", res.data.token);

      navigate("/dashboard");

    } catch (error) {
      const message =
        error.response?.data?.message || error.message || "Login failed";
      alert(message);
    }
  };

  return (
    <div className="page-shell auth-layout">
      <span className="ambient-orb teal" />
      <span className="ambient-orb gold" />

      <form className="card auth-card stack" onSubmit={handleSubmit}>
        <div className="brand-kicker">Smart Attendance</div>
        <h1 className="page-title">Welcome Back</h1>
        <p className="page-subtitle">
          Sign in to manage attendance with precision.
        </p>

        <label className="field-label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          className="input-field"
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label className="field-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          className="input-field"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button className="btn-primary" type="submit">
          Login
        </button>
      </form>
    </div>
  );
}

export default Login;
