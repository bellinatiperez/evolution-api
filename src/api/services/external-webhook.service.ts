import {
  AuthenticationConfig,
  ExternalWebhookDto,
  ExternalWebhookUpdateDto,
  RetryConfig,
  SecurityConfig,
} from '@api/dto/external-webhook.dto';
import { PrismaRepository } from '@api/repository/repository.service';
import { Logger } from '@config/logger.config';
import { BadRequestException, InternalServerErrorException, NotFoundException } from '@exceptions';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

// Circuit Breaker para controlar falhas consecutivas
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

export class ExternalWebhookService {
  private readonly logger = new Logger('ExternalWebhookService');
  private readonly circuitBreakers = new Map<string, CircuitBreakerState>();
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5; // Falhas consecutivas para abrir o circuit
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minuto para tentar novamente

  constructor(private readonly prismaRepository: PrismaRepository) {}

  async create(data: ExternalWebhookDto) {
    try {
      // Validar URL de forma mais robusta
      if (!this.isValidWebhookUrl(data.url)) {
        throw new BadRequestException('URL inválida. Deve ser uma URL HTTP/HTTPS válida e acessível');
      }

      // Validar configurações de segurança
      this.validateSecurityConfig(data.securityConfig);

      // Verificar se já existe webhook com o mesmo nome
      const existingWebhook = await this.prismaRepository.externalWebhook.findUnique({
        where: { name: data.name },
      });

      if (existingWebhook) {
        throw new BadRequestException('Já existe um webhook com este nome');
      }

      const webhook = await this.prismaRepository.externalWebhook.create({
        data: {
          name: data.name,
          url: data.url,
          enabled: data.enabled,
          events: data.events || [],
          headers: data.headers || {},
          authentication: (data.authentication || { type: 'none' }) as any,
          retryConfig: (data.retryConfig || {
            maxAttempts: 3,
            initialDelaySeconds: 5,
            useExponentialBackoff: true,
            maxDelaySeconds: 300,
            jitterFactor: 0.2,
            nonRetryableStatusCodes: [400, 401, 403, 404, 422],
          }) as any,
          securityConfig: (data.securityConfig || {
            enableSignatureValidation: false,
            enableIpWhitelist: false,
            enableRateLimit: false,
          }) as any,
          filterConfig: (data.filterConfig || {}) as any,
          timeout: data.timeout || 30000,
          description: data.description,
        },
      });

      this.logger.log({
        local: 'ExternalWebhookService.create',
        message: `Webhook externo criado: ${webhook.name}`,
        webhookId: webhook.id,
      });

      return webhook;
    } catch (error) {
      this.logger.error({
        local: 'ExternalWebhookService.create',
        message: `Erro ao criar webhook: ${error.message}`,
        error: error.stack,
      });
      throw error;
    }
  }

