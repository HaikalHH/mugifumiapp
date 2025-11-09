import { notFound } from "next/navigation";
import { RecipeDetail } from "../recipe-detail";

export default async function RecipeDetailPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const idNum = Number(productId);
  if (!Number.isFinite(idNum)) {
    notFound();
  }

  return <RecipeDetail productId={idNum} />;
}
