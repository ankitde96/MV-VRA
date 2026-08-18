import { VendorIntakeForm } from "@/components/vendor-intake-form";

export default function NewVendorIntakePage() {
  return (
    <div>
      <h1 className="text-foreground text-lg font-semibold">
        New vendor intake
      </h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Submitting scores the engagement against the Inherent Risk Engine and
        tiers it immediately.
      </p>
      <div className="mt-6">
        <VendorIntakeForm />
      </div>
    </div>
  );
}
