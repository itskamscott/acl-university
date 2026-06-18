"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { BRAND_CATEGORIES } from "@/lib/types";
import { describeFollowup } from "@/lib/utils";
import { useToast } from "@/components/toast-provider";
import { celebrateWin } from "@/components/win-celebration";
import type { Brand, BrandCategory, BrandStatus } from "@/lib/types";
import Link from "next/link";
import { Plus } from "lucide-react";

interface Props {
  brands: Brand[];
  statuses: { value: BrandStatus; label: string }[];
  athleteId: string;
  lastActivityByBrand: Record<string, string>;
}

const ARCHIVED_STATUSES: BrandStatus[] = ["deal_closed", "not_a_fit"];
const STALL_AFTER_DAYS = 14;
const STALL_STATUSES: BrandStatus[] = ["contacted", "in_conversation", "negotiating"];

function isStalled(
  brand: Brand,
  lastActivityByBrand: Record<string, string>,
): boolean {
  if (!STALL_STATUSES.includes(brand.status)) return false;
  const lastTouch = lastActivityByBrand[brand.id] ?? brand.created_at;
  const diffDays = (Date.now() - new Date(lastTouch).getTime()) / 86_400_000;
  return diffDays >= STALL_AFTER_DAYS;
}

const STATUS_COLORS: Record<BrandStatus, string> = {
  prospect: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700",
  contacted: "bg-blue-50 text-blue-700",
  in_conversation: "bg-amber-50 text-amber-700",
  negotiating: "bg-purple-50 text-purple-700",
  deal_closed: "bg-green-50 text-green-700",
  not_a_fit: "bg-red-50 text-red-700",
};

