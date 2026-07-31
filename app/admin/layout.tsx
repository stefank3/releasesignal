import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { isAdminFromAccessToken } from "@/lib/auth/rbac";

type AdminLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const isAdmin = await isAdminFromAccessToken();

  if (!isAdmin) {
    notFound();
  }

  return children;
}
