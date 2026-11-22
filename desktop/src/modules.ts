/** The modules in Mary Jane's signed agreement (Schedule A). Phase 2 shows greyed out until it is delivered. */
export type Module = { key: string; num: string; label: string; phase: 1 | 2; owner?: boolean; what: string };

export const MODULES: Module[] = [
  { key: "brief", num: "1.6", label: "Morning Brief", phase: 1, what: "Daily list of quotes, approvals, unpaid invoices and jobs due." },
  { key: "contacts", num: "1.2", label: "Contacts", phase: 1, what: "One clean contact list across all three businesses." },
  { key: "quotes", num: "1.3", label: "Quotes", phase: 1, what: "Live margin, tax rules and the approval gate. Lauren drafts, Mary Jane approves." },
  { key: "invoices", num: "1.4", label: "Invoices", phase: 1, what: "An accepted quote becomes the invoice." },
  { key: "projects", num: "1.5", label: "Projects and artwork", phase: 1, what: "Proofs and revisions. Art is linked, not copied." },
  { key: "roi", num: "1.7", label: "ROI", phase: 1, owner: true, what: "Measured against your starting numbers." },
  { key: "rules", num: "1.1", label: "Rules and users", phase: 1, what: "Sign-in, roles, approvals and the decision log." },
  { key: "pos", num: "2.1", label: "POs and vendors", phase: 2, what: "An accepted quote becomes a draft vendor PO. A person sends it." },
  { key: "campaigns", num: "2.2", label: "Campaigns", phase: 2, what: "Segments from clean contacts, drafts in your voice, unsubscribes honored." },
  { key: "loyalty", num: "2.3", label: "Loyalty QR", phase: 2, what: "Bar QR sign-ups, bartender confirms purchases, contacts tagged by bar." },
  { key: "leads", num: "2.4", label: "Lead Watch", phase: 2, what: "Nightly scan of agreed public sources. Every lead cites its source." },
  { key: "listings", num: "2.5", label: "WiscoMary Listings", phase: 2, what: "Venue listings with calendar feeds." },
  { key: "pricing", num: "2.6", label: "Pricing Intel", phase: 2, owner: true, what: "Past quotes, wins and losses shown as a price range. You set the price." },
  { key: "assistant", num: "2.7", label: "FAB Intel Assistant", phase: 2, what: "Answers from your own data, with sources shown." },
  { key: "content", num: "2.8", label: "Content Studio", phase: 2, what: "Posts, newsletters and flyers in your voice. A person approves before anything is posted." },
];

/** Her systems, from the STZ interview and the Nov 20 call. All connections are Planned until each one is built and tested. */
export const SYSTEMS: { name: string; use: string; phase: string }[] = [
  { name: "17hats", use: "Quotes, invoices and accounting today. Export to move contacts and history.", phase: "Phase 1, import" },
  { name: "Google Contacts", use: "Contact list since GoHighLevel was canceled.", phase: "Phase 1, import" },
  { name: "Stripe (2 accounts)", use: "Card payments. Status read back to invoices.", phase: "Phase 1" },
  { name: "Square (2 accounts)", use: "Payments. Status read back to invoices.", phase: "Phase 1" },
  { name: "GoDaddy Professional Email (Titan)", use: "Business email for WurkHub, F&B Merch and WiscoMary.", phase: "Phase 1, sending drafts by a person" },
  { name: "ESP (ASI)", use: "Product search and preferred vendors. Stays in place.", phase: "Phase 2, vendors" },
  { name: "MembershipWorks", use: "WiscoMary venue listings.", phase: "Phase 2, Listings" },
  { name: "Zelle", use: "Payments received by bank transfer. Marked paid by a person.", phase: "Phase 1, manual" },
];
