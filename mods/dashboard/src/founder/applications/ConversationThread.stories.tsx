/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The application panel's WhatsApp transcript (Pencil UbCzS, sec-CONVERSACION).
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConversationThread, type ThreadTurn } from "./ConversationThread";

const turns: ThreadTurn[] = [
  {
    id: 1,
    role: "INBOUND",
    content: "Hola, ¿qué necesito para un préstamo?",
    agentName: null,
    hasImage: false,
    createdAt: "2026-09-20T18:02:00Z"
  },
  {
    id: 2,
    role: "AGENT",
    content:
      "¡Hola! Soy José de Mikro Créditos. ¿Cuánto vende tu negocio al mes y cuántos empleados tienes?",
    agentName: "jose",
    hasImage: false,
    createdAt: "2026-09-20T18:05:00Z"
  },
  {
    id: 3,
    role: "INBOUND",
    content: "Como 65 mil al mes, somos mi hermana y yo",
    agentName: null,
    hasImage: false,
    createdAt: "2026-09-20T18:11:00Z"
  },
  {
    id: 4,
    role: "INBOUND",
    content: "mi negocio",
    agentName: null,
    hasImage: true,
    createdAt: "2026-09-21T14:00:00Z"
  },
  {
    id: 5,
    role: "INBOUND",
    content: "Quiero hablar con una persona",
    agentName: null,
    hasImage: false,
    createdAt: "2026-09-21T15:29:00Z"
  },
  {
    id: 6,
    role: "SYSTEM",
    content:
      "Claro, ya le avisé al equipo. Una persona te va a responder por aquí lo antes posible.",
    agentName: null,
    hasImage: false,
    createdAt: "2026-09-21T15:30:00Z"
  }
];

const meta = {
  title: "Components/Ops/Conversation thread",
  component: ConversationThread,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="w-[520px]">
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof ConversationThread>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithHandoff: Story = {
  args: {
    turns,
    handoffs: [
      { id: "h1", reason: "Pidió hablar con una persona", openedAt: "2026-09-21T15:29:30Z" }
    ],
    personName: "Yokasta",
    chatwootUrl: "https://chatwoot.example.com/app/accounts/1/contacts/42"
  }
};

export const Empty: Story = {
  args: { turns: [], handoffs: [], personName: "Yokasta" }
};

export const Loading: Story = {
  args: { turns: [], handoffs: [], personName: "Yokasta", loading: true }
};
