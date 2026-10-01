import { sql } from "drizzle-orm";
import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminCard, AdminPage, DataTable, FilterBar, FilterInput, Pagination, UserLink, pageOf, str } from "@/components/admin/ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireAdmin } from "@/lib/auth/session";
import { formatCash } from "@/lib/money";
import { getFiatDisplay } from "@/lib/fiat-display";
import { formatDate } from "@/lib/time";
import { one, rows } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Referral tree" };
const PAGE = 50;

type Node = { id: string; name: string; email: string; status: string; created_at: string; total_deposits: string; direct: number; network: number; earned: string };

const nodeSelect = sql`
  p.id, p.name, p.email, p.status::text, p.created_at::text, p.total_deposits::text,
  (select count(*)::int from profiles c where c.referred_by_id = p.id) as direct,
  (with recursive t(id, depth) as (
      select id, 1 from profiles where referred_by_id = p.id
      union all select c.id, t.depth + 1 from profiles c join t on c.referred_by_id = t.id where t.depth < 3
    ) select count(*)::int from t) as network,
  (select coalesce(sum(amount), 0)::text from cash_rewards cr where cr.user_id = p.id and cr.source::text like 'REFERRAL%' and cr.status <> 'REVERSED') as earned`;

export default async function ReferralTreePage({ searchParams }: PageProps<"/admin/referrals/tree">) {
  const fiat = await getFiatDisplay();
  await requireAdmin("referrals.view");
  const sp = await searchParams;
  const page = pageOf(sp);
  const q = str(sp.q)?.trim().toLowerCase();
  let rootId = str(sp.root);
  if (!rootId && q) {
    const found = await rows<{ id: string }>(sql`select id from profiles where lower(email) = ${q} or referral_code = ${q.toUpperCase()} limit 1`);
    rootId = found[0]?.id;
  }

  if (!rootId) {
    const top = await rows<Node>(sql`
      select ${nodeSelect} from profiles p
      where exists (select 1 from profiles c where c.referred_by_id = p.id)
      order by (select count(*) from profiles c where c.referred_by_id = p.id) desc, p.created_at
      limit ${PAGE + 1} offset ${(page - 1) * PAGE}`);
    return (
      <AdminPage title="Referral tree" description="Open any referrer to explore their downline up to three levels. Branches load one level at a time.">
        <FilterBar basePath="/admin/referrals/tree">
          <FilterInput name="q" label="Find user" value={q} placeholder="Email or referral code" />
        </FilterBar>
        {q && <p className="text-sm text-amber-600">No user found for &quot;{q}&quot;.</p>}
        <AdminCard title="Top referrers" bodyClassName="p-0">
          <NodeTable nodes={top.slice(0, PAGE)} fiat={fiat} />
        </AdminCard>
        <Pagination page={page} hasMore={top.length > PAGE} sp={sp} basePath="/admin/referrals/tree" />
      </AdminPage>
    );
  }

  const [root, ancestors, children] = await Promise.all([
    one<Node | undefined>(sql`select ${nodeSelect} from profiles p where p.id = ${rootId}`),
    rows<{ id: string; name: string; depth: number }>(sql`
      with recursive up(id, name, parent, depth) as (
        select id, name, referred_by_id, 0 from profiles where id = ${rootId}
        union all select p.id, p.name, p.referred_by_id, up.depth + 1 from profiles p join up on p.id = up.parent where up.depth < 10
      ) select id, name, depth from up where depth > 0 order by depth desc`),
    rows<Node>(sql`
      select ${nodeSelect} from profiles p where p.referred_by_id = ${rootId}
      order by p.created_at desc limit ${PAGE + 1} offset ${(page - 1) * PAGE}`),
  ]);
  if (!root) {
    return (
      <AdminPage title="Referral tree">
        <p className="text-sm text-muted-foreground">User not found.</p>
      </AdminPage>
    );
  }

  return (
    <AdminPage title={`${root.name}'s referrals`} description={`${root.direct} direct referrals, ${root.network} across three levels, ${formatCash(root.earned, { currency: fiat })} earned.`}>
      <nav aria-label="Upline" className="flex flex-wrap items-center gap-1 text-sm">
        <Link href="/admin/referrals/tree" className="text-primary hover:underline">
          All
        </Link>
        {ancestors.map((a) => (
          <span key={a.id} className="flex items-center gap-1">
            <ChevronRight className="size-3.5 text-muted-foreground" />
            <Link href={`/admin/referrals/tree?root=${a.id}`} className="text-primary hover:underline">
              {a.name}
            </Link>
          </span>
        ))}
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <span className="font-medium">{root.name}</span>
      </nav>
      <AdminCard title="Direct referrals (level 1)" description="Open a branch to see the next level" bodyClassName="p-0">
        <NodeTable nodes={children.slice(0, PAGE)} fiat={fiat} />
      </AdminCard>
      <Pagination page={page} hasMore={children.length > PAGE} sp={sp} basePath="/admin/referrals/tree" />
    </AdminPage>
  );
}

function NodeTable({ nodes, fiat }: { nodes: Node[]; fiat: import("@/lib/fiat-display.shared").FiatDisplay }) {
  return (
    <DataTable
      rows={nodes}
      rowKey={(n) => n.id}
      empty="No referrals"
      columns={[
        { key: "u", header: "User", cell: (n) => <UserLink id={n.id} name={n.name} email={n.email} /> },
        { key: "j", header: "Joined", cell: (n) => formatDate(n.created_at) },
        { key: "d", header: "Deposits", align: "right", cell: (n) => formatCash(n.total_deposits, { currency: fiat }) },
        { key: "r", header: "Direct", align: "right", cell: (n) => n.direct },
        { key: "n", header: "Network (3 lvl)", align: "right", cell: (n) => n.network },
        { key: "e", header: "Earned", align: "right", cell: (n) => formatCash(n.earned, { currency: fiat }) },
        { key: "s", header: "Status", cell: (n) => <StatusBadge status={n.status} /> },
        {
          key: "o",
          header: "",
          cell: (n) =>
            n.direct > 0 ? (
              <Link href={`/admin/referrals/tree?root=${n.id}`} className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline">
                Open <ChevronRight className="size-3" />
              </Link>
            ) : null,
        },
      ]}
    />
  );
}
