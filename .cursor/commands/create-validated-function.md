# Create Validated Function

Create a new function using the validation and error handling pattern with Zod schemas.

## Pattern Overview

This pattern uses a builder-style approach:

1. **Outer function** (`createXxx`) accepts dependencies as parameters (dependency injection)
2. **Inner function** (`fn`) contains the actual business logic with typed parameters
3. **Wrapper** (`withErrorHandlingAndValidation`) handles validation and errors

This design enables **dependency injection**, making functions easy to test by swapping real dependencies with mocks.

## Instructions

1. **Identify or create the Zod schema** in `@mikro/common`:
   - Check if a schema already exists in `mods/common/src/schemas/`
   - If not, create a new schema file following the naming convention: `<domain>.ts`
   - Export the schema and its inferred type from `mods/common/src/schemas/index.ts`
   - Export from `mods/common/src/index.ts`

2. **Use existing client interfaces** from `@mikro/common`:
   - Client interfaces live in `mods/common/src/types/`
   - Import them: `import type { MemberClient } from "@mikro/common"`
   - If a new interface is needed, add it to the types folder

3. **Create the function file** following the naming pattern `create<FunctionName>.ts`:

   ```typescript
   import {
     withErrorHandlingAndValidation,
     <schemaName>,
     type <InputType>,
     type <ClientType>,
   } from "@mikro/common";

   export function create<FunctionName>(client: <ClientType>) {
     const fn = async (params: <InputType>) => {
       // Business logic here using the injected client
       return client.doSomething(params);
     };

     return withErrorHandlingAndValidation(fn, <schemaName>);
   }
   ```

4. **Export the function** from the appropriate barrel file or index

## Example: Member Operations

### Using Shared Types

```typescript
import {
  withErrorHandlingAndValidation,
  createMemberSchema,
  type CreateMemberInput,
  type MemberClient
} from "@mikro/common";

export function createCreateMember(client: MemberClient) {
  const fn = async (params: CreateMemberInput) => {
    return client.member.create({ data: params });
  };

  return withErrorHandlingAndValidation(fn, createMemberSchema);
}
```

### Production Usage

```typescript
import { db } from "./db.js";
import { createCreateMember } from "./members/createCreateMember.js";

// Inject the real database client
const createMember = createCreateMember(db);

// This will validate input and throw ValidationError if invalid
const member = await createMember({
  name: "John Doe",
  phone: "+1234567890",
  idNumber: "ABC123",
  collectionPoint: "Main Office",
  homeAddress: "123 Main St"
});
```

## Example: Custom Service Function

This pattern works for any function, not just database operations.

### Schema

```typescript
// mods/common/src/schemas/notification.ts
import { z } from "zod/v4";

export const sendNotificationSchema = z.object({
  recipient: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  priority: z.enum(["low", "normal", "high"]).optional()
});

export type SendNotificationInput = z.infer<typeof sendNotificationSchema>;
```

### Client Interface

```typescript
// mods/common/src/types/notification.ts
import type { SendNotificationInput } from "../schemas/notification.js";

export interface NotificationClient {
  send(params: SendNotificationInput): Promise<{ messageId: string }>;
}
```

### Function

```typescript
import {
  withErrorHandlingAndValidation,
  sendNotificationSchema,
  type SendNotificationInput,
  type NotificationClient
} from "@mikro/common";

export function createSendNotification(client: NotificationClient) {
  const fn = async (params: SendNotificationInput) => {
    return client.send(params);
  };

  return withErrorHandlingAndValidation(fn, sendNotificationSchema);
}
```

## Dependency Injection for Testing

The builder pattern enables easy testing by injecting mock clients instead of real ones.

### Test Example (Mocha + Sinon)

```typescript
import { expect } from "chai";
import sinon from "sinon";
import { createCreateMember } from "./createCreateMember.js";
import { ValidationError } from "@mikro/common";

describe("createCreateMember", () => {
  const validInput = {
    name: "John Doe",
    phone: "+1234567890",
    idNumber: "ABC123",
    collectionPoint: "Main Office",
    homeAddress: "123 Main St"
  };

  describe("with valid input", () => {
    it("should create a member", async () => {
      // Arrange
      const expectedMember = { id: "123", ...validInput };
      const mockClient = {
        member: {
          create: sinon.stub().resolves(expectedMember)
        }
      };
      const createMember = createCreateMember(mockClient);

      // Act
      const result = await createMember(validInput);

      // Assert
      expect(result.id).to.equal("123");
      expect(mockClient.member.create.calledOnce).to.be.true;
      expect(mockClient.member.create.calledWith({ data: validInput })).to.be.true;
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for missing required fields", async () => {
      // Arrange
      const mockClient = {
        member: {
          create: sinon.stub()
        }
      };
      const createMember = createCreateMember(mockClient);

      // Act & Assert
      try {
        await createMember({ name: "" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.member.create.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      // Arrange
      const mockClient = {
        member: {
          create: sinon.stub().rejects(new Error("Connection failed"))
        }
      };
      const createMember = createCreateMember(mockClient);

      // Act & Assert
      try {
        await createMember(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Connection failed");
      }
    });
  });
});
```

### Benefits of This Pattern

1. **Testability**: Swap real clients with mocks - no external services needed for unit tests
2. **Isolation**: Test business logic separately from infrastructure
3. **Fast tests**: Mock clients return instantly, no I/O overhead
4. **Predictable**: Control exactly what the client returns or throws
5. **Validation coverage**: Verify invalid input never reaches the client

## Error Handling

The `withErrorHandlingAndValidation` wrapper:

- Validates input against the Zod schema using `safeParse`
- Throws `ValidationError` with detailed field-level errors if validation fails
- Passes validated, typed data to the inner function

The `ValidationError` includes:

- `message`: Human-readable error message
- `fieldErrors`: Array of `{ field, message, code }` for each validation error
- `zodError`: Original Zod error for debugging
- `toJSON()`: Serializable format for API responses

## Files Reference

- Utilities: `mods/common/src/utils/withErrorHandlingAndValidation.ts`
- Errors: `mods/common/src/errors/ValidationError.ts`
- Schemas: `mods/common/src/schemas/`
- Types (client interfaces): `mods/common/src/types/`
