/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Command, Flags } from "@oclif/core";
import { createClient } from "../../lib/trpc.js";

export default class CreateMember extends Command {
  static override description = "Create a new member";

  static override examples = [
    `<%= config.bin %> <%= command.id %> --name "John Doe" --phone "+1234567890" --idNumber "ABC123" --collectionPoint "Main Office" --homeAddress "123 Main St"`,
  ];

  static override flags = {
    name: Flags.string({
      required: true,
      description: "Member name",
    }),
    phone: Flags.string({
      required: true,
      description: "Phone number",
    }),
    idNumber: Flags.string({
      required: true,
      description: "ID number",
    }),
    collectionPoint: Flags.string({
      required: true,
      description: "Collection point",
    }),
    homeAddress: Flags.string({
      required: true,
      description: "Home address",
    }),
    jobPosition: Flags.string({
      description: "Job position (optional)",
    }),
    income: Flags.integer({
      description: "Monthly income (optional)",
    }),
    isBusinessOwner: Flags.boolean({
      description: "Is the member a business owner",
      default: false,
    }),
  };

  async run() {
    const { flags } = await this.parse(CreateMember);

    const apiUrl = process.env.MIKRO_API_URL || "http://localhost:3000";
    const credentials = process.env.SYSTEM_BASICAUTH;

    if (!credentials) {
      this.error("SYSTEM_BASICAUTH environment variable is required");
    }

    const client = createClient(apiUrl, credentials);

    try {
      const member = await client.createMember.mutate({
        name: flags.name,
        phone: flags.phone,
        idNumber: flags.idNumber,
        collectionPoint: flags.collectionPoint,
        homeAddress: flags.homeAddress,
        jobPosition: flags.jobPosition,
        income: flags.income,
        isBusinessOwner: flags.isBusinessOwner,
      });

      this.log(`Created member: ${member.id}`);
      this.log(`  Name: ${member.name}`);
      this.log(`  Phone: ${member.phone}`);
    } catch (error) {
      if (error instanceof Error) {
        this.error(`Failed to create member: ${error.message}`);
      }
      throw error;
    }
  }
}
