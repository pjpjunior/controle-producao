import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import OperatorDashboard from './pages/OperatorDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import TeamManagementPage from './pages/TeamManagementPage';
import FirstAccessPage from './pages/FirstAccessPage';
import ServiceCatalogAdminPage from './pages/ServiceCatalogAdminPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/primeiro-acesso" element={<FirstAccessPage />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="gerente">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/gestao"
          element={
            <ProtectedRoute requiredRole="admin">
              <TeamManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/catalogo-servicos"
          element={
            <ProtectedRoute requiredRole="admin">
              <ServiceCatalogAdminPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/operador"
          element={
            <ProtectedRoute>
              <OperatorDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
