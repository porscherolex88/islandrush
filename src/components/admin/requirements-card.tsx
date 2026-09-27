import { and, asc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { collections, items, mapAreas, requirements } from "@/db/schema";
import { AdminCard, DataTable } from "./ui";

export async function RequirementsCard({ ownerType, ownerId, back, description }: { ownerType: "AREA" | "VAULT"; ownerId: string; back: string; description?: string }) {
  const list = await db
    .select({ r: requirements, item: items.name, collection: collections.name, area: mapAreas.name })
    .from(requirements)
    .leftJoin(items, eq(items.id, requirements.itemId))
    .leftJoin(collections, eq(collections.id, requirements.collectionId))
    .leftJoin(mapAreas, eq(mapAreas.id, requirements.areaId))
    .where(and(eq(requirements.ownerType, ownerType), eq(requirements.ownerId, ownerId)))
    .orderBy(asc(requirements.sortOrder));
  const b = encodeURIComponent(back);
  return (
    <AdminCard
      title="Requirements"
      description={description}
      bodyClassName="p-0"
      actions={
        <Button asChild size="sm" variant="outline">
          <Link href={`/admin/manage/requirements/new?ownerType=${ownerType}&ownerId=${ownerId}&back=${b}`}>
            <Plus /> Add
          </Link>
        </Button>
      }
    >
      <DataTable
        rows={list}
        rowKey={(x) => x.r.id}
        empty="No requirements. Players can unlock this freely."
        columns={[
          { key: "l", header: "Label", cell: (x) => <Link href={`/admin/manage/requirements/${x.r.id}?back=${b}`} className="font-medium text-primary hover:underline">{x.r.label}</Link> },
          { key: "t", header: "Type", cell: (x) => <span className="text-xs">{x.r.type.replace(/_/g, " ")}</span> },
          { key: "target", header: "Target", cell: (x) => x.item ?? x.collection ?? x.area ?? "-" },
          { key: "q", header: "Qty", align: "right", cell: (x) => x.r.quantity },
          { key: "c", header: "Consumed", cell: (x) => (x.r.consume ? "Yes" : "No") },
        ]}
      />
    </AdminCard>
  );
}
