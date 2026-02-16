"use client";

import { useParams } from "next/navigation";
import PaymentView from "@/views/PaymentView";

export default function PayPage() {
  const params = useParams();
  const linkId = params.linkId as string;
  return <PaymentView linkId={linkId} />;
}
