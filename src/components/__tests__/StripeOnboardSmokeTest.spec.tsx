import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import StripeOnboardSmokeTest from "@/components/StripeOnboardSmokeTest";
import React from "react";

describe("StripeOnboardSmokeTest", () => {
  it("renders the run test button", () => {
    const { getByText, getByRole } = render(<StripeOnboardSmokeTest />);
    expect(getByText(/Stripe Onboard Smoke Test/i)).toBeTruthy();
    expect(getByRole('button', { name: /Run Test/i })).toBeTruthy();
  });
});
