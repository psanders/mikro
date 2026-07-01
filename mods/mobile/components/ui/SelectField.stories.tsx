/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { SelectField } from "./SelectField";

const meta: Meta<typeof SelectField> = {
  title: "Interactive/SelectField",
  component: SelectField
};

export default meta;

type Story = StoryObj<typeof SelectField>;

export const WithValue: Story = {
  args: { label: "Tipo de negocio", value: "Ferretería" }
};

export const Empty: Story = {
  args: { label: "Tipo de negocio", placeholder: "Selecciona una opción" }
};
