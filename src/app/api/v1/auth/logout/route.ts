import { attachClearSessionCookie } from "@/lib/auth";
import { jsonOk } from "@/lib/api-utils";

export async function POST() {
  const response = jsonOk({ loggedOut: true });
  attachClearSessionCookie(response);
  return response;
}
