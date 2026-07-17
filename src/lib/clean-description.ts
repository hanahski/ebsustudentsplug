// Strips hidden spec markers (HOSTEL::base64, PRODUCT::base64) from a listing
// description before showing it to readers. Prevents the encoded blob from
// leaking into feed cards and post titles.
import { stripHostelMarker } from "./hostel-specs";
import { stripProductMarker } from "./product-specs";

export function cleanListingDescription(desc?: string | null): string {
  return stripProductMarker(stripHostelMarker(desc ?? "")).trim();
}
