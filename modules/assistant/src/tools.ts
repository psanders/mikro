import { createUser } from './users.js';
import { logger } from './logger.js';
import { clearConversation } from './conversations.js';

export interface ToolFunction {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, {
        type: string;
        description: string;
      }>;
      required: string[];
    };
  };
}

export interface ToolResult {
  success: boolean;
  message: string;
  user?: unknown;
}

/**
 * Tool definitions for OpenAI function calling
 */
export const tools: ToolFunction[] = [
  {
    type: 'function',
    function: {
      name: 'createUser',
      description: 'Crear una nueva cuenta de usuario después de recopilar toda la información requerida: nombre del referido, dirección, nombre completo (extraído de la cédula), número de cédula (extraído de la cédula), empleo, ingresos, y confirmar que se recibieron las fotos de la cédula (frente y reverso). El nombre y número de cédula DEBEN ser extraídos de las fotos de la cédula usando tu capacidad de visión. Solo llama esta función cuando tengas TODA la información.',
      parameters: {
        type: 'object',
        properties: {
          phone: {
            type: 'string',
            description: 'Número de teléfono del usuario (se proporciona automáticamente si no se especifica)'
          },
          referrerName: {
            type: 'string',
            description: 'Nombre de la persona que refirió al cliente'
          },
          name: {
            type: 'string',
            description: 'Nombre completo del usuario extraído de la cédula de identidad (tiene prioridad sobre cualquier nombre proporcionado anteriormente)'
          },
          address: {
            type: 'string',
            description: 'Dirección del usuario (lo más específica posible)'
          },
          currentJobPosition: {
            type: 'string',
            description: 'Empleo actual del usuario'
          },
          currentSalary: {
            type: 'string',
            description: 'Ingresos aproximados del usuario'
          },
          idCardFrontReceived: {
            type: 'boolean',
            description: 'Confirmación de que se recibió la foto del frente de la cédula'
          },
          idCardBackReceived: {
            type: 'boolean',
            description: 'Confirmación de que se recibió la foto del reverso de la cédula'
          },
          idNumber: {
            type: 'string',
            description: 'Número de cédula extraído de la foto de la cédula de identidad'
          }
        },
        required: ['referrerName', 'name', 'address', 'currentJobPosition', 'currentSalary', 'idCardFrontReceived', 'idCardBackReceived', 'idNumber']
      }
    }
  }
];

/**
 * Execute a tool call
 */
export async function executeTool(toolName: string, args: Record<string, unknown>, phone?: string): Promise<ToolResult> {
  logger.info(`Executing tool: ${toolName}`, args);
  
  switch (toolName) {
    case 'createUser':
      try {
        // Automatically inject phone number (always required, but not in OpenAI context)
        if (!phone) {
          throw new Error('Phone number is required but not available in context');
        }
        if (!args.phone) {
          args.phone = phone;
          logger.debug('Phone number injected from context', { phone });
        } else if (args.phone !== phone) {
          // If OpenAI provided a different phone, use the context one (it's authoritative)
          logger.warn('Phone number mismatch, using context phone', { 
            provided: args.phone, 
            context: phone 
          });
          args.phone = phone;
        }
        
        const user = createUser(args as unknown as Parameters<typeof createUser>[0]);
        logger.info('User created successfully', { phone: user.phone });
        // Clear conversation history after user is created
        clearConversation(user.phone);
        return {
          success: true,
          message: `Estimado ${user.name}, registramos su información y el equipo se pondrá en contacto pronto.`,
          user
        };
      } catch (error) {
        const err = error as Error;
        logger.error('Error creating user', { error: err.message });
        return {
          success: false,
          message: `Error creating user: ${err.message}`
        };
      }
    
    default:
      logger.warn(`Unknown tool: ${toolName}`);
      return {
        success: false,
        message: `Unknown tool: ${toolName}`
      };
  }
}
