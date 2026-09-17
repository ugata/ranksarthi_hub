import { createFileRoute } from "@tanstack/react-router";
import { DiagnosticChooser } from "@/components/DiagnosticChooser";
import { PageFrame } from "@/components/shell/PageFrame";
import { breadcrumbSchema, collectionPageSchema } from "@/lib/schema";
import { buildHead } from "@/lib/seo";

const title = "Take a Diagnostic | Rank Sarthi";
const description =
  "Choose JEE, NEET or NDA to continue to that exam's dedicated Rank Sarthi diagnostic.";

export const Route = createFileRoute("/diagnostic")({
  head: () =>
    buildHead({
      url: "/diagnostic",
      title,
      description,
      ogType: "website",
      // No itemList: the cards here link to external sub-portal domains, not
      // internal registry paths, so there is nothing absolute() can resolve.
      jsonLd: [
        collectionPageSchema({ url: "/diagnostic", name: "Take a Diagnostic", description }),
        breadcrumbSchema("/diagnostic"),
      ],
    }),
  component: DiagnosticPage,
});

function DiagnosticPage() {
  return (
    <PageFrame frame="F1" url="/diagnostic">
      <DiagnosticChooser />
    </PageFrame>
  );
}
