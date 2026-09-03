import { useNavigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import ScreenHeader from "../../components/ScreenHeader";
import { jobs } from "../../data/mockData";

export default function Requests() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Job requests" onBack={() => navigate("/owner")} />

      <div className="flex-1 space-y-2.5 px-4 py-5">
        {jobs.map((job) => (
          <button
            type="button"
            key={job.id}
            onClick={() => navigate(`/owner/requests/${job.id}`)}
            className="flex w-full items-center justify-between rounded-2xl bg-surface p-4 text-left shadow-sm ring-1 ring-black/5 active:scale-[0.98]"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-navy">{job.buyerName}</p>
              <p className="truncate text-xs text-navy/50">
                {job.material} · Qty {job.quantity} · {job.fileName}
              </p>
              <p className="mt-1 text-[11px] text-navy/40">
                Needed by {new Date(job.neededBy).toLocaleDateString()}
              </p>
            </div>
            <span className="ml-3 flex shrink-0 items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white">
              Quote <ArrowUpRight size={13} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
