import { redirect } from "next/navigation";
import { NewDesignForm } from "@/components/NewDesignForm";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewPage() {
  const viewer = await currentUser();
  if (!viewer) redirect("/signin?next=/new");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="title">New design</h1>
      <NewDesignForm />
    </div>
  );
}
