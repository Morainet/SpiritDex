import type { Metadata } from "next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "注册",
};

export default function RegisterPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-12">
      <h1 className="mb-6 text-center text-2xl font-bold">注册灵宠档案</h1>
      <RegisterForm />
    </main>
  );
}
