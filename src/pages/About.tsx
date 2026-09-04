import { PageHeader } from "@components/PageHeader";
import { Card } from "@components/Card";
import { DeveloperCredit } from "@components/DeveloperCredit";
import { useAppInfo } from "@hooks/useAppInfo";
import { useInstallPrompt } from "@hooks/useInstallPrompt";

export function About() {
  const { app, organisation } = useAppInfo();
  const { canInstall, installed, install } = useInstallPrompt();

  return (
    <>
      <PageHeader title="About" description="Version, licence and developer information" />
      <div className="row g-4">
        <div className="col-md-7">
          <Card className="mb-4">
            <h2 className="h6">{app.name} ({app.shortName})</h2>
            <p className="text-muted">{app.tagline}</p>
            <dl className="row mb-0 small">
              <dt className="col-5">Version</dt>
              <dd className="col-7">{app.version}</dd>
              <dt className="col-5">Current phase</dt>
              <dd className="col-7">{app.phase}</dd>
              <dt className="col-5">Directorate</dt>
              <dd className="col-7">{organisation.directorate}</dd>
              <dt className="col-5">Circuit</dt>
              <dd className="col-7">{organisation.circuit}</dd>
              <dt className="col-5">Runtime</dt>
              <dd className="col-7">100% browser-based, offline-first (PWA)</dd>
            </dl>
          </Card>
          {/* Phase 7 (Module 3 - PWA deployment package): a browser's own
             "Install" affordance is easy for a non-technical user to miss
             entirely, so ACTRS now offers its own explicit action here
             instead of relying on it being discovered. */}
          <Card className="mb-4">
            <h2 className="h6">Install as an app</h2>
            {installed ? (
              <p className="text-success mb-0">
                <i className="bi bi-check-circle-fill me-1" />
                ACTRS is installed on this device and will keep working fully offline.
              </p>
            ) : canInstall ? (
              <>
                <p className="text-muted">
                  Install ACTRS on this computer for a faster, full-screen experience
                  that works without an internet connection - just like a regular
                  desktop application.
                </p>
                <button className="btn btn-primary btn-sm" onClick={install}>
                  <i className="bi bi-download me-1" /> Install ACTRS
                </button>
              </>
            ) : (
              <p className="text-muted mb-0 small">
                This browser doesn't offer an in-page install action right now - look
                for an "Install" or "Add to Home Screen" option in your browser's own
                menu, or an icon in the address bar. See the User Manual's
                Installation chapter for step-by-step instructions per browser.
              </p>
            )}
          </Card>
          <Card>
            <h2 className="h6">Replaces</h2>
            <p className="text-muted mb-0">
              The previous Microsoft Excel workbook + Word Mail Merge workflow used
              for Lower Primary, Upper Primary, JHS and Kindergarten terminal report
              cards.
            </p>
          </Card>
        </div>
        <div className="col-md-5">
          <Card>
            <h2 className="h6 mb-3">Developed by</h2>
            <DeveloperCredit variant="full" />
          </Card>
        </div>
      </div>
    </>
  );
}
