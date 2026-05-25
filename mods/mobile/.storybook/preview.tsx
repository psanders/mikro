/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Preview } from "@storybook/react-native";
import { View } from "react-native";

const preview: Preview = {
  decorators: [
    (Story) => (
      <View style={{ flex: 1, padding: 20, backgroundColor: "#F4F8FF" }}>
        <Story />
      </View>
    )
  ]
};

export default preview;
