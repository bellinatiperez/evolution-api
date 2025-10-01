import { ExternalWebhookDto, ExternalWebhookUpdateDto } from '@api/dto/external-webhook.dto';
import { PrismaRepository } from '@api/repository/repository.service';
import { Logger } from '@config/logger.config';
import { BadRequestException, InternalServerErrorException, NotFoundException } from '@exceptions';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';

export class ExternalWebhookController {
  private readonly logger = new Logger('ExternalWebhookController');

  constructor(private readonly prismaRepository: PrismaRepository) {}

  async create(data: ExternalWebhookDto) {
    try {
      // Validar URL
      if (!/^https?:\/\//.test(data.url)) {
        throw new BadRequestException('URL deve começar com http:// ou https://');
      }

      // Verificar se já existe webhook com o mesmo nome
      const existingWebhook = await this.prismaRepository.$queryRaw`
        SELECT id FROM "ExternalWebhook" WHERE name = ${data.name} LIMIT 1
      `;

      if (Array.isArray(existingWebhook) && existingWebhook.length > 0) {
        throw new BadRequestException('Já existe um webhook com este nome');
      }

      const webhook = await this.prismaRepository.$queryRaw`
        INSERT INTO "ExternalWebhook" (
          id, name, url, enabled, events, headers, authentication, 
          "retryConfig", "securityConfig", "filterConfig", timeout, description, 
          "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), ${data.name}, ${data.url}, ${data.enabled || true}, 
          ${JSON.stringify(data.events || [])}::jsonb, ${JSON.stringify(data.headers || {})}::jsonb, 
          ${JSON.stringify(data.authentication || { type: 'none' })}::jsonb, 
          ${JSON.stringify(
            data.retryConfig || {
              maxAttempts: 3,
              initialDelaySeconds: 5,
              useExponentialBackoff: true,
              maxDelaySeconds: 300,
              jitterFactor: 0.2,
              nonRetryableStatusCodes: [400, 401, 403, 404, 422],
            },
          )}::jsonb, 
          ${JSON.stringify(
            data.securityConfig || {
              enableSignatureValidation: false,
              enableIpWhitelist: false,
              enableRateLimit: false,
            },
          )}::jsonb,
          ${JSON.stringify(data.filterConfig || {})}::jsonb, 
          ${data.timeout || 30000}, ${data.description || null}, 
          NOW(), NOW()
        ) RETURNING *
      `;

      if (!Array.isArray(webhook) || webhook.length === 0) {
        throw new InternalServerErrorException('Erro ao criar webhook');
      }

      this.logger.log(`Webhook externo criado: ${data.name}`);

      return {
        status: 201,
        message: 'Webhook externo criado com sucesso',
        data: webhook[0],
      };
    } catch (error) {
      this.logger.error(`Erro ao criar webhook externo: ${error.message || error}`);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Erro interno do servidor');
    }
  }

  async findAll() {
    try {
      const webhooks = await this.prismaRepository.$queryRaw`
        SELECT * FROM "ExternalWebhook" ORDER BY "createdAt" DESC
      `;

      return {
        status: 200,
        message: 'Webhooks externos encontrados',
        data: webhooks,
      };
    } catch (error) {
      this.logger.error(`Erro ao buscar webhooks externos: ${error.message || error}`);
      throw new InternalServerErrorException('Erro interno do servidor');
    }
  }

  async findById(id: string) {
    try {
      const webhook = await this.prismaRepository.$queryRaw`
        SELECT * FROM "ExternalWebhook" WHERE id = ${id} LIMIT 1
      `;

      if (!Array.isArray(webhook) || webhook.length === 0) {
        throw new NotFoundException('Webhook não encontrado');
      }

      return {
        status: 200,
        message: 'Webhook encontrado',
        data: webhook[0],
      };
    } catch (error) {
      this.logger.error(`Erro ao buscar webhook: ${error.message || error}`);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Erro interno do servidor');
    }
  }

