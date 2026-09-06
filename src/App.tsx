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
import { RequireAuth } from "@components/RequireAuth";
import { ThemeProvider } from "@contexts/ThemeContext";

/**
 * EduLink GH cloud app routes. Deliberately small right now - Dashboard
 * and Students are the two pages needed to prove the full stack works
 * end to end in production (auth -> RLS-scoped data -> UI). Every
 * future page (assessment entry, report generation, district rollups,
 * fees, settings) is a new <Route> here plus a new page component,
 * following the exact same RequireAuth + CloudAppLayout pattern.
 */
export default function App() {
  return (
    <ThemeProvider>
      <Routes>
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
          <Route path="/" element={<CloudDashboard />} />
          <Route path="/students" element={<CloudStudents />} />
          <Route path="/students/register" element={<CloudStudentRegister />} />
          <Route path="/assessments" element={<CloudAssessmentWorkspace />} />
          <Route path="/report-remarks" element={<CloudReportRemarksEntry />} />
          <Route path="/reports" element={<CloudReportView />} />
        </Route>
      </Routes>
    </ThemeProvider>
  );
}
