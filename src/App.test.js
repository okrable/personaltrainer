import { render, screen } from "@testing-library/react";
import PlanApp from "./App";

test("renders planner headline", () => {
  render(<PlanApp />);
  const headline = screen.getByText(/Personal Trainer Planner/i);
  expect(headline).toBeInTheDocument();
});
