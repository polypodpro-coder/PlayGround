import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Calculator, File as FileIcon, Hash, Image as ImageIcon } from "lucide-react";
import ScreenHeader from "../../components/ScreenHeader";
import { jobs } from "../../data/mockData";
import { useApp } from "../../context/AppContext";

export default function JobDetail() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { myShop } = useApp();
  const job = jobs.find((j) => j.id === jobId) ?? jobs[0];

  // A rough per-material auto-price from the owner's own $/g rate and the
  // job's bounding-box volume — a starting point, not a final number.
  const suggested = useMemo(() => {
    const rate = myShop.pricingRates?.[job.material];
    if (!rate) return null;
    const volumeCm3 = (job.dimensions.x * job.dimensions.y * job.dimensions.z) / 1000;
    const grams = Math.round(volumeCm3 * 0.25 * job.quantity);
    return { grams, price: Math.max(4, grams * rate) };
  }, [myShop.pricingRates, job]);

  const [price, setPrice] = useState(suggested ? suggested.price.toFixed(2) : "");
  const [turnaround, setTurnaround] = useState("");
  const [sent, setSent] = useState(false);

  const isModel = job.fileType === "stl";

  const sendQuote = (e) => {
    e.preventDefault();
    setSent(true);
    setTimeout(() => navigate("/owner/requests"), 900);
  };

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Job request" subtitle={job.buyerName} />

      <div className="flex-1 space-y-5 px-4 py-5">
        <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-navy/5 text-navy/50">
            {isModel ? <FileIcon size={22} /> : <ImageIcon size={22} />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-navy">{job.fileName}</p>
            <p className="text-xs text-navy/50">
              {isModel ? "3D model file" : "Reference photo"}
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-3 text-sm font-semibold text-navy">Part specs</h2>
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-navy/40">Material</dt>
              <dd className="font-medium text-navy">{job.material}</dd>
            </div>
            <div>
              <dt className="text-xs text-navy/40">Color</dt>
              <dd className="font-medium text-navy">{job.color}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1 text-xs text-navy/40">
                <Box size={12} /> Dimensions
              </dt>
              <dd className="font-medium text-navy">
                {job.dimensions.x}×{job.dimensions.y}×{job.dimensions.z}mm
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1 text-xs text-navy/40">
                <Hash size={12} /> Quantity
              </dt>
              <dd className="font-medium text-navy">{job.quantity}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-2 text-sm font-semibold text-navy">Customer notes</h2>
          <p className="text-sm text-navy/70">{job.buyerNotes}</p>
        </div>

        <form onSubmit={sendQuote} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-3 text-sm font-semibold text-navy">Your quote</h2>

          {suggested && (
            <div className="mb-3 flex items-center gap-2.5 rounded-xl bg-navy/5 px-3.5 py-2.5">
              <Calculator size={15} className="shrink-0 text-accent" />
              <p className="text-xs text-navy/60">
                Suggested from your {job.material} rate: ~{suggested.grams}g ·{" "}
                <button
                  type="button"
                  onClick={() => setPrice(suggested.price.toFixed(2))}
                  className="font-semibold text-accent underline underline-offset-2"
                >
                  use ${suggested.price.toFixed(2)}
                </button>
              </p>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-navy/50">
                Price ($)
              </label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="18.50"
                className="w-full rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm text-navy outline-none ring-1 ring-black/5 focus:ring-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-navy/50">
                Turnaround estimate (hours)
              </label>
              <input
                required
                type="number"
                min="1"
                value={turnaround}
                onChange={(e) => setTurnaround(e.target.value)}
                placeholder="6"
                className="w-full rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm text-navy outline-none ring-1 ring-black/5 focus:ring-accent"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2.5">
            <button
              type="button"
              onClick={() => navigate("/owner/requests")}
              className="flex-1 rounded-2xl border border-navy/15 py-3 text-sm font-semibold text-navy/70 active:scale-[0.98]"
            >
              Decline
            </button>
            <button
              type="submit"
              className="flex-1 rounded-2xl bg-accent py-3 text-sm font-semibold text-white shadow-lg shadow-accent/30 active:scale-[0.98]"
            >
              {sent ? "Quote sent!" : "Send quote"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
