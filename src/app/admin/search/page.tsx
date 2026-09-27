import { sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminCard, AdminPage, FilterBar, FilterInput, str } from "@/components/admin/ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/states";
import type { Permission } from "@/lib/permissions";
import { requireAdmin } from "@/lib/auth/session";
import { rows } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Search" };

type Hit = { id: string; title: string; subtitle: string | null; status: string | null; href: string };
type Group = { key: string; label: string; permission: Permission; hits: Hit[] };

const LIMIT = 8;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SearchPage({ searchParams }: PageProps<"/admin/search">) {
  const admin = await requireAdmin();
  const q = str((await searchParams).q)?.trim() ?? "";
  const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
  const isUuid = UUID.test(q);
  const num = /^#?\d{1,9}$/.test(q) ? Number(q.replace("#", "")) : null;

  const searches: { key: string; label: string; permission: Permission; run: () => Promise<Hit[]> }[] = [
    {
      key: "users",
      label: "Users",
      permission: "users.view",
      run: () =>
        rows<Hit>(sql`
          select id, name as title, email || ' · ' || referral_code as subtitle, status::text as status, '/admin/users/' || id as href
          from profiles
          where email ilike ${like} or name ilike ${like} or phone ilike ${like} or referral_code = ${q.toUpperCase()} or id = ${q}
          order by (lower(email) = ${q.toLowerCase()}) desc, created_at desc limit ${LIMIT}`),
    },
    {
      key: "deposits",
      label: "Deposits",
      permission: "finance.view",
      run: () =>
        rows<Hit>(sql`
          select d.id::text as id, 'RM' || d.amount::text || ' · ' || d.reference as title, p.email || ' · ' || to_char(d.created_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon YYYY') as subtitle, d.status::text as status, '/admin/finance/deposits/' || d.id as href
          from deposits d join profiles p on p.id = d.user_id
          where d.reference ilike ${like} or d.payer_name ilike ${like} or p.email ilike ${like} ${isUuid ? sql`or d.id = ${q}::uuid` : sql``}
          order by d.created_at desc limit ${LIMIT}`),
    },
    {
      key: "withdrawals",
      label: "Withdrawals",
      permission: "finance.view",
      run: () =>
        rows<Hit>(sql`
          select w.id::text as id, 'RM' || w.amount::text || ' to ' || (w.account_snapshot->>'bankName') as title, p.email || coalesce(' · ' || w.payout_reference, '') as subtitle, w.status::text as status, '/admin/finance/withdrawals/' || w.id as href
          from withdrawals w join profiles p on p.id = w.user_id
          where p.email ilike ${like} or w.payout_reference ilike ${like} or w.account_snapshot->>'accountNumber' = ${q} ${isUuid ? sql`or w.id = ${q}::uuid` : sql``}
          order by w.created_at desc limit ${LIMIT}`),
    },
    {
      key: "transactions",
      label: "Ledger transactions",
      permission: "finance.view",
      run: () =>
        rows<Hit>(sql`
          select t.id::text as id, replace(t.type::text, '_', ' ') || ': ' || t.description as title, coalesce(p.email, 'System') || ' · ' || to_char(t.created_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon YYYY HH24:MI') as subtitle, null as status, '/admin/finance/ledger/' || t.id as href
          from ledger_transactions t left join profiles p on p.id = t.user_id
          where t.description ilike ${like} or t.source_id = ${q} or t.idempotency_key = ${q} ${isUuid ? sql`or t.id = ${q}::uuid` : sql``}
          order by t.created_at desc limit ${LIMIT}`),
    },
    {
      key: "games",
      label: "Game content",
      permission: "games.manage",
      run: () =>
        rows<Hit>(sql`
          select * from (
            select id::text, name as title, 'Mystery Box' as subtitle, status::text as status, '/admin/games/boxes/' || id as href from mystery_boxes where name ilike ${like} or slug ilike ${like}
            union all select id::text, name, 'Map', status::text, '/admin/games/maps/' || id from maps where name ilike ${like}
            union all select id::text, name, case when is_special then 'Special Area' else 'Map area' end, status::text, '/admin/games/areas/' || id from map_areas where name ilike ${like}
            union all select id::text, name, 'Vault', status::text, '/admin/games/vaults/' || id from vaults where name ilike ${like}
            union all select id::text, name, 'Reward pool', null, '/admin/economy/pools/' || id from reward_pools where name ilike ${like}
          ) x limit ${LIMIT}`),
    },
    {
      key: "plays",
      label: "Game records",
      permission: "users.view",
      run: () =>
        isUuid
          ? rows<Hit>(sql`
              select * from (
                select p.id::text, 'Mystery Box open' as title, u.email || ' · ' || (p.reward->>'label') as subtitle, null as status, '/admin/users/' || u.id || '?tab=boxes' as href
                from mystery_box_plays p join profiles u on u.id = p.user_id where p.id = ${q}::uuid
                union all select d.id::text, 'Tile discovery', u.email || ' · ' || (d.reward->>'label'), null, '/admin/users/' || u.id || '?tab=map'
                from tile_discoveries d join profiles u on u.id = d.user_id where d.id = ${q}::uuid
                union all select v.id::text, 'Vault unlock', u.email, null, '/admin/users/' || u.id || '?tab=vaults'
                from vault_unlocks v join profiles u on u.id = v.user_id where v.id = ${q}::uuid
              ) x limit ${LIMIT}`)
          : Promise.resolve([]),
    },
    {
      key: "collections",
      label: "Collections and items",
      permission: "collections.manage",
      run: () =>
        rows<Hit>(sql`
          select * from (
            select id::text, icon || ' ' || name as title, 'Collection' as subtitle, status::text as status, '/admin/collections/' || id as href from collections where name ilike ${like}
            union all select id::text, icon || ' ' || name, lower(kind::text) || ' · ' || lower(rarity::text), status::text, '/admin/manage/items/' || id from items where name ilike ${like} or slug ilike ${like}
          ) x limit ${LIMIT}`),
    },
    {
      key: "referrals",
      label: "Referrals",
      permission: "referrals.view",
      run: () =>
        rows<Hit>(sql`
          select p.id, p.name || ' (' || p.referral_code || ')' as title,
            (select count(*) from profiles c where c.referred_by_id = p.id)::text || ' direct referrals' as subtitle, null as status, '/admin/referrals/tree?root=' || p.id as href
          from profiles p where p.referral_code = ${q.toUpperCase()} or (p.email ilike ${like} and exists (select 1 from profiles c where c.referred_by_id = p.id))
          limit ${LIMIT}`),
    },
    {
      key: "tickets",
      label: "Support tickets",
      permission: "support.view",
      run: () =>
        rows<Hit>(sql`
          select t.id::text as id, '#' || t.number || ' ' || t.subject as title, p.email as subtitle, t.status::text as status, '/admin/support/' || t.id as href
          from support_tickets t join profiles p on p.id = t.user_id
          where t.subject ilike ${like} or p.email ilike ${like} ${num !== null ? sql`or t.number = ${num}` : sql``}
          order by t.last_message_at desc limit ${LIMIT}`),
    },
    {
      key: "audit",
      label: "Audit logs",
      permission: "audit.view",
      run: () =>
        rows<Hit>(sql`
          select a.id::text as id, a.action || ' · ' || a.entity_type as title, coalesce(p.name, 'System') || ' · ' || to_char(a.created_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon YYYY HH24:MI') as subtitle, null as status,
            '/admin/audit?entity=' || a.entity_type || coalesce('&entityId=' || a.entity_id, '') as href
          from audit_logs a left join profiles p on p.id = a.actor_id
          where a.entity_id = ${q} or a.action ilike ${like} or a.reason ilike ${like}
          order by a.id desc limit ${LIMIT}`),
    },
  ];

  const groups: Group[] = q.length >= 2 ? await Promise.all(searches.filter((s) => admin.can(s.permission)).map(async (s) => ({ key: s.key, label: s.label, permission: s.permission, hits: await s.run() }))) : [];
  const withHits = groups.filter((g) => g.hits.length);

  return (
    <AdminPage title="Search" description="Searches only the areas your role can access. Try an email, name, reference, ticket number, referral code or record ID.">
      <FilterBar basePath="/admin/search">
        <FilterInput name="q" label="Search" value={q} placeholder="Email, reference, #ticket, ID..." className="w-80" />
      </FilterBar>
      {q.length < 2 ? (
        <EmptyState title="Type at least 2 characters" className="py-10" />
      ) : withHits.length === 0 ? (
        <EmptyState title={`No results for "${q}"`} description="Check the spelling or search by email or ID." className="py-10" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {withHits.map((g) => (
            <AdminCard key={g.key} title={`${g.label} (${g.hits.length}${g.hits.length === LIMIT ? "+" : ""})`}>
              <ul className="divide-y">
                {g.hits.map((h) => (
                  <li key={h.id}>
                    <Link href={h.href} className="flex items-center justify-between gap-3 py-2 hover:bg-muted/40">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{h.title}</p>
                        {h.subtitle && <p className="truncate text-xs text-muted-foreground">{h.subtitle}</p>}
                      </div>
                      {h.status && <StatusBadge status={h.status} />}
                    </Link>
                  </li>
                ))}
              </ul>
            </AdminCard>
          ))}
        </div>
      )}
    </AdminPage>
  );
}