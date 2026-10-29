import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';
import AppShell from './components/AppShell';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { UserDashboard, NoticeBoard, NoticeDetails, ChangePassword, BookmarksPage, NotificationsPage, ProfilePage, CalendarPage, PlannerPage } from './pages/BoardPages';
import { AdminHome, AdminNotices, AdminUsers, AuditPage } from './pages/AdminPages';
import { useAuth } from './context/AuthContext';
function Dashboard(){const {user}=useAuth();return user?.role==='admin'?<AdminHome/>:<UserDashboard/>;}
function RedirectHome(){const {user}=useAuth();return <Navigate to={user?.role==='admin'?'/dashboard':user?'/dashboard':'/login'} replace/>;}
function AuthFrame(){return <div className="auth-background"><Outlet/></div>;}
export default function App(){return <BrowserRouter><Routes><Route element={<AuthFrame/>}><Route path="/login" element={<LoginPage/>}/><Route path="/admin/login" element={<LoginPage admin/>}/><Route path="/register" element={<RegisterPage/>}/></Route><Route element={<ProtectedRoute/>}><Route element={<AppShell/>}><Route path="/" element={<RedirectHome/>}/><Route path="/dashboard" element={<Dashboard/>}/><Route path="/user/dashboard" element={<Navigate to="/dashboard" replace/>}/><Route path="/notices" element={<NoticeBoard/>}/><Route path="/notices/:id" element={<NoticeDetails/>}/><Route path="/calendar" element={<CalendarPage/>}/><Route path="/planner" element={<PlannerPage/>}/><Route path="/bookmarks" element={<BookmarksPage/>}/><Route path="/notifications" element={<NotificationsPage/>}/><Route path="/profile" element={<ProfilePage/>}/><Route path="/change-password" element={<ChangePassword/>}/><Route element={<AdminRoute/>}><Route path="/admin/home" element={<Navigate to="/dashboard" replace/>}/><Route path="/admin/notices" element={<AdminNotices/>}/><Route path="/admin/users" element={<AdminUsers/>}/><Route path="/admin/audit" element={<AuditPage/>}/></Route><Route path="*" element={<RedirectHome/>}/></Route></Route></Routes></BrowserRouter>;}