export function PipelineClient({ brands: initialBrands, statuses, athleteId, lastActivityByBrand }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [brands, setBrands] = useState(initialBrands);
  const [categoryFilter, setCategoryFilter] = useState<BrandCategory | "">(
    (searchParams.get("category") as BrandCategory) || "",
  );
  const [locationFilter, setLocationFilter] = useState(searchParams.get("loc") ?? "");
  const [showArchived, setShowArchived] = useState(searchParams.get("archived") === "1");
  const supabase = createClient();
  const { notify } = useToast();

  useEffect(() => {
    const params = new URLSearchParams();
    if (categoryFilter) params.set("category", categoryFilter);
    const trimmedLoc = locationFilter.trim();
    if (trimmedLoc) params.set("loc", trimmedLoc);
    if (showArchived) params.set("archived", "1");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [categoryFilter, locationFilter, showArchived, pathname, router]);

  const filteredBrands = useMemo(() => {
    const loc = locationFilter.trim().toLowerCase();
    return brands.filter((b) => {
      if (categoryFilter && b.category !== categoryFilter) return false;
      if (loc) {
        const hay = `${b.city ?? ""} ${b.state ?? ""}`.toLowerCase();
        if (!hay.includes(loc)) return false;
      }
      return true;
    });
  }, [brands, categoryFilter, locationFilter]);

  const visibleStatuses = showArchived
    ? statuses
    : statuses.filter((s) => !ARCHIVED_STATUSES.includes(s.value));

  function getBrandsByStatus(status: BrandStatus) {
    return filteredBrands.filter((b) => b.status === status);
  }

  const filtersActive = categoryFilter !== "" || locationFilter.trim() !== "" || showArchived;
  const today = new Date().toISOString().split("T")[0];

  function followupPillClass(tone: "overdue" | "today" | "future") {
    if (tone === "overdue") return "bg-red-50 text-red-600";
    if (tone === "today") return "bg-acl-orange/10 text-acl-orange";
    return "bg-zinc-50 dark:bg-zinc-900 text-zinc-500";
  }

  function clearFilters() {
    setCategoryFilter("");
    setLocationFilter("");
    setShowArchived(false);
  }

  async function handleDragEnd(result: DropResult) {
    const { draggableId, destination } = result;
    if (!destination) return;

    const newStatus = destination.droppableId as BrandStatus;
    const brand = brands.find((b) => b.id === draggableId);
    if (!brand || brand.status === newStatus) return;

    const oldStatus = brand.status;

    // Optimistic update
    setBrands((prev) =>
      prev.map((b) => (b.id === draggableId ? { ...b, status: newStatus } : b))
    );

    // Persist
    const { error: updateError } = await supabase
      .from("brands")
      .update({ status: newStatus })
      .eq("id", draggableId);

    if (updateError) {
      // Revert on failure
      setBrands((prev) =>
        prev.map((b) => (b.id === draggableId ? { ...b, status: oldStatus } : b))
      );
      notify("Couldn't update status. Try again.", "error");
      return;
    }

    // Log status change
    const oldLabel = statuses.find((s) => s.value === oldStatus)?.label || oldStatus;
    const newLabel = statuses.find((s) => s.value === newStatus)?.label || newStatus;

    await supabase.from("brand_activities").insert({
      brand_id: draggableId,
      athlete_id: athleteId,
      activity_type: "status_change",
      content: `Status changed from ${oldLabel} to ${newLabel}`,
    });

    if (newStatus === "deal_closed" && oldStatus !== "deal_closed") {
      celebrateWin({ kind: "deal_closed", subject: brand.business_name });
    }
  }

  async function handleMobileStatusChange(brandId: string, newStatus: BrandStatus) {
    const brand = brands.find((b) => b.id === brandId);
    if (!brand || brand.status === newStatus) return;

    const oldStatus = brand.status;

    setBrands((prev) =>
      prev.map((b) => (b.id === brandId ? { ...b, status: newStatus } : b))
    );

    const { error: updateError } = await supabase
      .from("brands")
      .update({ status: newStatus })
      .eq("id", brandId);

    if (updateError) {
      setBrands((prev) =>
        prev.map((b) => (b.id === brandId ? { ...b, status: oldStatus } : b))
      );
      notify("Couldn't update status. Try again.", "error");
      return;
    }

    const oldLabel = statuses.find((s) => s.value === oldStatus)?.label || oldStatus;
    const newLabel = statuses.find((s) => s.value === newStatus)?.label || newStatus;

    if (newStatus === "deal_closed" && oldStatus !== "deal_closed") {
      celebrateWin({ kind: "deal_closed", subject: brand.business_name });
    }

    await supabase.from("brand_activities").insert({
      brand_id: brandId,
      athlete_id: athleteId,
      activity_type: "status_change",
      content: `Status changed from ${oldLabel} to ${newLabel}`,
    });
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-acl-black dark:text-zinc-100">Pipeline</h1>
          <Link
            href="/brands"
            className="text-sm text-zinc-500 hover:text-acl-black dark:hover:text-zinc-100"
          >
            List view
          </Link>
        </div>
        <Link
          href="/brands/new"
          className="flex items-center gap-1.5 rounded-lg bg-acl-orange px-3 py-2 text-sm font-medium text-white hover:bg-acl-orange/90"
        >
          <Plus className="h-4 w-4" />
          Add Brand
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as BrandCategory | "")}
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue sm:w-44"
        >
          <option value="">All categories</option>
          {BRAND_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <input
          type="text"
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          placeholder="City or state"
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 focus:border-acl-blue focus:outline-none focus:ring-1 focus:ring-acl-blue sm:w-44"
        />
        <label className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300 sm:ml-1">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 accent-acl-orange"
          />
          Show closed & rejected
        </label>
        {filtersActive && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm text-acl-blue hover:underline sm:ml-auto"
          >
            Clear
          </button>
        )}
      </div>

      {brands.length === 0 && (
        <div className="hidden md:block rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
          <p className="text-sm text-zinc-500">No brands yet.</p>
          <Link
            href="/brands/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-acl-orange px-3 py-2 text-sm font-medium text-white hover:bg-acl-orange/90"
          >
            <Plus className="h-4 w-4" />
            Add your first brand
          </Link>
        </div>
      )}

      {/* Desktop: Kanban */}
      <div className={brands.length === 0 ? "hidden" : "hidden md:block"}>
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {visibleStatuses.map((status) => {
              const columnBrands = getBrandsByStatus(status.value);
              return (
                <Droppable key={status.value} droppableId={status.value}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`w-56 shrink-0 rounded-lg p-2 ${
                        snapshot.isDraggingOver ? "bg-acl-orange/5" : "bg-zinc-100/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                          {status.label}
                        </span>
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">{columnBrands.length}</span>
                      </div>
                      <div className="space-y-2 min-h-[60px]">
                        {columnBrands.map((brand, index) => {
                          const followup = describeFollowup(brand.next_followup_date, today);
                          const stalled = isStalled(brand, lastActivityByBrand);
                          return (
                          <Draggable key={brand.id} draggableId={brand.id} index={index}>
                            {(provided, snapshot) => (
                              <Link
                                href={`/brands/${brand.id}`}
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`block rounded-lg border bg-white dark:bg-zinc-900 p-3 text-sm transition-shadow ${
                                  snapshot.isDragging
                                    ? "shadow-lg border-acl-orange"
                                    : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                                }`}
                              >
                                <p className="font-medium text-acl-black dark:text-zinc-100 truncate">
                                  {brand.business_name}
                                </p>
                                <p className="text-xs text-zinc-400 mt-0.5 truncate">
                                  {[brand.city, brand.state].filter(Boolean).join(", ") || brand.category}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {followup && (
                                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${followupPillClass(followup.tone)}`}>
                                      {followup.tone === "future" ? `Follow up ${followup.label}` : followup.label}
                                    </span>
                                  )}
                                  {stalled && (
                                    <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                      Stalled
                                    </span>
                                  )}
                                </div>
                              </Link>
                            )}
                          </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {/* Mobile: Grouped scroll */}
      <div className="md:hidden space-y-6">
        {visibleStatuses.map((status) => {
          const columnBrands = getBrandsByStatus(status.value);
          if (columnBrands.length === 0) return null;
          return (
            <div key={status.value}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status.value]}`}>
                  {status.label}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">{columnBrands.length}</span>
              </div>
              <div className="space-y-2">
                {columnBrands.map((brand) => {
                  const followup = describeFollowup(brand.next_followup_date, today);
                  const stalled = isStalled(brand, lastActivityByBrand);
                  return (
                  <div
                    key={brand.id}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-3"
                  >
                    <Link href={`/brands/${brand.id}`} className="block">
                      <p className="text-sm font-medium text-acl-black dark:text-zinc-100">
                        {brand.business_name}
                      </p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {[brand.city, brand.state].filter(Boolean).join(", ") || brand.category}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {followup && (
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${followupPillClass(followup.tone)}`}>
                            {followup.tone === "future" ? `Follow up ${followup.label}` : followup.label}
                          </span>
                        )}
                        {stalled && (
                          <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            Stalled
                          </span>
                        )}
                      </div>
                    </Link>
                    <select
                      value={brand.status}
                      onChange={(e) => handleMobileStatusChange(brand.id, e.target.value as BrandStatus)}
                      className="mt-2 w-full rounded border border-zinc-200 dark:border-zinc-800 px-2 py-1 text-xs text-zinc-600"
                    >
                      {statuses.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {brands.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
            <p className="text-sm text-zinc-500">No brands yet.</p>
            <Link
              href="/brands/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-acl-orange px-3 py-2 text-sm font-medium text-white hover:bg-acl-orange/90"
            >
              <Plus className="h-4 w-4" />
              Add Brand
            </Link>
          </div>
        ) : visibleStatuses.every((s) => getBrandsByStatus(s.value).length === 0) && (
          <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
            <p className="text-sm text-zinc-500">No brands match your filters.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 text-sm text-acl-blue hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
