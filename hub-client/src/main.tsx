// FAB Intel's screens: the Hub's, plus the client's own pages by the ids in pack/extensions.toml.
import { mountHub } from "../.hub/crates/hub-app/src/hub";
import QuoteCheck from "./QuoteCheck";

mountHub({ pages: { "ext.pricing.quote_check": QuoteCheck } });
