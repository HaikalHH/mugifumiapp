import { RecipeForm } from "../../recipe-form";

export default async function EditRecipePage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const idNum = Number(productId);
  return <RecipeForm mode="edit" productId={Number.isFinite(idNum) ? idNum : undefined} />;
}
