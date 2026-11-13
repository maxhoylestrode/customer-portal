import React from 'react';
import StaffDashboard from '../../staff/pages/DashboardPage';

// Admins use the same role-aware dashboard as the rest of the team; the
// server includes the ticket sections only for admins.
export default function AdminDashboard() {
  return <StaffDashboard />;
}