  async findAll() {
    try {
      return await this.prismaRepository.externalWebhook.findMany({
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.logger.error({
        local: 'ExternalWebhookService.findAll',
        message: `Erro ao buscar webhooks: ${error.message}`,
        error: error.stack,
      });
      throw new InternalServerErrorException('Erro ao buscar webhooks');
    }
  }

  async findById(id: string) {
    try {
      const webhook = await this.prismaRepository.externalWebhook.findUnique({
        where: { id },
      });

      if (!webhook) {
        throw new NotFoundException('Webhook não encontrado');
      }

      return webhook;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error({
        local: 'ExternalWebhookService.findById',
        message: `Erro ao buscar webhook: ${error.message}`,
        error: error.stack,
      });
      throw new InternalServerErrorException('Erro ao buscar webhook');
    }
  }

  async update(id: string, data: ExternalWebhookUpdateDto) {
    try {
      const existingWebhook = await this.findById(id);

      // Validar URL se fornecida
      if (data.url && !/^https?:\/\//.test(data.url)) {
        throw new BadRequestException('URL deve começar com http:// ou https://');
      }

      // Verificar se já existe webhook com o mesmo nome (exceto o atual)
      if (data.name && data.name !== existingWebhook.name) {
        const duplicateWebhook = await this.prismaRepository.externalWebhook.findUnique({
          where: { name: data.name },
        });

        if (duplicateWebhook) {
          throw new BadRequestException('Já existe um webhook com este nome');
        }
      }

      const webhook = await this.prismaRepository.externalWebhook.update({
        where: { id },
        data: {
          ...(data as any),
          updatedAt: new Date(),
        },
      });

      return webhook;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error({
        local: 'ExternalWebhookService.update',
        message: `Erro ao atualizar webhook: ${error.message}`,
        error: error.stack,
      });
      throw new InternalServerErrorException('Erro ao atualizar webhook');
    }
  }

  async delete(id: string) {
    try {
      await this.findById(id); // Verificar se existe

      await this.prismaRepository.externalWebhook.delete({
        where: { id },
      });

      this.logger.log({
        local: 'ExternalWebhookService.delete',
        message: `Webhook externo removido`,
        webhookId: id,
      });

      return { message: 'Webhook removido com sucesso' };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error({
        local: 'ExternalWebhookService.delete',
        message: `Erro ao remover webhook: ${error.message}`,
        error: error.stack,
      });
      throw new InternalServerErrorException('Erro ao remover webhook');
    }
  }

  async toggleEnabled(id: string) {
    try {
      const webhook = await this.findById(id);

      const updatedWebhook = await this.prismaRepository.externalWebhook.update({
        where: { id },
        data: {
          enabled: !webhook.enabled,
          updatedAt: new Date(),
        },
      });

      this.logger.log({
        local: 'ExternalWebhookService.toggleEnabled',
        message: `Webhook ${updatedWebhook.enabled ? 'ativado' : 'desativado'}: ${updatedWebhook.name}`,
        webhookId: id,
      });

      return updatedWebhook;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error({
        local: 'ExternalWebhookService.toggleEnabled',
        message: `Erro ao alterar status do webhook: ${error.message}`,
        error: error.stack,
      });
      throw new InternalServerErrorException('Erro ao alterar status do webhook');
    }
  }

  async sendWebhook(webhookId: string, eventType: string, eventData: any, instanceName?: string): Promise<void> {
    try {
      const webhook = await this.prismaRepository.externalWebhook.findUnique({
        where: { id: webhookId },
      });

      if (!webhook || !webhook.enabled) {
        return;
      }

      // Verificar circuit breaker antes de tentar enviar
      if (!this.canExecuteWebhook(webhookId)) {
        this.logger.warn({
          local: 'ExternalWebhookService.sendWebhook',
          message: `Circuit breaker OPEN para webhook ${webhook.name}. Pulando execução.`,
          webhookId,
          eventType,
          instanceName,
        });
        return;
      }

      // Verificar se o evento está na lista de eventos do webhook
      const events = webhook.events as string[];
      if (events && events.length > 0 && !events.includes(eventType)) {
        return;
      }

      this.logger.log({
        webhook_events: webhook.events,
        eventType: eventType,
      });

      // Verificar filtros de instância
      const filterConfig = webhook.filterConfig as any;
      if (filterConfig && instanceName) {
        // Se há lista de instâncias específicas, verificar se a instância está incluída
        if (filterConfig.instances && filterConfig.instances.length > 0) {
          if (!filterConfig.instances.includes(instanceName)) {
            return;
          }
        }

        // Se há lista de instâncias excluídas, verificar se a instância não está excluída
        if (filterConfig.excludeInstances && filterConfig.excludeInstances.length > 0) {
          if (filterConfig.excludeInstances.includes(instanceName)) {
            return;
          }
        }
      }

      this.logger.log({
        local: 'ExternalWebhookService.sendWebhook',
        message: `Enviando evento ${eventType} para webhook ${webhook.name}`,
        eventType,
        webhook_events: webhook.events,
        instanceName,
      });

      const payload = {
        event: eventType,
        instance: instanceName,
        data: eventData,
        timestamp: new Date().toISOString(),
        webhook: {
          id: webhook.id,
          name: webhook.name,
        },
      };

      await this.executeWebhookRequest(webhook, payload);

      // Registrar sucesso no circuit breaker
      this.recordWebhookSuccess(webhookId);
    } catch (error) {
      // Registrar falha no circuit breaker
      this.recordWebhookFailure(webhookId);

      this.logger.error({
        local: 'ExternalWebhookService.sendWebhook',
        message: `Erro ao enviar webhook: ${error.message}`,
        webhookId,
        eventType,
        instanceName,
        error: error.stack,
      });

      // Não re-throw o erro para não quebrar o fluxo principal
      // O sistema deve ser resiliente a falhas de webhook
    }
  }

  async sendToAllWebhooks(eventType: string, eventData: any, instanceName?: string): Promise<void> {
    try {
      const webhooks = await this.prismaRepository.externalWebhook.findMany({
        where: { enabled: true },
      });

      const promises = webhooks.map((webhook) => this.sendWebhook(webhook.id, eventType, eventData, instanceName));

      await Promise.allSettled(promises);
    } catch (error) {
      this.logger.error({
        local: 'ExternalWebhookService.sendToAllWebhooks',
        message: `Erro ao enviar para todos os webhooks: ${error.message}`,
        eventType,
        instanceName,
        error: error.stack,
      });
    }
  }

  private async executeWebhookRequest(webhook: any, payload: any): Promise<void> {
    const retryConfig = webhook.retryConfig as RetryConfig;
    const authConfig = webhook.authentication as AuthenticationConfig;
    const headers = { ...((webhook.headers as Record<string, string>) || {}) };

    // Configurar autenticação
    this.configureAuthentication(headers, authConfig);

    const axiosConfig: AxiosRequestConfig = {
      timeout: webhook.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const httpService = axios.create(axiosConfig);

    await this.retryWebhookRequest(httpService, webhook.url, payload, webhook.id, retryConfig);
  }

  private configureAuthentication(headers: Record<string, string>, authConfig: AuthenticationConfig): void {
    if (!authConfig || authConfig.type === 'none') {
      return;
    }

    switch (authConfig.type) {
      case 'bearer':
        if (authConfig.token) {
          headers['Authorization'] = `Bearer ${authConfig.token}`;
        }
        break;

      case 'basic':
        if (authConfig.username && authConfig.password) {
          const credentials = Buffer.from(`${authConfig.username}:${authConfig.password}`).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;

      case 'api_key':
        if (authConfig.token && authConfig.headerName) {
          headers[authConfig.headerName] = authConfig.token;
        }
        break;

      case 'jwt':
        if (authConfig.jwtSecret) {
          const jwtToken = this.generateJwtToken(authConfig.jwtSecret);
          headers['Authorization'] = `Bearer ${jwtToken}`;
        }
        break;
    }
  }

  private generateJwtToken(secret: string): string {
    try {
      const payload = {
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 600, // 10 min expiration
        app: 'evolution-api',
        action: 'external-webhook',
      };

      return jwt.sign(payload, secret, { algorithm: 'HS256' });
    } catch (error) {
      this.logger.error({
        local: 'ExternalWebhookService.generateJwtToken',
        message: `Erro ao gerar JWT: ${error.message}`,
      });
      throw error;
    }
  }

  private async retryWebhookRequest(
    httpService: AxiosInstance,
    url: string,
    payload: any,
    webhookId: string,
    retryConfig: RetryConfig,
  ): Promise<void> {
    const maxRetryAttempts = retryConfig?.maxAttempts || 3;
    const initialDelay = retryConfig?.initialDelaySeconds || 5;
    const useExponentialBackoff = retryConfig?.useExponentialBackoff ?? true;
    const maxDelay = retryConfig?.maxDelaySeconds || 300;
    const jitterFactor = retryConfig?.jitterFactor || 0.2;
    const nonRetryableStatusCodes = retryConfig?.nonRetryableStatusCodes || [400, 401, 403, 404, 422];

    let attempts = 0;
    let lastError: any;

    while (attempts < maxRetryAttempts) {
      try {
        const startTime = Date.now();
        await httpService.post(url, payload);
        const duration = Date.now() - startTime;

        // Atualizar estatísticas de sucesso
        await this.updateWebhookStats(webhookId, true, null, duration);

        if (attempts > 0) {
          this.logger.log({
            local: 'ExternalWebhookService.retryWebhookRequest',
            message: `Sucesso no envio após ${attempts + 1} tentativas`,
            webhookId,
            url,
            duration,
          });
        }
        return;
      } catch (error) {
        attempts++;
        lastError = error;

        const isTimeout = error.code === 'ECONNABORTED';
        const statusCode = error?.response?.status;

        if (statusCode && nonRetryableStatusCodes.includes(statusCode)) {
          this.logger.error({
            local: 'ExternalWebhookService.retryWebhookRequest',
            message: `Erro não recuperável (${statusCode}): ${error?.message}. Cancelando retentativas.`,
            webhookId,
            url,
            statusCode,
          });

          await this.updateWebhookStats(webhookId, false, error.message);
          throw error;
        }

        this.logger.error({
          local: 'ExternalWebhookService.retryWebhookRequest',
          message: `Tentativa ${attempts}/${maxRetryAttempts} falhou: ${isTimeout ? 'Timeout da requisição' : error?.message}`,
          webhookId,
          url,
          statusCode,
          isTimeout,
          attempt: attempts,
        });

        if (attempts === maxRetryAttempts) {
          await this.updateWebhookStats(webhookId, false, error.message);
          throw error;
        }

        let nextDelay = initialDelay;
        if (useExponentialBackoff) {
          nextDelay = Math.min(initialDelay * Math.pow(2, attempts - 1), maxDelay);

          const jitter = nextDelay * jitterFactor * (Math.random() * 2 - 1);
          nextDelay = Math.max(initialDelay, nextDelay + jitter);
        }

        this.logger.log({
          local: 'ExternalWebhookService.retryWebhookRequest',
          message: `Aguardando ${nextDelay.toFixed(1)} segundos antes da próxima tentativa`,
          webhookId,
          url,
        });

        await new Promise((resolve) => setTimeout(resolve, nextDelay * 1000));
      }
    }
  }

  private async updateWebhookStats(
    webhookId: string,
    success: boolean,
    errorMessage?: string,
    duration?: number,
  ): Promise<void> {
    try {
      const updateData: any = {
        lastExecutionAt: new Date(),
        lastExecutionStatus: success ? 'success' : 'failed',
        totalExecutions: { increment: 1 },
        updatedAt: new Date(),
      };

      if (success) {
        updateData.successfulExecutions = { increment: 1 };
        updateData.lastExecutionError = null;
      } else {
        updateData.failedExecutions = { increment: 1 };
        updateData.lastExecutionError = errorMessage;
      }

      await this.prismaRepository.externalWebhook.update({
        where: { id: webhookId },
        data: updateData,
      });
    } catch (error) {
      this.logger.error({
        local: 'ExternalWebhookService.updateWebhookStats',
        message: `Erro ao atualizar estatísticas do webhook: ${error.message}`,
        webhookId,
        success,
      });
    }
  }

  async getWebhookStats(id: string) {
    try {
      const webhook = await this.findById(id);

      return {
        id: webhook.id,
        name: webhook.name,
        enabled: webhook.enabled,
        totalExecutions: webhook.totalExecutions || 0,
        successfulExecutions: webhook.successfulExecutions || 0,
        failedExecutions: webhook.failedExecutions || 0,
        successRate:
          webhook.totalExecutions > 0
            ? (((webhook.successfulExecutions || 0) / webhook.totalExecutions) * 100).toFixed(2) + '%'
            : '0%',
        lastExecutionAt: webhook.lastExecutionAt,
        lastExecutionStatus: webhook.lastExecutionStatus,
        lastExecutionError: webhook.lastExecutionError,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error({
        local: 'ExternalWebhookService.getWebhookStats',
        message: `Erro ao buscar estatísticas do webhook: ${error.message}`,
        error: error.stack,
      });
      throw new InternalServerErrorException('Erro ao buscar estatísticas do webhook');
    }
  }

  private validateSecurityConfig(securityConfig?: SecurityConfig): void {
    if (!securityConfig) return;

    // Validar configuração de assinatura
    if (securityConfig.enableSignatureValidation) {
      if (!securityConfig.signatureSecret || securityConfig.signatureSecret.length < 16) {
        throw new BadRequestException('Chave secreta deve ter pelo menos 16 caracteres');
      }

      const validAlgorithms = ['sha256', 'sha1', 'md5'];
      if (securityConfig.signatureAlgorithm && !validAlgorithms.includes(securityConfig.signatureAlgorithm)) {
        throw new BadRequestException('Algoritmo de assinatura inválido');
      }
    }

    // Validar configuração de IP whitelist
    if (securityConfig.enableIpWhitelist) {
      if (!securityConfig.allowedIps || securityConfig.allowedIps.length === 0) {
        throw new BadRequestException('Lista de IPs permitidos não pode estar vazia');
      }

      // Validar formato dos IPs/CIDRs
      for (const ip of securityConfig.allowedIps) {
        if (!this.isValidIpOrCidr(ip)) {
          throw new BadRequestException(`IP ou CIDR inválido: ${ip}`);
        }
      }
    }

    // Validar configuração de rate limit
    if (securityConfig.enableRateLimit) {
      if (!securityConfig.rateLimitRequests || securityConfig.rateLimitRequests < 1) {
        throw new BadRequestException('Número de requisições deve ser maior que 0');
      }

      if (!securityConfig.rateLimitWindowMinutes || securityConfig.rateLimitWindowMinutes < 1) {
        throw new BadRequestException('Janela de tempo deve ser maior que 0');
      }
    }
  }

  private isValidIpOrCidr(ip: string): boolean {
    // Regex para validar IP v4 com ou sem CIDR
    const ipv4Regex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\/(?:[0-9]|[1-2][0-9]|3[0-2]))?$/;
    return ipv4Regex.test(ip);
  }

  private generateWebhookSignature(payload: string, secret: string, algorithm: string = 'sha256'): string {
    const hmac = crypto.createHmac(algorithm, secret);
    hmac.update(payload);
    return `${algorithm}=${hmac.digest('hex')}`;
  }

  private validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
    algorithm: string = 'sha256',
  ): boolean {
    const expectedSignature = this.generateWebhookSignature(payload, secret, algorithm);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }

  private isIpAllowed(clientIp: string, allowedIps: string[]): boolean {
    for (const allowedIp of allowedIps) {
      if (allowedIp.includes('/')) {
        // CIDR notation
        if (this.isIpInCidr(clientIp, allowedIp)) {
          return true;
        }
      } else {
        // Single IP
        if (clientIp === allowedIp) {
          return true;
        }
      }
    }
    return false;
  }

  private isIpInCidr(ip: string, cidr: string): boolean {
    const [network, prefixLength] = cidr.split('/');
    const mask = ~(0xffffffff >>> parseInt(prefixLength));

    const ipInt = this.ipToInt(ip);
    const networkInt = this.ipToInt(network);

    return (ipInt & mask) === (networkInt & mask);
  }

  private ipToInt(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  // Métodos para Circuit Breaker
  private canExecuteWebhook(webhookId: string): boolean {
    const circuitState = this.circuitBreakers.get(webhookId);

    if (!circuitState) {
      // Primeiro uso, circuit fechado
      this.circuitBreakers.set(webhookId, {
        failures: 0,
        lastFailureTime: 0,
        state: 'CLOSED',
      });
      return true;
    }

    const now = Date.now();

    switch (circuitState.state) {
      case 'CLOSED':
        return true;

      case 'OPEN':
        // Verificar se é hora de tentar novamente (half-open)
        if (now - circuitState.lastFailureTime > this.CIRCUIT_BREAKER_TIMEOUT) {
          circuitState.state = 'HALF_OPEN';
          return true;
        }
        return false;

      case 'HALF_OPEN':
        return true;

      default:
        return true;
    }
  }

  private recordWebhookSuccess(webhookId: string): void {
    const circuitState = this.circuitBreakers.get(webhookId);

    if (circuitState) {
      // Reset do circuit breaker em caso de sucesso
      circuitState.failures = 0;
      circuitState.state = 'CLOSED';
      circuitState.lastFailureTime = 0;
    }
  }

  private recordWebhookFailure(webhookId: string): void {
    let circuitState = this.circuitBreakers.get(webhookId);

    if (!circuitState) {
      circuitState = {
        failures: 0,
        lastFailureTime: 0,
        state: 'CLOSED',
      };
      this.circuitBreakers.set(webhookId, circuitState);
    }

    circuitState.failures++;
    circuitState.lastFailureTime = Date.now();

    // Abrir circuit se atingir o threshold
    if (circuitState.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      circuitState.state = 'OPEN';

      this.logger.warn({
        local: 'ExternalWebhookService.recordWebhookFailure',
        message: `Circuit breaker ABERTO para webhook ${webhookId} após ${circuitState.failures} falhas consecutivas`,
        webhookId,
        failures: circuitState.failures,
      });
    }
  }

  // Validação robusta de URL
  private isValidWebhookUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);

      // Verificar protocolo
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return false;
      }

      // Verificar se não é localhost ou IP privado em produção
      const hostname = parsedUrl.hostname.toLowerCase();

      // Permitir localhost apenas em desenvolvimento
      const isDevelopment = process.env.NODE_ENV !== 'production';
      if (!isDevelopment) {
        // Bloquear localhost e IPs privados em produção
        if (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)
        ) {
          this.logger.warn({
            local: 'ExternalWebhookService.isValidWebhookUrl',
            message: `URL rejeitada em produção: ${url}`,
            hostname,
          });
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.error({
        local: 'ExternalWebhookService.isValidWebhookUrl',
        message: `URL inválida: ${url}`,
        error: error.message,
      });
      return false;
    }
  }
}
