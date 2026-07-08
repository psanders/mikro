/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FilterPopup } from "./FilterPopup";
import { defaultFeedFilterValue, type FeedFilterValue } from "./feedFilters";
import { feedFilterActors } from "./fixtures";

function Controlled({ initial }: { initial: FeedFilterValue }) {
  const [value, setValue] = useState(initial);
  return (
    <FilterPopup
      value={value}
      onChange={setValue}
      actors={feedFilterActors}
      onApply={() => {}}
      onClear={() => setValue(defaultFeedFilterValue())}
      onClose={() => {}}
    />
  );
}

const meta = {
  title: "Components/Feed/FilterPopup",
  component: Controlled,
  parameters: { layout: "padded" }
} satisfies Meta<typeof Controlled>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default (Todo / Todos / Hoy)",
  args: { initial: defaultFeedFilterValue() }
};

export const AppliedFilters: Story = {
  name: "With Tipo, Actor, and 7d applied",
  args: {
    initial: {
      typeIds: ["pagos"],
      actorId: feedFilterActors[2]!.id,
      preset: "7d",
      from: "",
      to: ""
    }
  }
};

export const CustomDateRange: Story = {
  args: {
    initial: {
      typeIds: [],
      actorId: undefined,
      preset: "custom",
      from: "2026-07-01",
      to: "2026-07-08"
    }
  }
};
