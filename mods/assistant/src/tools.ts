import { createMember } from './members.js';
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
  member?: unknown;
}

/**
 * Tool definitions for OpenAI function calling
 */
export const tools: ToolFunction[] = [
  {
    type: 'function',
    function: {
      name: 'createMember',
      description: 'Crear una nueva cuenta de miembro después de recopilar toda la información requerida: si es propietario de negocio (y cuánto tiempo lleva operando si es propietario - acepta la respuesta como texto, por ejemplo: "6 meses", "un año", "dos años", etc.), nombre del referido, dirección, nombre completo (extraído de la cédula), número de cédula (extraído de la cédula), empleo, ingresos, y confirmar que se recibieron las fotos de la cédula (frente y reverso). El nombre y número de cédula DEBEN ser extraídos de las fotos de la cédula usando tu capacidad de visión. Solo llama esta función cuando tengas TODA la información.',
      parameters: {
        type: 'object',
        properties: {
          phone: {
            type: 'string',
            description: 'Número de teléfono del miembro (se proporciona automáticamente si no se especifica)'
          },
          referrerName: {
            type: 'string',
            description: 'Nombre de la persona que refirió al cliente'
          },
          name: {
            type: 'string',
            description: 'Nombre completo del miembro extraído de la cédula de identidad (tiene prioridad sobre cualquier nombre proporcionado anteriormente)'
          },
          address: {
            type: 'string',
            description: 'Dirección del miembro (lo más específica posible)'
          },
          currentJobPosition: {
            type: 'string',
            description: 'Empleo actual del miembro'
          },
          currentSalary: {
            type: 'string',
            description: 'Ingresos aproximados del miembro'
          },
          isBusinessOwner: {
            type: 'boolean',
            description: 'Indica si el miembro es propietario de un negocio'
          },
          timeInBusiness: {
            type: 'string',
            description: 'Tiempo que lleva operando el negocio expresado como texto (solo si isBusinessOwner es true). Acepta respuestas en texto como: "6 meses", "un año", "dos años", "3 años", etc. Guarda exactamente lo que el cliente responda.'
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
            description: 'Número de cédula extraído de la foto de la cédula de identidad. Debe estar en formato 000-0000000-0 (con guiones). Si lo extraes sin guiones, agrégalos en el formato correcto antes de enviarlo.'
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
    case 'createMember':
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
        
        const member = await createMember(args as unknown as Parameters<typeof createMember>[0]);
        logger.info('Member created successfully', { phone: member.phone });
        // Clear conversation history after member is created
        clearConversation(member.phone);
        // Extract first name from full name
        const firstName = member.name ? member.name.split(' ')[0] : 'cliente';
        return {
          success: true,
          message: `Estimado ${firstName}, registramos su información y el equipo se pondrá en contacto pronto.`,
          member: member
        };
      } catch (error) {
        const err = error as Error;
        logger.error('Error creating member', { error: err.message });
        return {
          success: false,
          message: `Error creating member: ${err.message}`
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
