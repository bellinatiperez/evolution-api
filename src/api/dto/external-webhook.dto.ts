import { JsonValue } from '@prisma/client/runtime/library';

export interface AuthenticationConfig {
  type: 'none' | 'bearer' | 'basic' | 'api_key' | 'jwt';
  token?: string;
  username?: string;
  password?: string;
  headerName?: string;
  jwtSecret?: string;
}

export interface RetryConfig {
  maxAttempts?: number;
  initialDelaySeconds?: number;
  useExponentialBackoff?: boolean;
  maxDelaySeconds?: number;
  jitterFactor?: number;
  nonRetryableStatusCodes?: number[];
}

export interface SecurityConfig {
  enableSignatureValidation?: boolean;
  signatureSecret?: string;
  signatureHeader?: string;
  signatureAlgorithm?: 'sha256' | 'sha1' | 'md5';
  enableIpWhitelist?: boolean;
  allowedIps?: string[];
  enableRateLimit?: boolean;
  rateLimitRequests?: number;
  rateLimitWindowMinutes?: number;
}

export interface FilterConfig {
  instances?: string[];
  excludeInstances?: string[];
}

export class ExternalWebhookDto {
  name: string;
  url: string;
  enabled: boolean;
  events?: string[];
  headers?: JsonValue;
  authentication?: AuthenticationConfig;
  retryConfig?: RetryConfig;
  securityConfig?: SecurityConfig;
  filterConfig?: FilterConfig;
  timeout?: number;
  description?: string;
}

export class ExternalWebhookUpdateDto {
  name?: string;
  url?: string;
  enabled?: boolean;
  events?: string[];
  headers?: JsonValue;
  authentication?: AuthenticationConfig;
  retryConfig?: RetryConfig;
  filterConfig?: FilterConfig;
  timeout?: number;
  description?: string;
}

export class ExternalWebhookResponseDto {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  events: string[];
  headers?: JsonValue;
  authentication?: AuthenticationConfig;
  retryConfig?: RetryConfig;
  filterConfig?: FilterConfig;
  timeout: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  lastExecutionAt?: Date;
  lastExecutionStatus?: 'success' | 'failed';
  lastExecutionError?: string;
  totalExecutions?: number;
  successfulExecutions?: number;
  failedExecutions?: number;
}