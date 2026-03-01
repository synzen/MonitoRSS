import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SetupChecklist } from "./index";
import { SetupChecklistCard } from "./SetupChecklistCard";

vi.mock("../../../feedConnections/components/AddConnectionDialog", () => ({
  AddConnectionDialog: () => null,
}));

const renderWithChakra = (ui: React.ReactElement) => {
  const user = userEvent.setup();
  const result = render(<ChakraProvider>{ui}</ChakraProvider>);

  return { user, ...result };
};

describe("SetupChecklistCard", () => {
  const baseFeed = {
    id: "feed-1",
    title: "Gaming News",
    url: "https://example.com/gaming",
    connectionCount: 0,
  };

  it("renders feed title and domain", () => {
    renderWithChakra(<SetupChecklistCard feed={baseFeed} onAddConnection={vi.fn()} />);

    expect(screen.getByText("Gaming News")).toBeInTheDocument();
    expect(screen.getByText("example.com")).toBeInTheDocument();
  });

  it("shows 'No connection — not delivering' when connectionCount is 0", () => {
    renderWithChakra(
      <SetupChecklistCard feed={{ ...baseFeed, connectionCount: 0 }} onAddConnection={vi.fn()} />,
    );

    expect(screen.getAllByText("No connection \u2014 not delivering").length).toBeGreaterThan(0);
  });

  it("shows '1 connection configured' when connectionCount is 1", () => {
    renderWithChakra(
      <SetupChecklistCard feed={{ ...baseFeed, connectionCount: 1 }} onAddConnection={vi.fn()} />,
    );

    expect(screen.getAllByText("1 connection configured").length).toBeGreaterThan(0);
  });

  it("shows '2 connections configured' when connectionCount is 2", () => {
    renderWithChakra(
      <SetupChecklistCard feed={{ ...baseFeed, connectionCount: 2 }} onAddConnection={vi.fn()} />,
    );

    expect(screen.getAllByText("2 connections configured").length).toBeGreaterThan(0);
  });

  it("calls onAddConnection with feed ID when button is clicked", async () => {
    const onAddConnection = vi.fn();
    const { user } = renderWithChakra(
      <SetupChecklistCard
        feed={{ ...baseFeed, connectionCount: 0 }}
        onAddConnection={onAddConnection}
      />,
    );

    const buttons = screen.getAllByRole("button", { name: /Add connection to Gaming News/ });
    await user.click(buttons[0]);

    expect(onAddConnection).toHaveBeenCalledWith("feed-1");
  });
});

describe("SetupChecklist", () => {
  const defaultFeeds = [
    { id: "f1", title: "Feed One", url: "https://one.com/rss", connectionCount: 0 },
    { id: "f2", title: "Feed Two", url: "https://two.com/rss", connectionCount: 1 },
    { id: "f3", title: "Feed Three", url: "https://three.com/rss", connectionCount: 0 },
  ];

  const defaultProps = {
    feeds: defaultFeeds,
    onConnectionCreated: vi.fn(),
    onDismiss: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders title with feed count", () => {
    renderWithChakra(<SetupChecklist {...defaultProps} />);

    expect(screen.getByText("3 feeds need delivery connections")).toBeInTheDocument();
  });

  it("renders description text", () => {
    renderWithChakra(<SetupChecklist {...defaultProps} />);

    expect(
      screen.getByText("Choose where each feed's articles are delivered."),
    ).toBeInTheDocument();
  });

  it("shows correct remaining count in live region", () => {
    renderWithChakra(<SetupChecklist {...defaultProps} />);

    expect(screen.getAllByText("3 feeds remaining").length).toBeGreaterThan(0);
  });

  it("feed cards are visible by default", () => {
    renderWithChakra(<SetupChecklist {...defaultProps} />);

    expect(screen.getByText("Feed One")).toBeVisible();
    expect(screen.getByText("Feed Two")).toBeVisible();
    expect(screen.getByText("Feed Three")).toBeVisible();
  });

  it("hides feed cards when header is clicked", async () => {
    const { user } = renderWithChakra(<SetupChecklist {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /3 feeds need delivery connections/ }));

    await waitFor(() => {
      expect(screen.queryByText("Feed One")).not.toBeVisible();
    });
  });

  it("toggle button has correct aria-expanded attribute", async () => {
    const { user } = renderWithChakra(<SetupChecklist {...defaultProps} />);

    const toggleButton = screen.getByRole("button", {
      name: /3 feeds need delivery connections/,
    });
    expect(toggleButton).toHaveAttribute("aria-expanded", "true");

    await user.click(toggleButton);
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");
  });

  it("shows success state when feeds array is empty", () => {
    renderWithChakra(
      <SetupChecklist feeds={[]} onConnectionCreated={vi.fn()} onDismiss={vi.fn()} />,
    );

    expect(screen.getAllByText("All feeds are delivering").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("calls onDismiss when Done is clicked", async () => {
    const onDismiss = vi.fn();
    const { user } = renderWithChakra(
      <SetupChecklist feeds={[]} onConnectionCreated={vi.fn()} onDismiss={onDismiss} />,
    );

    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
