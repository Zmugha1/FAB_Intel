// Quote check. The owner's rules on one quote before it goes to her: gross profit margin against
// the 25% floor and the 35% approval line, inventory, artwork, shipping and setup fees, any
// discount, and sales tax by where the order ships. The suggestion comes first, then the reasoning.
import { useEffect, useState } from "react";
import { extCall } from "../.hub/crates/hub-app/src/hub";

type Line = { label: string; kind: string; qty: string; unitCost: string; unitPrice: string; taxable: boolean };
type Destination = { id: string; label: string; rate: number };
type Result = {
  subtotal: number;
  discount: number;
  taxable: number;
  taxRate: number;
  tax: number;
  total: number;
  cost: number;
  grossProfit: number;
  grossMargin: number | null;
  suggestion: "hold" | "approval";
  reasoning: string[];
  alerts: string[];
  followUpInvoice: boolean;
};

const KINDS = ["product", "setup", "shipping", "artwork", "other"];
const blank = (): Line => ({ label: "", kind: "product", qty: "1", unitCost: "0", unitPrice: "0", taxable: true });
const money = (value: number) => `$${value.toFixed(2)}`;
const input = "rounded border border-slate/40 px-2 py-1";

export default function QuoteCheck() {
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [destination, setDestination] = useState("");
  const [discount, setDiscount] = useState("0");
  const [inventory, setInventory] = useState(false);
  const [artwork, setArtwork] = useState(false);
  const [shipping, setShipping] = useState("");
  const [setup, setSetup] = useState("");
  const [exception, setException] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    extCall<Destination[]>("ext.pricing.destinations").then(setDestinations).catch((reason) => setError(String(reason)));
  }, []);

  const change = (index: number, patch: Partial<Line>) => setLines(lines.map((line, at) => (at === index ? { ...line, ...patch } : line)));

  async function run() {
    setError("");
    setResult(null);
    try {
      const checked = await extCall<Result>("ext.pricing.check", {
        lines: lines.map((line) => ({ ...line, qty: Number(line.qty), unitCost: Number(line.unitCost), unitPrice: Number(line.unitPrice) })),
        discount: Number(discount),
        destination,
        inventoryConfirmed: inventory,
        artworkAttached: artwork,
        shipping,
        setup,
        exceptionAuthorized: exception,
      });
      setResult(checked);
    } catch (reason) {
      setError(String(reason));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-navy">Quote check</h1>
      <p className="text-sm text-slate">The owner's rules on one quote before it goes to her. Gross profit margin, not markup.</p>

      <table className="w-full rounded-lg border border-slate/40 bg-white text-sm">
        <thead>
          <tr className="text-left text-slate">
            <th className="p-2">Item</th>
            <th className="p-2" title="Setup, shipping and artwork fees are lines too, so their cost counts in the margin.">Kind</th>
            <th className="p-2">Qty</th>
            <th className="p-2" title="What the vendor or decorator charges you for one.">Unit cost</th>
            <th className="p-2">Unit price</th>
            <th className="p-2" title="Merchandise is taxed. Untick a line that is not.">Taxed</th>
            <th className="p-2" />
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={index}>
              <td className="p-2"><input aria-label="Item" className={`${input} w-full`} value={line.label} onChange={(event) => change(index, { label: event.target.value })} /></td>
              <td className="p-2">
                <select aria-label="Kind" className={input} value={line.kind} onChange={(event) => change(index, { kind: event.target.value })}>
                  {KINDS.map((kind) => <option key={kind}>{kind}</option>)}
                </select>
              </td>
              <td className="p-2"><input aria-label="Qty" className={`${input} w-20`} inputMode="decimal" value={line.qty} onChange={(event) => change(index, { qty: event.target.value })} /></td>
              <td className="p-2"><input aria-label="Unit cost" className={`${input} w-24`} inputMode="decimal" value={line.unitCost} onChange={(event) => change(index, { unitCost: event.target.value })} /></td>
              <td className="p-2"><input aria-label="Unit price" className={`${input} w-24`} inputMode="decimal" value={line.unitPrice} onChange={(event) => change(index, { unitPrice: event.target.value })} /></td>
              <td className="p-2"><input aria-label="Taxed" type="checkbox" checked={line.taxable} onChange={(event) => change(index, { taxable: event.target.checked })} /></td>
              <td className="p-2">{lines.length > 1 && <button className="text-slate underline" onClick={() => setLines(lines.filter((_, at) => at !== index))}>Remove</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="rounded border border-navy px-3 py-1 text-navy" onClick={() => setLines([...lines, blank()])}>Add a line</button>

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate/40 bg-white p-4 text-sm md:grid-cols-2">
        <label className="flex flex-col gap-1" title="Sales tax follows where the order ships, not the billing address.">
          Ships to
          <select className={input} value={destination} onChange={(event) => setDestination(event.target.value)}>
            <option value="">Pick one</option>
            {destinations.map((item) => <option key={item.id} value={item.id}>{item.label} ({(item.rate * 100).toFixed(1)}%)</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1" title="Any discount needs the owner's approval, and it is flagged.">
          Discount, dollars
          <input className={input} inputMode="decimal" value={discount} onChange={(event) => setDiscount(event.target.value)} />
        </label>
        <label className="flex flex-col gap-1" title="Missing shipping is an alert. Bill after delivery makes a follow-up invoice.">
          Shipping
          <select className={input} value={shipping} onChange={(event) => setShipping(event.target.value)}>
            <option value="">Not entered</option>
            <option value="line">On a line above</option>
            <option value="zero">Zero</option>
            <option value="bill after delivery">Bill after delivery</option>
          </select>
        </label>
        <label className="flex flex-col gap-1" title="Missing setup fee is an alert. Enter zero when there is none.">
          Setup fee
          <select className={input} value={setup} onChange={(event) => setSetup(event.target.value)}>
            <option value="">Not entered</option>
            <option value="line">On a line above</option>
            <option value="zero">Zero</option>
          </select>
        </label>
        <label className="flex items-center gap-2" title="No inventory holds the quote. Check it again at the moment of ordering.">
          <input type="checkbox" checked={inventory} onChange={(event) => setInventory(event.target.checked)} /> Inventory confirmed
        </label>
        <label className="flex items-center gap-2" title="Vector art is needed for print and embroidery.">
          <input type="checkbox" checked={artwork} onChange={(event) => setArtwork(event.target.checked)} /> Artwork attached
        </label>
        <label className="flex items-center gap-2" title="Only when the owner said yes to this margin before the quote was built.">
          <input type="checkbox" checked={exception} onChange={(event) => setException(event.target.checked)} /> Owner authorized a margin under 25% in advance
        </label>
      </div>

      <button className="rounded bg-navy px-4 py-2 text-white" onClick={run}>Check quote</button>
      {error && <p className="rounded border border-coral bg-white p-3 text-coral">{error}</p>}

      {result && (
        <section className="space-y-3 rounded-lg border border-slate/40 bg-white p-4">
          {result.suggestion === "hold" ? (
            <p className="rounded border border-coral p-3 font-semibold text-coral">Held. A person decides before this quote goes anywhere.</p>
          ) : (
            <p className="rounded border border-navy p-3 font-semibold text-navy">Goes to the owner for approval.</p>
          )}
          <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            <dt className="text-slate">Price</dt><dd>{money(result.subtotal - result.discount)}</dd>
            <dt className="text-slate">Cost</dt><dd>{money(result.cost)}</dd>
            <dt className="text-slate">Gross profit</dt><dd>{money(result.grossProfit)}</dd>
            <dt className="text-slate">Gross profit margin</dt><dd>{result.grossMargin === null ? "None" : `${(result.grossMargin * 100).toFixed(1)}%`}</dd>
            <dt className="text-slate">Tax</dt><dd>{money(result.tax)}</dd>
            <dt className="text-slate">Total</dt><dd className="font-semibold">{money(result.total)}</dd>
          </dl>
          <div>
            <h2 className="font-semibold text-navy">Reasoning</h2>
            <ul className="list-disc pl-5 text-sm">{result.reasoning.map((line) => <li key={line}>{line}</li>)}</ul>
          </div>
          {result.alerts.length > 0 && (
            <div>
              <h2 className="font-semibold text-coral">Alerts</h2>
              <ul className="list-disc pl-5 text-sm text-coral">{result.alerts.map((line) => <li key={line}>{line}</li>)}</ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
