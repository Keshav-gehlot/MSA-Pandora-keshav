import { getStorage } from "../../../lib/cf-storage";
import { requireStaff } from "../../../lib/session";

type Props = { params: Promise<{ path: string[] }> };

// Only paths the registration form writes: teams/<team id>/photos/<n>.<ext> and teams/<team id>/payment/<id>.<ext>.
const FILE_PATH = /^teams\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(photos|payment)\/[A-Za-z0-9-]+\.[a-z]+$/;

// Serves uploaded photos and payment proofs from storage, behind staff sign-in. The bucket itself is private, so
// this route is the only way to see a file. Payment proofs are admin-only; photos are also needed by check-in staff.
export async function GET(_request: Request, { params }: Props) {
  const path = (await params).path.join("/");
  const match = FILE_PATH.exec(path);
  if (!match) return new Response("Not found", { status: 404 });

  await requireStaff(match[1] === "payment" ? "admin" : undefined);

  const file = await (await getStorage()).getFile(path);
  if (!file) return new Response("Not found", { status: 404 });

  return new Response(file.body, {
    headers: {
      "Content-Type": file.contentType,
      // Private data: never cached by a shared cache, and never sniffed into a different type.
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
