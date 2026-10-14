import { redirect } from "next/navigation";

export default function MaintenancePage() {
  redirect("/admin/system/settings/maintenance");
}
