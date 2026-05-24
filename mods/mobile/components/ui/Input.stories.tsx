/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { User, Lock } from "lucide-react-native";
import { Input } from "./Input";

const meta: Meta<typeof Input> = {
  title: "Interactive/Input",
  component: Input
};

export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    label: "Usuario o teléfono",
    placeholder: "colector@mikro.do",
    icon: User,
    value: "",
    onChangeText: () => {}
  }
};

export const Password: Story = {
  args: {
    label: "Contraseña",
    placeholder: "••••••••",
    icon: Lock,
    value: "",
    onChangeText: () => {},
    secureTextEntry: true
  }
};

export const Filled: Story = {
  args: {
    label: "Usuario o teléfono",
    icon: User,
    value: "carlos@mikro.do",
    onChangeText: () => {}
  }
};
