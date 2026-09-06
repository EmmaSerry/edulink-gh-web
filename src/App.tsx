import { Routes, Route } from "react-router-dom";
import { CloudAuthLayout } from "@layouts/CloudAuthLayout";
import { CloudAppLayout } from "@layouts/CloudAppLayout";
import { CloudLogin } from "@pages/cloud/CloudLogin";
import { CloudDashboard } from "@pages/cloud/CloudDashboard";
import { CloudStudents } from "@pages/cloud/CloudStudents";
import { CloudStudentRegister } from "@pages/cloud/CloudStudentRegister";
import { CloudAssessmentWorkspace } from "@pages/cloud/CloudAssessmentWorkspace";
import { CloudReportView } from "@pages/cloud/CloudReportView";
import { CloudReportRemarksEntry } from "@pages/cloud/CloudReportRemarksEntry";
import { CloudSettings } from "@pages/cloud/CloudSettings";
import { PublicHome } from "@pages/public/PublicHome";
import { RequireAuth } from "@components/RequireAuth";
import { ThemeProvider } from "@contexts/ThemeContext";

/**
 * EduLink GH cloud app routes.
 *
 * "/" is the public marketing homepage (PublicHome) - unauthenticated,
 * always reachable, works for a visitor who's never signed in.
 * Everything that used to live at "/" (the actual dashboard) moved to
 * "/dashboard" to make room for it; CloudSidebar's Dashboard link and
 * CloudLogin's post-sign-in redirect both point there now.
 */
export default function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route path="/" element={<PublicHome />} />

        <Route element={<CloudAuthLayout />}>
          <Route path="/login" element={<CloudLogin />} />
        </Route>

        <Route
          element={
            <RequireAuth>
              <CloudAppLayout />
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<CloudDashboard />} />
          <Route path="/students" element={<CloudStudents />} />
          <Route path="/students/register" element={<CloudStudentRegister />} />
          <Route path="/assessments" element={<CloudAssessmentWorkspace />} />
          <Route path="/report-remarks" element={<CloudReportRemarksEntry />} />
          <Route path="/reports" element={<CloudReportView />} />
          <Route path="/settings" element={<CloudSettings />} />
        </Route>
      </Routes>
    </ThemeProvider>
  );
}
