import { PageHeader } from "@components/PageHeader";
import { Card } from "@components/Card";
import { EmptyState } from "@components/EmptyState";
import type { NavItem } from "@config/navigation";

/**
 * Generic Phase-0 placeholder used by every module page that has no
 * functional UI yet. Phase 1+ replaces the <Card><EmptyState .../></Card>
 * body with real content while keeping the same <PageHeader>, so the
 * page shell never has to be rebuilt.
 */
export function PlaceholderPage({ item }: { item: NavItem }) {
  return (
    <>
      <PageHeader
        title={item.label}
        description={item.description}
        phaseBadge={`Phase ${item.availableFromPhase}`}
      />
      <Card>
        <EmptyState
          icon={item.icon}
          title={`${item.label} - coming in Phase ${item.availableFromPhase}`}
          message="This module's screens and workflows will be implemented in a later phase, building on the Phase 0 foundation (data model, navigation, design system) already in place."
          availableFromPhase={item.availableFromPhase}
        />
      </Card>
    </>
  );
}
