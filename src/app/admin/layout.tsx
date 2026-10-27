import { AppShell } from "@/components/layout/app-shell";
import { flushNotificationsLater } from "@/server/notifications";
import { signOut } from "@/server/actions/auth";
import { isApprover, requireStaff, staffRole } from "@/server/auth";
import { contextsFor, shellUser } from "@/server/shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Each page checks its own role; the layout admits every staff role.
  const viewer = await requireStaff(["admin", "manager", "trainer", "partners", "enterprise"]);
  const role = staffRole(viewer) ?? "admin";
  const approver = role !== "admin" && role !== "enterprise" && (await isApprover(viewer.id));
  // E-mails queued by what this person just did go out after the response.
  flushNotificationsLater();
  return (
    <AppShell
      area="admin"
      navRole={role}
      approver={approver}
      currentContextKey="admin"
      contexts={contextsFor(viewer)}
      user={shellUser(viewer)}
      signOutAction={signOut}
    >
      {children}
    </AppShell>
  );
}
