/** Department names come from the saved records on Company & people, so any name is valid. */
export type Dept = string;
export type ShiftTone = "blue" | "teal" | "violet" | "amber" | "rose";

export interface Shift {
  id: string;
  /** "S1", "S2" … shown on the template card */
  code: string;
  name: string;
  start: number;
  end: number;
  breakStart: number;
  breakEnd: number;
  tone: ShiftTone;
  version: number;
  /** minutes after the start before a late arrival is flagged */
  lateAfter: number;
  /** minutes before the end before an early exit is flagged */
  earlyAfter: number;
  /** archived templates take no new assignments; existing roster records keep them */
  archived?: boolean;
}
export interface Employee { id: string; name: string; dept: Dept; shiftId: string; role: string }
export type PermissionStatusValue = "pending" | "approved" | "declined" | "cancelled";
export interface PermissionEvent {
  status: PermissionStatusValue;
  actor: string;
  /** ISO timestamp */
  at: string;
  note?: string;
}
export interface PermissionRequest {
  id: string;
  employeeId: string;
  date: string;
  from: string;
  to: string;
  kind: "Personal" | "Business duty";
  reason: string;
  status: PermissionStatusValue;
  /** the task or purpose the time away is for */
  purpose?: string;
  destination?: string;
  /** task or ticket reference */
  ref?: string;
  /** ISO timestamp of the request */
  requestedAt?: string;
  reviewer?: string;
  decidedAt?: string;
  /** decisions after the request; the request itself is shown from requestedAt */
  history?: PermissionEvent[];
}

export const COMPANY = { id: "ascending", name: "Ascending Softwares", city: "Tirunelveli, Tamil Nadu, India" };
// The people store rewrites DEPARTMENTS and EMPLOYEES in place, so every screen that reads them sees saved edits.
export const DEPARTMENTS: Dept[] = ["Engineering", "Operations", "Administration"];

/** Fictional public-holiday calendar used by the classic Daily register and Monthly report. */
export const HOLIDAYS: Record<string, string> = {
  "2026-09-14": "Vinayagar Chathurthi",
  "2026-10-02": "Gandhi Jayanti",
  "2026-10-19": "Ayudha Puja",
  "2026-10-20": "Vijayadashami",
  "2026-11-08": "Deepavali",
};

// Minutes from the shift start date's midnight. End may exceed 1440 for overnight shifts.
// The template store rewrites this array in place, so every screen that reads it sees edits.
export const SHIFTS: Shift[] = [
  { id: "early", code: "S1", name: "Early", start: 360, end: 840, breakStart: 600, breakEnd: 630, tone: "blue", version: 2, lateAfter: 10, earlyAfter: 10 },
  { id: "general", code: "S2", name: "General", start: 540, end: 1080, breakStart: 780, breakEnd: 840, tone: "teal", version: 3, lateAfter: 10, earlyAfter: 10 },
  { id: "evening", code: "S3", name: "Evening", start: 840, end: 1320, breakStart: 1080, breakEnd: 1110, tone: "violet", version: 1, lateAfter: 15, earlyAfter: 10 },
  { id: "night", code: "S4", name: "Night", start: 1320, end: 1800, breakStart: 1560, breakEnd: 1590, tone: "amber", version: 2, lateAfter: 15, earlyAfter: 15 },
];

const E = (id: string, name: string, dept: Dept, shiftId: string, role: string): Employee => ({ id, name, dept, shiftId, role });

export const EMPLOYEES: Employee[] = [
  E("e1", "Maya Raj", "Engineering", "general", "Engineering lead"),
  E("e2", "Arun Daniel", "Engineering", "general", "Software engineer"),
  E("e3", "N. Priya", "Engineering", "early", "Software engineer"),
  E("e4", "S. Anita", "Operations", "early", "Operations analyst"),
  E("e5", "P. Ravi", "Operations", "evening", "Field coordinator"),
  E("e6", "Daniel Lim", "Engineering", "evening", "QA engineer"),
  E("e7", "Farah Nizam", "Administration", "general", "HR executive"),
  E("e8", "Joel Mathew", "Operations", "night", "Support engineer"),
  E("e9", "Ruth George", "Administration", "general", "Accounts associate"),
  E("e10", "Leena Joseph", "Operations", "evening", "Field coordinator"),
  E("e11", "David Thomas", "Engineering", "night", "Site reliability engineer"),
  E("e12", "Sarah Paul", "Administration", "general", "Office manager"),
];

