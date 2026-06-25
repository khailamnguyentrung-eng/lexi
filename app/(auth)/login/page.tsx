"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Email hoặc mật khẩu không đúng. Thử lại nhé!");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-lexi-soft px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-lg shadow-purple-100">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-lexi-primary text-2xl">
            🦄
          </div>
          <h1 className="text-xl font-semibold text-lexi-primary-dark">Chào bạn, mình là Lexi!</h1>
          <p className="mt-1 text-sm text-zinc-500">Đăng nhập để bắt đầu buổi học hôm nay.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-lexi-primary"
              placeholder="ban@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Mật khẩu</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-lexi-primary"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-rose-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-xl bg-lexi-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-lexi-primary-dark disabled:opacity-60"
          >
            {loading ? "Đang vào..." : "Bắt đầu học với Lexi"}
          </button>
        </form>
      </div>
    </div>
  );
}
