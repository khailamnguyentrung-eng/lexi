"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-sm text-zinc-500 hover:text-lexi-primary-dark"
    >
      Đăng xuất
    </button>
  );
}
