import { redirect } from "next/navigation";
import { NewDesignForm } from "@/components/NewDesignForm";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewPage() {
  const viewer = await currentUser();
  if (!viewer) redirect("/signin?next=/new");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">New design</h1>
      <NewDesignForm />
    </div>
  );
}
