import { Routes, Route } from "react-router-dom";
import { CloudAuthLayout } from "@layouts/CloudAuthLayout";
import { CloudAppLayout } from "@layouts/CloudAppLayout";
import { CloudLogin } from "@pages/cloud/CloudLogin";
import { CloudSchoolSignup } from "@pages/cloud/CloudSchoolSignup";
import { CloudDistrictSignup } from "@pages/cloud/CloudDistrictSignup";
import { CloudDashboard } from "@pages/cloud/CloudDashboard";
import { CloudStudents } from "@pages/cloud/CloudStudents";
import { CloudStudentRegister } from "@pages/cloud/CloudStudentRegister";
import { CloudStudentEdit } from "@pages/cloud/CloudStudentEdit";
import { CloudPhotoImport } from "@pages/cloud/CloudPhotoImport";
import { CloudIndependentSchools } from "@pages/cloud/CloudIndependentSchools";
import { CloudAssessmentWorkspace } from "@pages/cloud/CloudAssessmentWorkspace";
import { CloudReportView } from "@pages/cloud/CloudReportView";
import { CloudBatchReportGeneration } from "@pages/cloud/CloudBatchReportGeneration";
import { CloudSampleReportPreview } from "@pages/cloud/CloudSampleReportPreview";
import { CloudReportRemarksEntry } from "@pages/cloud/CloudReportRemarksEntry";
import { CloudDailyAttendance } from "@pages/cloud/CloudDailyAttendance";
import { CloudAttendanceReports } from "@pages/cloud/CloudAttendanceReports";
import { CloudSettings } from "@pages/cloud/CloudSettings";
import { CloudAuditLog } from "@pages/cloud/CloudAuditLog";
import { CloudDistrictDashboard } from "@pages/cloud/CloudDistrictDashboard";
import { CloudStaffPage } from "@pages/cloud/CloudStaffPage";
import { CloudPromoteClass } from "@pages/cloud/CloudPromoteClass";
import { CloudUserDirectory } from "@pages/cloud/CloudUserDirectory";
import { CloudSmsToParents } from "@pages/cloud/CloudSmsToParents";
import { CloudFees } from "@pages/cloud/CloudFees";
import { CloudSubscriptionApproval } from "@pages/cloud/CloudSubscriptionApproval";
import { CloudSubscriptionStatus } from "@pages/cloud/CloudSubscriptionStatus";
import { CloudTrainingAdmin } from "@pages/cloud/CloudTrainingAdmin";
import { CloudDistrictAdmins } from "@pages/cloud/CloudDistrictAdmins";
import { CloudStatistics } from "@pages/cloud/CloudStatistics";
import { CloudSendDetails } from "@pages/cloud/CloudSendDetails";
import { CloudSchoolAccounts } from "@pages/cloud/CloudSchoolAccounts";
import { CloudCredits } from "@pages/cloud/CloudCredits";
import { CloudPaymentReturn } from "@pages/cloud/CloudPaymentReturn";
import { CloudWhatsApp } from "@pages/cloud/CloudWhatsApp";
import { CloudMessagingAdmin } from "@pages/cloud/CloudMessagingAdmin";
import { CloudReportFees } from "@pages/cloud/CloudReportFees";
import { CloudReportPaymentsAdmin } from "@pages/cloud/CloudReportPaymentsAdmin";
import { CloudMockExams } from "@pages/cloud/CloudMockExams";
import { CloudMockExamDetail } from "@pages/cloud/CloudMockExamDetail";
import { CloudMockDistrict } from "@pages/cloud/CloudMockDistrict";
import { RequireMockAccess } from "@components/RequireMockAccess";
import { PublicHome } from "@pages/public/PublicHome";
import { RequireAuth } from "@components/RequireAuth";
import { RequireApprovedSchool } from "@components/RequireApprovedSchool";
import { RequireAdmin } from "@components/RequireAdmin";
import { ThemeProvider } from "@contexts/ThemeContext";

/**
 * EduLink GH cloud app routes.
 *
 * "/" is the public marketing homepage (PublicHome) - unauthenticated,
 * always reachable. The actual dashboard lives at "/dashboard".
 * "/signup" registers a single school; "/signup/district" registers a
 * whole district. "/attendance" is the daily attendance register.
 * "/independent-schools" (Super Admin) connects schools whose district is not on
 * EduLink GH yet to their district once it has joined.
 * "/students/photos" attaches finished photos (from the Batch Photo
 * Editor at /tools/photo-editor.html) to a class.
 */
