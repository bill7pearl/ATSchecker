/**
 * User Activity Registry Utility
 * Manages logging of client-side events to localStorage.
 */

export interface ActivityLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
}

const STORAGE_KEY = "ats_cv_activity_log";

/**
 * Retrieves the activity logs array from localStorage.
 */
export function getActivityLogs(): ActivityLog[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error("Failed to parse activity logs from localStorage", error);
    return [];
  }
}

/**
 * Writes a new log entry to localStorage.
 */
export function logActivity(action: string, details: string): ActivityLog[] {
  if (typeof window === "undefined") return [];
  try {
    const logs = getActivityLogs();
    const newLog: ActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      action,
      details,
    };
    
    const updated = [newLog, ...logs].slice(0, 100); // keep last 100 entries
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    
    // Dispatch a custom event to notify components of log updates instantly
    window.dispatchEvent(new Event("activity_log_updated"));
    
    return updated;
  } catch (error) {
    console.error("Failed to write activity log to localStorage", error);
    return [];
  }
}

/**
 * Clears the activity logs array from localStorage.
 */
export function clearActivityLogs(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("activity_log_updated"));
  } catch (error) {
    console.error("Failed to clear activity logs from localStorage", error);
  }
}
