import { TicketStatus, STATUS_LABEL } from "../types";

const COLORS: Record<TicketStatus, string> = {
  pending: "bg-gray-100 text-gray-600",
  assigned: "bg-blue-100 text-blue-700",
  pending_review: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span
      className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${COLORS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
