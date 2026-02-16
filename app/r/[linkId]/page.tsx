import { redirect } from "next/navigation";

export default function RedirectPage({ params }: { params: { linkId: string } }) {
  redirect(`/pay/${params.linkId}`);
}
