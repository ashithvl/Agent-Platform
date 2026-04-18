import type { ReactNode } from "react";

import { EmptyState, type EmptyStateVisual } from "./EmptyState";

type EmptyTablePlaceholderProps = {
  colSpan: number;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  visual?: EmptyStateVisual;
};

/** Single row that spans all columns — keeps thead + card styling consistent. */
export function EmptyTablePlaceholder({ colSpan, title, description, action, visual }: EmptyTablePlaceholderProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="align-top">
        <div className="px-4 py-12 sm:px-6">
          <EmptyState title={title} description={description} action={action} visual={visual} compact />
        </div>
      </td>
    </tr>
  );
}
