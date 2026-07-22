import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "登录",
};

export default function LoginPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-12">
      <h1 className="mb-6 text-center text-2xl font-bold">登录灵宠档案</h1>
      <LoginForm />
    </main>
  );
}
