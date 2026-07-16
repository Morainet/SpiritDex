import type { Metadata } from "next";
import { fetchTypeMatrix } from "@/lib/api";
import TypeMatrixClient from "@/components/TypeMatrixClient";

export const metadata: Metadata = {
  title: "属性相克表",
  description: "洛克王国手游 18 属性相克矩阵，点击属性查看克制关系",
};

export default async function TypeMatrixPage() {
  let matrix: Awaited<ReturnType<typeof fetchTypeMatrix>> | null = null;
  try {
    matrix = await fetchTypeMatrix();
  } catch {
    // 后端不可用，降级渲染
  }
  if (!matrix) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="mb-3 text-2xl font-bold">属性相克表</h1>
        <p className="text-sm text-muted">无法加载数据，请确认后端服务已启动。</p>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">属性相克表</h1>
        <p className="text-sm text-muted">
          点击任一属性，查看它克制谁、被谁克制 ·{" "}
          <span className="text-red-600">2</span> 克制 ·{" "}
          <span className="text-blue-600">½</span> 减半
        </p>
      </header>
      <TypeMatrixClient matrix={matrix} />
    </main>
  );
}
