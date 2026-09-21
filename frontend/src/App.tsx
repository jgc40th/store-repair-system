import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import NavBar from "./components/NavBar";
import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import LoginCallback from "./pages/LoginCallback";
import Tickets from "./pages/Tickets";
import TicketDetail from "./pages/TicketDetail";
import NewTicket from "./pages/NewTicket";
import Stats from "./pages/Stats";
import Archive from "./pages/Archive";
import AdminBranches from "./pages/AdminBranches";
import AdminAccounts from "./pages/AdminAccounts";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NavBar />
        <Routes>
          <Route path="/" element={<Navigate to="/tickets" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/login/callback" element={<LoginCallback />} />

          <Route path="/tickets" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
          <Route
            path="/tickets/new"
            element={
              <ProtectedRoute allow={["branch_staff", "hq_staff", "admin"]}>
                <NewTicket />
              </ProtectedRoute>
            }
          />
          <Route path="/tickets/:id" element={<ProtectedRoute><TicketDetail /></ProtectedRoute>} />

          <Route
            path="/stats"
            element={
              <ProtectedRoute allow={["hq_staff", "admin"]}>
                <Stats />
              </ProtectedRoute>
            }
          />
          <Route
            path="/archive"
            element={
              <ProtectedRoute allow={["hq_staff", "admin"]}>
                <Archive />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/branches"
            element={
              <ProtectedRoute allow={["admin"]}>
                <AdminBranches />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/accounts"
            element={
              <ProtectedRoute allow={["admin"]}>
                <AdminAccounts />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/tickets" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
