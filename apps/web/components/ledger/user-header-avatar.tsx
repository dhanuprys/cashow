import Link from "next/link";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getSessionUser } from "@/lib/auth/session";

export async function UserHeaderAvatar() {
  const user = await getSessionUser();
  if (!user) return null;

  return (
    <Link
      href="/app/settings"
      title={user.name || user.username || "Pengaturan Profil"}
      className="group relative flex items-center gap-2 rounded-xl p-1 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <UserAvatar
        avatar={user.avatar}
        name={user.name || user.username}
        size="sm"
        className="ring-1 ring-border group-hover:ring-primary/50"
      />
    </Link>
  );
}
