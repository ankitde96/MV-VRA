import { ForbiddenError } from "@/lib/errors";
import { env } from "@/lib/env";
import { dbConnect } from "@/lib/db/connect";
import { User } from "@/lib/db/models/user";
import { getCurrentSession } from "@/lib/auth/current-session";

export async function requireSuperAdmin() {
  const session = await getCurrentSession();
  if (!session) throw new ForbiddenError("Super Admin access is required");

  await dbConnect();
  const user = await User.findOne({
    _id: session.userId,
    email: env.SUPER_ADMIN_EMAIL.toLowerCase(),
    status: "active",
  })
    .select("_id email")
    .lean();
  if (!user) throw new ForbiddenError("Super Admin access is required");

  return { userId: user._id.toString(), email: user.email };
}

export function isSuperAdminEmail(email: string | null | undefined) {
  return email?.toLowerCase() === env.SUPER_ADMIN_EMAIL.toLowerCase();
}
