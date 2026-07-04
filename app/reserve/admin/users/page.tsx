import { redirect } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/Page";
import { UsersPanel } from "@/components/auth/UsersPanel";
import { currentUser, listUsers } from "@/lib/auth";
import { listPeople } from "@/lib/repos/people";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function UsersAdminPage() {
  const me = await currentUser();
  if (me && me.role !== "admin") redirect("/reserve");

  const db = getDb();
  const users = listUsers().map((u) => ({
    ...u,
    person_name: u.person_id
      ? ((db.prepare("SELECT name FROM people WHERE id=?").get(u.person_id) as { name: string } | undefined)?.name ?? null)
      : null,
  }));
  const people = listPeople().map((p) => ({ id: p.id, name: p.name }));

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        eyebrow="Reserve · Admin"
        title="Users & roles"
        description="Accounts, role-based access, and the directory links that attribute every action to a real person."
      />
      <UsersPanel users={users as any} people={people} currentUserId={me?.id ?? 0} />
    </PageContainer>
  );
}
