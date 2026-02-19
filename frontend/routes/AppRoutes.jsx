import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import AdminUsers from "../pages/AdminUsers";
import AdminAllocatedClasses from "../pages/AdminAllocatedClasses";
import AdminLowAttendance from "../pages/AdminLowAttendance";
import AdminRanking from "../pages/AdminRanking";
import AdminDownloads from "../pages/AdminDownloads";
import AdminAddStudent from "../pages/AdminAddStudent";
import AdminAddTeacher from "../pages/AdminAddTeacher";
import NotFound from "../pages/NotFound";
import ProtectedRoute from "../components/ProtectedRoute";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/allocated-classes"
          element={
            <ProtectedRoute>
              <AdminAllocatedClasses />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/low-attendance"
          element={
            <ProtectedRoute>
              <AdminLowAttendance />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/ranking"
          element={
            <ProtectedRoute>
              <AdminRanking />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/downloads"
          element={
            <ProtectedRoute>
              <AdminDownloads />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/add-student"
          element={
            <ProtectedRoute>
              <AdminAddStudent />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/add-teacher"
          element={
            <ProtectedRoute>
              <AdminAddTeacher />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
