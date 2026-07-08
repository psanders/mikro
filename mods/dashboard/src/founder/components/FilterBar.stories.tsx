/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FilterBar } from "./FilterBar";
import { defaultFeedFilterValue, type FeedFilterValue } from "./feedFilters";
import { feedFilterActors } from "./fixtures";

function Controlled({ initial }: { initial: FeedFilterValue }) {
  const [value, setValue] = useState(initial);
  return <FilterBar value={value} actors={feedFilterActors} onApply={setValue} />;
}

const meta = {
  title: "Components/Feed/FilterBar",
  component: Controlled,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 720 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof Controlled>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoFiltersActive: Story = {
  name: "Default — icon only, no chips",
  args: { initial: defaultFeedFilterValue() }
};

export const AllFiltersActive: Story = {
  name: "Tipo + Actor + Rango chips",
  args: {
    initial: {
      typeIds: ["pagos", "alertas"],
      actorId: feedFilterActors[2]!.id,
      preset: "7d",
      from: "",
      to: ""
    }
  }
};
