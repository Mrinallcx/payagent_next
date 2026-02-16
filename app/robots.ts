import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/about", "/changelog", "/docs"],
        disallow: [
          "/dashboard",
          "/payment-links",
          "/transactions",
          "/rewards",
          "/wallets",
          "/agents",
          "/logs",
          "/pay/",
          "/r/",
        ],
      },
    ],
    sitemap: "https://www.payagent.co/sitemap.xml",
  };
}