export const PERIOD = { from: "2026-10-01", to: "2026-10-09" };
export const TODAY = "2026-10-08";

const decided = (status: PermissionStatusValue, actor: string, at: string, note?: string): Pick<PermissionRequest, "status" | "reviewer" | "decidedAt" | "history"> => ({
  status, reviewer: actor, decidedAt: at, history: [{ status, actor, at, note }],
});

export const PERMISSIONS: PermissionRequest[] = [
  { id: "p1", employeeId: "e2", date: "2026-10-08", from: "15:30", to: "16:00", kind: "Personal", reason: "Personal call", status: "pending", purpose: "Family call", requestedAt: "2026-10-08T05:10:00Z" },
  { id: "p2", employeeId: "e5", date: "2026-10-08", from: "20:00", to: "21:00", kind: "Business duty", reason: "Client site visit", status: "pending", purpose: "Site survey", destination: "Tenkasi", ref: "TSK-2043", requestedAt: "2026-10-08T09:25:00Z" },
  { id: "p3", employeeId: "e9", date: "2026-10-08", from: "16:00", to: "18:00", kind: "Personal", reason: "Parent-teacher meeting", status: "pending", purpose: "School meeting", destination: "St. Mary's School", requestedAt: "2026-10-07T14:45:00Z" },
  { id: "p4", employeeId: "e1", date: "2026-10-08", from: "11:00", to: "12:00", kind: "Personal", reason: "Bank visit", purpose: "Bank errand", destination: "City Union Bank", requestedAt: "2026-10-07T12:00:00Z", ...decided("approved", "Farah Nizam", "2026-10-07T13:20:00Z", "Approved. Please return by 12:00.") },
  { id: "p5", employeeId: "e2", date: "2026-10-08", from: "11:30", to: "13:00", kind: "Business duty", reason: "Client visit, Palayamkottai", purpose: "Client site visit", destination: "Palayamkottai", ref: "TSK-2041", requestedAt: "2026-10-07T10:05:00Z", ...decided("approved", "Farah Nizam", "2026-10-07T10:40:00Z") },
  { id: "p6", employeeId: "e10", date: "2026-10-08", from: "16:40", to: "17:40", kind: "Personal", reason: "Medical appointment", purpose: "Medical appointment", destination: "Sri Clinic", requestedAt: "2026-10-06T16:30:00Z", ...decided("approved", "Farah Nizam", "2026-10-07T04:15:00Z") },
  { id: "p7", employeeId: "e7", date: "2026-10-08", from: "15:00", to: "16:00", kind: "Personal", reason: "Errand", purpose: "Personal errand", requestedAt: "2026-10-08T04:30:00Z", ...decided("declined", "Maya Raj", "2026-10-08T06:05:00Z", "Overlaps the afternoon client call. Please reschedule.") },
  { id: "p8", employeeId: "e4", date: "2026-10-06", from: "08:00", to: "09:00", kind: "Personal", reason: "Medical appointment", purpose: "Medical appointment", destination: "District hospital", requestedAt: "2026-10-05T11:00:00Z", ...decided("approved", "Farah Nizam", "2026-10-05T12:10:00Z") },
  { id: "p9", employeeId: "e3", date: "2026-10-07", from: "13:00", to: "14:00", kind: "Personal", reason: "Left early for a family event", purpose: "Family event", requestedAt: "2026-10-06T15:00:00Z", status: "cancelled", history: [{ status: "cancelled", actor: "N. Priya", at: "2026-10-07T03:30:00Z", note: "Withdrawn. The event was moved." }] },
  { id: "p10", employeeId: "e8", date: "2026-10-08", from: "22:00", to: "22:05", kind: "Personal", reason: "Bus delayed on the highway", purpose: "Late arrival", requestedAt: "2026-10-08T16:40:00Z", ...decided("approved", "Farah Nizam", "2026-10-08T17:10:00Z") },
  { id: "p11", employeeId: "e11", date: "2026-10-08", from: "02:30+1", to: "03:00+1", kind: "Business duty", reason: "Overnight server migration call with the vendor", purpose: "Vendor migration call", destination: "Remote", ref: "TSK-2051", requestedAt: "2026-10-08T12:00:00Z", ...decided("approved", "Maya Raj", "2026-10-08T12:30:00Z") },
  { id: "p12", employeeId: "e6", date: "2026-10-08", from: "14:00", to: "14:30", kind: "Personal", reason: "Traffic jam near the bypass", purpose: "Late arrival", requestedAt: "2026-10-08T09:10:00Z", ...decided("declined", "Farah Nizam", "2026-10-08T09:40:00Z", "No check-in was recorded for the day, so there is nothing to credit.") },
  { id: "p13", employeeId: "e2", date: "2026-10-01", from: "09:00", to: "09:45", kind: "Personal", reason: "Doctor's appointment ran long", purpose: "Medical check-up", destination: "Sri Clinic", requestedAt: "2026-10-01T03:20:00Z", ...decided("declined", "Farah Nizam", "2026-10-01T04:05:00Z", "Raised after the shift began. Please request late arrivals the day before.") },
  { id: "p14", employeeId: "e2", date: "2026-10-05", from: "10:00", to: "12:30", kind: "Business duty", reason: "Network cabling check at the junction office", purpose: "Cabling check", destination: "Tirunelveli Junction", ref: "TSK-2038", requestedAt: "2026-10-02T09:15:00Z", ...decided("approved", "Farah Nizam", "2026-10-02T10:00:00Z", "Approved for 10:00 to 12:30.") },
  { id: "p15", employeeId: "e2", date: "2026-10-06", from: "15:30", to: "16:30", kind: "Personal", reason: "Passport renewal appointment", purpose: "Passport renewal", destination: "Passport Seva Kendra", requestedAt: "2026-10-05T11:40:00Z", ...decided("approved", "Maya Raj", "2026-10-05T12:30:00Z") },
  { id: "p16", employeeId: "e2", date: "2026-10-07", from: "17:00", to: "18:00", kind: "Personal", reason: "Leaving early for a family function", purpose: "Family function", requestedAt: "2026-10-06T08:50:00Z", ...decided("approved", "Maya Raj", "2026-10-06T09:35:00Z", "Approved. Hand over the open ticket first.") },
  { id: "p17", employeeId: "e1", date: "2026-10-06", from: "14:00", to: "16:00", kind: "Business duty", reason: "Release sign-off at the client office", purpose: "Release sign-off", destination: "Client office, Palayamkottai", ref: "TSK-2036", requestedAt: "2026-10-05T10:10:00Z", ...decided("approved", "Farah Nizam", "2026-10-05T10:45:00Z") },
];

export const TASKS = [
  { id: "t1", label: "Client visit, Palayamkottai" },
  { id: "t2", label: "Release preparation" },
  { id: "t3", label: "Site survey, Tenkasi" },
  { id: "t4", label: "Vendor pickup" },
  { id: "t5", label: "Staging smoke tests" },
  { id: "t6", label: "Bank deposit run" },
  { id: "t7", label: "Practice site visit" },
  { id: "t8", label: "Practice parts pickup" },
  { id: "t9", label: "Network cabling check, Tirunelveli Junction" },
  { id: "t10", label: "Release sign-off, client office" },
];

export const empCode = (id: string) => `AS-${1000 + Number(id.slice(1))}`;