  async update(id: string, data: ExternalWebhookUpdateDto) {
    try {
      // Verificar se o webhook existe
      const existingWebhook = await this.prismaRepository.$queryRaw`
        SELECT id FROM "ExternalWebhook" WHERE id = ${id} LIMIT 1
      `;

      if (!Array.isArray(existingWebhook) || existingWebhook.length === 0) {
        throw new NotFoundException('Webhook não encontrado');
      }

      // Validar URL se fornecida
      if (data.url && !/^https?:\/\//.test(data.url)) {
        throw new BadRequestException('URL deve começar com http:// ou https://');
      }

      // Verificar se já existe outro webhook com o mesmo nome
      if (data.name) {
        const duplicateWebhook = await this.prismaRepository.$queryRaw`
          SELECT id FROM "ExternalWebhook" WHERE name = ${data.name} AND id != ${id} LIMIT 1
        `;

        if (Array.isArray(duplicateWebhook) && duplicateWebhook.length > 0) {
          throw new BadRequestException('Já existe outro webhook com este nome');
        }
      }

      // Construir query de atualização dinamicamente
      const updateFields = [];
      const updateValues = [];

      if (data.name !== undefined) {
        updateFields.push('name = $' + (updateValues.length + 1));
        updateValues.push(data.name);
      }
      if (data.url !== undefined) {
        updateFields.push('url = $' + (updateValues.length + 1));
        updateValues.push(data.url);
      }
      if (data.enabled !== undefined) {
        updateFields.push('enabled = $' + (updateValues.length + 1));
        updateValues.push(data.enabled);
      }
      if (data.events !== undefined) {
        updateFields.push('events = $' + (updateValues.length + 1));
        updateValues.push(JSON.stringify(data.events));
      }
      if (data.headers !== undefined) {
        updateFields.push('headers = $' + (updateValues.length + 1));
        updateValues.push(JSON.stringify(data.headers));
      }
      if (data.authentication !== undefined) {
        updateFields.push('authentication = $' + (updateValues.length + 1));
        updateValues.push(JSON.stringify(data.authentication));
      }
      if (data.retryConfig !== undefined) {
        updateFields.push('"retryConfig" = $' + (updateValues.length + 1));
        updateValues.push(JSON.stringify(data.retryConfig));
      }
      if (data.filterConfig !== undefined) {
        updateFields.push('"filterConfig" = $' + (updateValues.length + 1));
        updateValues.push(JSON.stringify(data.filterConfig));
      }
      if (data.timeout !== undefined) {
        updateFields.push('timeout = $' + (updateValues.length + 1));
        updateValues.push(data.timeout);
      }
      if (data.description !== undefined) {
        updateFields.push('description = $' + (updateValues.length + 1));
        updateValues.push(data.description);
      }

      updateFields.push('"updatedAt" = NOW()');
      updateValues.push(id);

      if (updateFields.length === 1) {
        // Apenas updatedAt
        throw new BadRequestException('Nenhum campo para atualizar foi fornecido');
      }

      const query = `
        UPDATE "ExternalWebhook" 
        SET ${updateFields.join(', ')} 
        WHERE id = $${updateValues.length} 
        RETURNING *
      `;

      const updatedWebhook = await this.prismaRepository.$queryRawUnsafe(query, ...updateValues);

      if (!Array.isArray(updatedWebhook) || updatedWebhook.length === 0) {
        throw new InternalServerErrorException('Erro ao atualizar webhook');
      }

      this.logger.log(`Webhook atualizado: ${id}`);

      return {
        status: 200,
        message: 'Webhook atualizado com sucesso',
        data: updatedWebhook[0],
      };
    } catch (error) {
      this.logger.error(`Erro ao atualizar webhook: ${error.message || error}`);

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Erro interno do servidor');
    }
  }

  async delete(id: string) {
    try {
      const deletedWebhook = await this.prismaRepository.$queryRaw`
        DELETE FROM "ExternalWebhook" WHERE id = ${id} RETURNING *
      `;

      if (!Array.isArray(deletedWebhook) || deletedWebhook.length === 0) {
        throw new NotFoundException('Webhook não encontrado');
      }

      this.logger.log(`Webhook deletado: ${id}`);

      return {
        status: 200,
        message: 'Webhook deletado com sucesso',
        data: deletedWebhook[0],
      };
    } catch (error) {
      this.logger.error(`Erro ao deletar webhook: ${error.message || error}`);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Erro interno do servidor');
    }
  }

  async toggleEnabled(id: string) {
    try {
      const webhook = await this.prismaRepository.$queryRaw`
        SELECT enabled FROM "ExternalWebhook" WHERE id = ${id} LIMIT 1
      `;

      if (!Array.isArray(webhook) || webhook.length === 0) {
        throw new NotFoundException('Webhook não encontrado');
      }

      const currentEnabled = webhook[0].enabled;
      const newEnabled = !currentEnabled;

      const updatedWebhook = await this.prismaRepository.$queryRaw`
        UPDATE "ExternalWebhook" 
        SET enabled = ${newEnabled}, "updatedAt" = NOW() 
        WHERE id = ${id} 
        RETURNING *
      `;

      if (!Array.isArray(updatedWebhook) || updatedWebhook.length === 0) {
        throw new InternalServerErrorException('Erro ao alterar status do webhook');
      }

      this.logger.log(`Status do webhook alterado: ${id} - ${newEnabled ? 'ativado' : 'desativado'}`);

      return {
        status: 200,
        message: `Webhook ${newEnabled ? 'ativado' : 'desativado'} com sucesso`,
        data: updatedWebhook[0],
      };
    } catch (error) {
      this.logger.error(`Erro ao alterar status do webhook: ${error.message || error}`);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Erro interno do servidor');
    }
  }

