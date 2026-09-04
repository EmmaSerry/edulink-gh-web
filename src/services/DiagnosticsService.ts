import { db } from "@database/db";
import { APP_INFO } from "@config/appConfig";
import { BackupService } from "./BackupService";
import type { DiagnosticsSnapshotEntry } from "@models/DiagnosticsSnapshot";

/**
 * Module 7 (Phase 5) - Application Diagnostics. Everything here is read
 * live from the browser and the local database on demand; only a
 * manually-triggered "Run Diagnostics" writes a short history row (see
 * DiagnosticsSnapshot.ts's doc comment for why ACTRS does not poll this
 * in the background).
 */
export interface DiagnosticsReport {
  appVersion: string;
  appPhase: string;
  dbName: string;
  dbVersion: number;
  indexedDbSupported: boolean;
  storageUsageBytes?: number;
  storageQuotaBytes?: number;
  storagePersisted?: boolean;
  serviceWorkerSupported: boolean;
  serviceWorkerStatus: string;
  cacheNames: string[];
  lastBackupAt?: string;
  lastBackupFileName?: string;
  totalStudents: number;
  totalRecords: number;
  browser: string;
  online: boolean;
  screenSize: string;
  troubleshooting: string[];
}

async function getServiceWorkerStatus(): Promise<{ status: string; supported: boolean }> {
  if (!("serviceWorker" in navigator)) return { status: "Not supported by this browser", supported: false };
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return { status: "Not registered yet", supported: true };
    if (registration.active) return { status: "Active - offline-ready", supported: true };
    if (registration.installing) return { status: "Installing…", supported: true };
    if (registration.waiting) return { status: "Waiting to activate (reload to update)", supported: true };
    return { status: "Registered, status unknown", supported: true };
  } catch {
    return { status: "Could not check", supported: true };
  }
}

async function getStorageEstimate(): Promise<{ usage?: number; quota?: number; persisted?: boolean }> {
  if (!("storage" in navigator) || !navigator.storage.estimate) return {};
  try {
    const estimate = await navigator.storage.estimate();
    const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : undefined;
    return { usage: estimate.usage, quota: estimate.quota, persisted };
  } catch {
    return {};
  }
}

async function getCacheNames(): Promise<string[]> {
  if (!("caches" in window)) return [];
  try {
    return await caches.keys();
  } catch {
    return [];
  }
}

class DiagnosticsServiceImpl {
  /** Module 9 - Cache management. Clears every Cache Storage entry the
   *  service worker created (NOT the IndexedDB database - student/
   *  assessment/report data is completely untouched) and unregisters
   *  the service worker so the next load re-installs a clean copy. Used
   *  when a school's device is showing stale assets that a normal
   *  reload/update-prompt hasn't fixed. */
  async clearCachesAndReload(): Promise<void> {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
    window.location.reload();
  }


  async runDiagnostics(): Promise<DiagnosticsReport> {
    const [sw, storage, cacheNames, backupHistory, totalStudents, allCounts] = await Promise.all([
      getServiceWorkerStatus(),
      getStorageEstimate(),
      getCacheNames(),
      BackupService.getHistory(),
      db.students.count(),
      Promise.all([
        db.enrollments.count(), db.scoreRecords.count(), db.skillAssessmentRecords.count(),
        db.generatedReports.count(), db.reportVersions.count(),
      ]),
    ]);

    const lastBackup = backupHistory.find((b) => b.type === "export");
    const totalRecords = totalStudents + allCounts.reduce((a, b) => a + b, 0);

    const troubleshooting: string[] = [];
    if (!("indexedDB" in window)) troubleshooting.push("This browser does not support IndexedDB - ACTRS cannot store data here. Use a modern browser (Chrome, Edge, Firefox).");
    if (!sw.supported) troubleshooting.push("Service Workers are not supported - offline installation will not work in this browser.");
    if (sw.supported && sw.status === "Not registered yet") troubleshooting.push("The service worker has not registered yet - reload the page once more while online to finish installing offline support.");
    if (storage.quota && storage.usage && storage.usage / storage.quota > 0.85) troubleshooting.push("Storage usage is above 85% of the browser's quota - consider archiving old terms or freeing device storage.");
    if (!lastBackup) troubleshooting.push("No backup has ever been created - visit Backup & Restore to create one, especially before a major update or device change.");
    else {
      const daysSinceBackup = (Date.now() - new Date(lastBackup.performedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceBackup > 30) troubleshooting.push(`The last backup was ${Math.round(daysSinceBackup)} days ago - consider creating a fresh one.`);
    }
    if (!navigator.onLine) troubleshooting.push("This device is currently offline - ACTRS will keep working normally, this is just informational.");

    return {
      appVersion: APP_INFO.version,
      appPhase: APP_INFO.phase,
      dbName: db.name,
      dbVersion: db.verno,
      indexedDbSupported: "indexedDB" in window,
      storageUsageBytes: storage.usage,
      storageQuotaBytes: storage.quota,
      storagePersisted: storage.persisted,
      serviceWorkerSupported: sw.supported,
      serviceWorkerStatus: sw.status,
      cacheNames,
      lastBackupAt: lastBackup?.performedAt,
      lastBackupFileName: lastBackup?.fileName,
      totalStudents,
      totalRecords,
      browser: navigator.userAgent,
      online: navigator.onLine,
      screenSize: `${window.screen.width}x${window.screen.height}`,
      troubleshooting,
    };
  }

  async saveSnapshot(report: DiagnosticsReport, notes?: string): Promise<void> {
    const entry: Omit<DiagnosticsSnapshotEntry, "id"> = {
      recordedAt: new Date().toISOString(),
      dbVersion: report.dbVersion,
      storageUsageBytes: report.storageUsageBytes,
      storageQuotaBytes: report.storageQuotaBytes,
      serviceWorkerStatus: report.serviceWorkerStatus,
      totalStudents: report.totalStudents,
      totalRecords: report.totalRecords,
      notes,
    };
    await db.diagnosticsSnapshots.add(entry as DiagnosticsSnapshotEntry);
  }

  async getSnapshotHistory(): Promise<DiagnosticsSnapshotEntry[]> {
    const rows = await db.diagnosticsSnapshots.toArray();
    return rows.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)).slice(0, 20);
  }
}

export const DiagnosticsService = new DiagnosticsServiceImpl();