export default function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route path="/" element={<PublicHome />} />

        <Route element={<CloudAuthLayout />}>
          <Route path="/login" element={<CloudLogin />} />
          <Route path="/signup" element={<CloudSchoolSignup />} />
          <Route path="/signup/district" element={<CloudDistrictSignup />} />
        </Route>

        <Route
          element={
            <RequireAuth>
              <RequireApprovedSchool>
                <CloudAppLayout />
              </RequireApprovedSchool>
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<CloudDashboard />} />
          <Route path="/students" element={<CloudStudents />} />
          <Route path="/statistics" element={<CloudStatistics />} />
          <Route
            path="/send-details"
            element={
              <RequireAdmin>
                <CloudSendDetails />
              </RequireAdmin>
            }
          />
          <Route
            path="/staff"
            element={
              <RequireAdmin>
                <CloudStaffPage />
              </RequireAdmin>
            }
          />
          <Route path="/students/register" element={<CloudStudentRegister />} />
          <Route path="/students/photos" element={<CloudPhotoImport />} />
          <Route path="/students/:id/edit" element={<CloudStudentEdit />} />
          <Route path="/assessments" element={<CloudAssessmentWorkspace />} />
          <Route path="/attendance" element={<CloudDailyAttendance />} />
          <Route path="/attendance/reports" element={<CloudAttendanceReports />} />
          <Route path="/report-remarks" element={<CloudReportRemarksEntry />} />
          <Route path="/reports" element={<CloudReportView />} />
          <Route path="/reports/batch" element={<CloudBatchReportGeneration />} />
          <Route
            path="/mock-exams"
            element={
              <RequireMockAccess>
                <CloudMockExams />
              </RequireMockAccess>
            }
          />
          <Route
            path="/mock-exams/district"
            element={
              <RequireMockAccess district>
                <CloudMockDistrict />
              </RequireMockAccess>
            }
          />
          <Route
            path="/mock-exams/:mockId"
            element={
              <RequireMockAccess>
                <CloudMockExamDetail />
              </RequireMockAccess>
            }
          />
          <Route
            path="/reports/sample"
            element={
              <RequireAdmin roles="reportSample">
                <CloudSampleReportPreview />
              </RequireAdmin>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAdmin>
                <CloudSettings />
              </RequireAdmin>
            }
          />
          <Route
            path="/audit-log"
            element={
              <RequireAdmin>
                <CloudAuditLog />
              </RequireAdmin>
            }
          />
          <Route
            path="/district"
            element={
              <RequireAdmin roles="district">
                <CloudDistrictDashboard />
              </RequireAdmin>
            }
          />
          <Route
            path="/classes/:classId/promote"
            element={
              <RequireAdmin>
                <CloudPromoteClass />
              </RequireAdmin>
            }
          />
          <Route
            path="/accounts"
            element={
              <RequireAdmin roles="district">
                <CloudUserDirectory />
              </RequireAdmin>
            }
          />
          <Route path="/sms" element={<CloudSmsToParents />} />
          <Route
            path="/fees"
            element={
              <RequireAdmin roles="fees">
                <CloudFees />
              </RequireAdmin>
            }
          />
          <Route
            path="/school-accounts/:schoolId"
            element={
              <RequireAdmin roles="platform">
                <CloudSchoolAccounts />
              </RequireAdmin>
            }
          />
          <Route
            path="/report-fees"
            element={
              <RequireAdmin roles="fees">
                <CloudReportFees />
              </RequireAdmin>
            }
          />
          <Route
            path="/credits"
            element={
              <RequireAdmin roles="fees">
                <CloudCredits />
              </RequireAdmin>
            }
          />
          <Route path="/payment-return" element={<CloudPaymentReturn />} />
          <Route path="/whatsapp" element={<CloudWhatsApp />} />
          <Route
            path="/messaging-admin"
            element={
              <RequireAdmin roles="platform">
                <CloudMessagingAdmin />
              </RequireAdmin>
            }
          />
          <Route
            path="/report-payments"
            element={
              <RequireAdmin roles="platform">
                <CloudReportPaymentsAdmin />
              </RequireAdmin>
            }
          />
          <Route
            path="/billing"
            element={
              <RequireAdmin roles="platform">
                <CloudSubscriptionApproval />
              </RequireAdmin>
            }
          />
          <Route
            path="/subscription"
            element={
              <RequireAdmin roles="subscription">
                <CloudSubscriptionStatus />
              </RequireAdmin>
            }
          />
          <Route
            path="/district-admins"
            element={
              <RequireAdmin roles="platform">
                <CloudDistrictAdmins />
              </RequireAdmin>
            }
          />
          <Route
            path="/independent-schools"
            element={
              <RequireAdmin roles="platform">
                <CloudIndependentSchools />
              </RequireAdmin>
            }
          />
          <Route
            path="/training"
            element={
              <RequireAdmin roles="platform">
                <CloudTrainingAdmin />
              </RequireAdmin>
            }
          />
        </Route>
      </Routes>
    </ThemeProvider>
  );
}