  async getStats(id: string) {
    try {
      const webhook = await this.prismaRepository.$queryRaw`
        SELECT 
          id, name, enabled, "totalExecutions", "successfulExecutions", 
          "failedExecutions", "lastExecutionAt", "lastExecutionStatus", 
          "lastExecutionError"
        FROM "ExternalWebhook" 
        WHERE id = ${id} 
        LIMIT 1
      `;

      if (!Array.isArray(webhook) || webhook.length === 0) {
        throw new NotFoundException('Webhook não encontrado');
      }

      const stats = webhook[0];
      const successRate =
        stats.totalExecutions > 0 ? ((stats.successfulExecutions / stats.totalExecutions) * 100).toFixed(2) : '0.00';

      return {
        status: 200,
        message: 'Estatísticas do webhook',
        data: {
          ...stats,
          successRate: `${successRate}%`,
        },
      };
    } catch (error) {
      this.logger.error(`Erro ao buscar estatísticas do webhook: ${error.message || error}`);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Erro interno do servidor');
    }
  }

  async testWebhook(id: string, testData: any) {
    try {
      const webhook = await this.prismaRepository.$queryRaw`
        SELECT * FROM "ExternalWebhook" WHERE id = ${id} LIMIT 1
      `;

      if (!Array.isArray(webhook) || webhook.length === 0) {
        throw new NotFoundException('Webhook não encontrado');
      }

      const webhookData = webhook[0];
      const startTime = Date.now();

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'Evolution-API-Webhook/1.0',
          ...JSON.parse(webhookData.headers || '{}'),
        };

        // Configurar autenticação
        this.configureAuthentication(headers, JSON.parse(webhookData.authentication || '{}'));

        const response = await axios.post(
          webhookData.url,
          {
            event: 'webhook_test',
            data: testData || { message: 'Teste de webhook' },
            timestamp: new Date().toISOString(),
            webhook: {
              id: webhookData.id,
              name: webhookData.name,
            },
          },
          {
            headers,
            timeout: webhookData.timeout || 30000,
          },
        );

        const responseTime = Date.now() - startTime;

        // Atualizar estatísticas
        await this.prismaRepository.$queryRaw`
          UPDATE "ExternalWebhook" 
          SET 
            "totalExecutions" = "totalExecutions" + 1,
            "successfulExecutions" = "successfulExecutions" + 1,
            "lastExecutionAt" = NOW(),
            "lastExecutionStatus" = ${response.status},
            "lastExecutionError" = NULL,
            "updatedAt" = NOW()
          WHERE id = ${id}
        `;

        this.logger.log(`Teste de webhook realizado com sucesso: ${id}`);

        return {
          status: 200,
          message: 'Teste de webhook realizado com sucesso',
          data: {
            success: true,
            responseStatus: response.status,
            responseTime: `${responseTime}ms`,
            responseData: response.data,
          },
        };
      } catch (requestError) {
        const responseTime = Date.now() - startTime;
        const errorMessage = requestError.message || 'Erro desconhecido';
        const statusCode = requestError.response?.status || 0;

        // Atualizar estatísticas de erro
        await this.prismaRepository.$queryRaw`
          UPDATE "ExternalWebhook" 
          SET 
            "totalExecutions" = "totalExecutions" + 1,
            "failedExecutions" = "failedExecutions" + 1,
            "lastExecutionAt" = NOW(),
            "lastExecutionStatus" = ${statusCode},
            "lastExecutionError" = ${errorMessage},
            "updatedAt" = NOW()
          WHERE id = ${id}
        `;

        return {
          status: 200,
          message: 'Teste de webhook realizado com erro',
          data: {
            success: false,
            error: errorMessage,
            responseStatus: statusCode,
            responseTime: `${responseTime}ms`,
          },
        };
      }
    } catch (error) {
      this.logger.error(`Erro ao testar webhook: ${error.message || error}`);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Erro interno do servidor');
    }
  }

  private configureAuthentication(headers: Record<string, string>, authConfig: any): void {
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
          const token = this.generateJwtToken(authConfig.jwtSecret);
          headers['Authorization'] = `Bearer ${token}`;
        }
        break;
    }
  }

  private generateJwtToken(secret: string): string {
    const payload = {
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hora
    };

    return jwt.sign(payload, secret);
  }
}
