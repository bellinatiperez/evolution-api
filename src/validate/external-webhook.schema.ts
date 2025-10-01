import { JSONSchema7 } from 'json-schema';
import { v4 } from 'uuid';

const isNotEmpty = (...propertyNames: string[]): JSONSchema7 => {
  const properties = {};
  propertyNames.forEach(
    (property) =>
      (properties[property] = {
        minLength: 1,
        description: `The "${property}" cannot be empty`,
      }),
  );
  return {
    if: {
      propertyNames: {
        enum: propertyNames,
      },
    },
    then: { properties },
  };
};

export const externalWebhookSchema: JSONSchema7 = {
  $id: v4(),
  type: 'object',
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'Nome identificador do webhook externo',
    },
    url: {
      type: 'string',
      minLength: 1,
      maxLength: 500,
      pattern: '^https?://',
      description: 'URL de destino para envio dos eventos',
    },
    enabled: {
      type: 'boolean',
      description: 'Status de ativação do webhook',
    },
    events: {
      type: 'array',
      items: {
        type: 'string',
        enum: [
          'APPLICATION_STARTUP',
          'INSTANCE_CREATE',
          'INSTANCE_DELETE',
          'QRCODE_UPDATED',
          'MESSAGES_SET',
          'MESSAGES_UPSERT',
          'MESSAGES_EDITED',
          'MESSAGES_UPDATE',
          'MESSAGES_DELETE',
          'SEND_MESSAGE',
          'SEND_MESSAGE_UPDATE',
          'CONTACTS_SET',
          'CONTACTS_UPDATE',
          'CONTACTS_UPSERT',
          'PRESENCE_UPDATE',
          'CHATS_SET',
          'CHATS_UPDATE',
          'CHATS_DELETE',
          'CHATS_UPSERT',
          'CONNECTION_UPDATE',
          'LABELS_EDIT',
          'LABELS_ASSOCIATION',
          'GROUPS_UPSERT',
          'GROUP_UPDATE',
          'GROUP_PARTICIPANTS_UPDATE',
          'CALL',
          'TYPEBOT_START',
          'TYPEBOT_CHANGE_STATUS',
          'ERRORS',
        ],
      },
      description: 'Lista de eventos que serão enviados para este webhook',
    },
    headers: {
      type: 'object',
      additionalProperties: {
        type: 'string',
      },
      description: 'Headers customizados para as requisições HTTP',
    },
    authentication: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['none', 'bearer', 'basic', 'api_key', 'jwt'],
          description: 'Tipo de autenticação',
        },
        token: {
          type: 'string',
          description: 'Token de autenticação (para bearer, api_key, jwt)',
        },
        username: {
          type: 'string',
          description: 'Nome de usuário (para basic auth)',
        },
        password: {
          type: 'string',
          description: 'Senha (para basic auth)',
        },
        headerName: {
          type: 'string',
          description: 'Nome do header para api_key',
        },
        jwtSecret: {
          type: 'string',
          description: 'Chave secreta para JWT',
        },
      },
      required: ['type'],
      allOf: [
        {
          if: { properties: { type: { const: 'bearer' } } },
          then: { required: ['token'] },
        },
        {
          if: { properties: { type: { const: 'basic' } } },
          then: { required: ['username', 'password'] },
        },
        {
          if: { properties: { type: { const: 'api_key' } } },
          then: { required: ['token', 'headerName'] },
        },
        {
          if: { properties: { type: { const: 'jwt' } } },
          then: { required: ['jwtSecret'] },
        },
      ],
    },
    retryConfig: {
      type: 'object',
      properties: {
        maxAttempts: {
          type: 'integer',
          minimum: 1,
          maximum: 20,
          default: 3,
          description: 'Número máximo de tentativas',
        },
        initialDelaySeconds: {
          type: 'integer',
          minimum: 1,
          maximum: 300,
          default: 5,
          description: 'Delay inicial em segundos',
        },
        useExponentialBackoff: {
          type: 'boolean',
          default: true,
          description: 'Usar backoff exponencial',
        },
        maxDelaySeconds: {
          type: 'integer',
          minimum: 1,
          maximum: 3600,
          default: 300,
          description: 'Delay máximo em segundos',
        },
        jitterFactor: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          default: 0.2,
          description: 'Fator de jitter para randomização',
        },
        nonRetryableStatusCodes: {
          type: 'array',
          items: {
            type: 'integer',
            minimum: 100,
            maximum: 599,
          },
          default: [400, 401, 403, 404, 422],
          description: 'Códigos de status que não devem ser reprocessados',
        },
      },
    },
    filterConfig: {
      type: 'object',
      properties: {
        instances: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Lista de instâncias específicas para monitorar (vazio = todas)',
        },
        excludeInstances: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Lista de instâncias para excluir do monitoramento',
        },
      },
    },
    securityConfig: {
      type: 'object',
      properties: {
        enableSignatureValidation: {
          type: 'boolean',
          default: false,
          description: 'Habilitar validação de assinatura HMAC',
        },
        signatureSecret: {
          type: 'string',
          minLength: 16,
          maxLength: 256,
          description: 'Chave secreta para geração da assinatura HMAC',
        },
        signatureHeader: {
          type: 'string',
          default: 'X-Webhook-Signature',
          description: 'Nome do header que conterá a assinatura',
        },
        signatureAlgorithm: {
          type: 'string',
          enum: ['sha256', 'sha1', 'md5'],
          default: 'sha256',
          description: 'Algoritmo de hash para a assinatura',
        },
        enableIpWhitelist: {
          type: 'boolean',
          default: false,
          description: 'Habilitar whitelist de IPs',
        },
        allowedIps: {
          type: 'array',
          items: {
            type: 'string',
            pattern: '^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:/(?:[0-9]|[1-2][0-9]|3[0-2]))?$',
          },
          description: 'Lista de IPs ou CIDRs permitidos',
        },
        enableRateLimit: {
          type: 'boolean',
          default: false,
          description: 'Habilitar rate limiting',
        },
        rateLimitRequests: {
          type: 'integer',
          minimum: 1,
          maximum: 10000,
          default: 100,
          description: 'Número máximo de requisições por janela de tempo',
        },
        rateLimitWindowMinutes: {
          type: 'integer',
          minimum: 1,
          maximum: 1440,
          default: 60,
          description: 'Janela de tempo em minutos para rate limiting',
        },
      },
      allOf: [
        {
          if: { properties: { enableSignatureValidation: { const: true } } },
          then: { required: ['signatureSecret'] },
        },
        {
          if: { properties: { enableIpWhitelist: { const: true } } },
          then: { required: ['allowedIps'] },
        },
        {
          if: { properties: { enableRateLimit: { const: true } } },
          then: { required: ['rateLimitRequests', 'rateLimitWindowMinutes'] },
        },
      ],
    },
    timeout: {
      type: 'integer',
      minimum: 1000,
      maximum: 60000,
      default: 30000,
      description: 'Timeout da requisição em milissegundos',
    },
    description: {
      type: 'string',
      maxLength: 500,
      description: 'Descrição do webhook externo',
    },
  },
  required: ['name', 'url', 'enabled'],
  ...isNotEmpty('name', 'url'),
};

export const externalWebhookUpdateSchema: JSONSchema7 = {
  $id: v4(),
  type: 'object',
  properties: {
    ...externalWebhookSchema.properties,
  },
  ...isNotEmpty('name', 'url'),
};