import { render, fireEvent, waitFor, screen } from "@testing-library/react";
import App from "./App";
import "@testing-library/jest-dom";

describe("loads and displays greeting", async () => {
  render(<App />);

  fireEvent.click(screen.getByRole("button"));

  await waitFor(() => screen.getByRole("button"));

  expect(screen.getByRole("button")).toHaveTextContent("1");
});
