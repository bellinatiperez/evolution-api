# Sistema de Webhooks Externos

Este documento descreve o sistema de webhooks externos implementado na Evolution API, que permite enviar eventos da aplicação para endpoints externos de forma segura e confiável.

## Visão Geral

O sistema de webhooks externos permite que você configure URLs externas para receber notificações em tempo real sobre eventos que ocorrem na aplicação, como mensagens recebidas, atualizações de conexão, chamadas, etc.

## Características Principais

- ✅ **Múltiplos Webhooks**: Configure vários webhooks para diferentes propósitos
- ✅ **Filtros de Eventos**: Escolha quais eventos cada webhook deve receber
- ✅ **Filtros de Instância**: Configure webhooks para instâncias específicas
- ✅ **Sistema de Retry**: Retry automático com backoff exponencial
- ✅ **Autenticação**: Suporte a Bearer, Basic Auth, API Key e JWT
- ✅ **Segurança**: Validação de assinatura HMAC, whitelist de IPs e rate limiting
- ✅ **Estatísticas**: Monitoramento de performance e taxa de sucesso
- ✅ **Timeout Configurável**: Controle do tempo limite das requisições

## Endpoints da API

### Criar Webhook
```http
POST /external-webhook
Content-Type: application/json

{
  "name": "Meu Webhook",
  "url": "https://meusite.com/webhook",
  "enabled": true,
  "events": ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
  "headers": {
    "User-Agent": "Evolution-API-Webhook"
  },
  "authentication": {
    "type": "bearer",
    "token": "seu-token-aqui"
  },
  "retryConfig": {
    "maxAttempts": 3,
    "initialDelaySeconds": 5,
    "useExponentialBackoff": true
  },
  "securityConfig": {
    "enableSignatureValidation": true,
    "signatureSecret": "sua-chave-secreta-aqui",
    "signatureHeader": "X-Webhook-Signature",
    "signatureAlgorithm": "sha256"
  },
  "filterConfig": {
    "instances": ["instance1", "instance2"]
  },
  "timeout": 30000,
  "description": "Webhook para receber eventos de mensagens"
}
```

### Listar Webhooks
```http
GET /external-webhook
```

### Obter Webhook por ID
```http
GET /external-webhook/:id
```

### Atualizar Webhook
```http
PUT /external-webhook/:id
Content-Type: application/json

{
  "enabled": false,
  "events": ["MESSAGES_UPSERT"]
}
```

### Deletar Webhook
```http
DELETE /external-webhook/:id
```

### Alternar Status (Ativar/Desativar)
```http
PATCH /external-webhook/:id/toggle
```

### Obter Estatísticas
```http
GET /external-webhook/:id/stats
```

## Tipos de Autenticação

### 1. Bearer Token
```json
{
  "authentication": {
    "type": "bearer",
    "token": "seu-bearer-token"
  }
}
```

### 2. Basic Auth
```json
{
  "authentication": {
    "type": "basic",
    "username": "usuario",
    "password": "senha"
  }
}
```

### 3. API Key
```json
{
  "authentication": {
    "type": "api_key",
    "token": "sua-api-key",
    "headerName": "X-API-Key"
  }
}
```

### 4. JWT
```json
{
  "authentication": {
    "type": "jwt",
    "jwtSecret": "sua-chave-jwt"
  }
}
```

## Configurações de Segurança

### Validação de Assinatura HMAC
```json
{
  "securityConfig": {
    "enableSignatureValidation": true,
    "signatureSecret": "sua-chave-secreta-de-pelo-menos-16-caracteres",
    "signatureHeader": "X-Webhook-Signature",
    "signatureAlgorithm": "sha256"
  }
}
```

A assinatura será enviada no formato: `sha256=hash_calculado`

### Whitelist de IPs
```json
{
  "securityConfig": {
    "enableIpWhitelist": true,
    "allowedIps": ["192.168.1.100", "10.0.0.0/8"]
  }
}
```

### Rate Limiting
```json
{
  "securityConfig": {
    "enableRateLimit": true,
    "rateLimitRequests": 100,
    "rateLimitWindowMinutes": 60
  }
}
```

## Eventos Disponíveis

- `APPLICATION_STARTUP` - Inicialização da aplicação
- `INSTANCE_CREATE` - Criação de instância
- `INSTANCE_DELETE` - Exclusão de instância
- `QRCODE_UPDATED` - Atualização do QR Code
- `MESSAGES_SET` - Definição de mensagens
- `MESSAGES_UPSERT` - Inserção/atualização de mensagens
- `MESSAGES_EDITED` - Edição de mensagens
- `MESSAGES_UPDATE` - Atualização de mensagens
- `MESSAGES_DELETE` - Exclusão de mensagens
- `SEND_MESSAGE` - Envio de mensagem
- `SEND_MESSAGE_UPDATE` - Atualização de envio de mensagem
- `CONTACTS_SET` - Definição de contatos
- `CONTACTS_UPDATE` - Atualização de contatos
- `CONTACTS_UPSERT` - Inserção/atualização de contatos
- `PRESENCE_UPDATE` - Atualização de presença
- `CHATS_SET` - Definição de chats
- `CHATS_UPDATE` - Atualização de chats
- `CHATS_DELETE` - Exclusão de chats
- `CHATS_UPSERT` - Inserção/atualização de chats
- `CONNECTION_UPDATE` - Atualização de conexão
- `LABELS_EDIT` - Edição de labels
- `LABELS_ASSOCIATION` - Associação de labels
- `GROUPS_UPSERT` - Inserção/atualização de grupos
- `GROUP_UPDATE` - Atualização de grupo
- `GROUP_PARTICIPANTS_UPDATE` - Atualização de participantes do grupo
- `CALL` - Chamadas
- `TYPEBOT_START` - Início do Typebot
- `TYPEBOT_CHANGE_STATUS` - Mudança de status do Typebot
- `ERRORS` - Erros

## Formato do Payload

Todos os webhooks recebem um payload no seguinte formato:

```json
{
  "instanceName": "nome-da-instancia",
  "event": "MESSAGES_UPSERT",
  "data": {
    // Dados específicos do evento
  },
  "serverUrl": "https://api.evolution.com",
  "dateTime": "2024-01-15T10:30:00.000Z",
  "sender": "evolution-api",
  "apiKey": "sua-api-key",
  "local": "webhook-dispatch",
  "integration": "external-webhook"
}
```

## Sistema de Retry

O sistema implementa retry automático com as seguintes características:

- **Backoff Exponencial**: O delay entre tentativas aumenta exponencialmente
- **Jitter**: Adiciona aleatoriedade para evitar thundering herd
- **Códigos Não-Retryáveis**: Por padrão, não tenta novamente para códigos 400, 401, 403, 404, 422
- **Configurável**: Todos os parâmetros podem ser ajustados por webhook

### Configuração de Retry
```json
{
  "retryConfig": {
    "maxAttempts": 5,
    "initialDelaySeconds": 2,
    "useExponentialBackoff": true,
    "maxDelaySeconds": 300,
    "jitterFactor": 0.3,
    "nonRetryableStatusCodes": [400, 401, 403, 404, 422, 451]
  }
}
```

## Filtros

### Filtro por Instância
```json
{
  "filterConfig": {
    "instances": ["instancia1", "instancia2"],
    "excludeInstances": ["instancia-teste"]
  }
}
```

- `instances`: Lista de instâncias específicas para monitorar (vazio = todas)
- `excludeInstances`: Lista de instâncias para excluir do monitoramento

## Monitoramento e Estatísticas

O sistema coleta estatísticas detalhadas para cada webhook:

```json
{
  "totalRequests": 1500,
  "successfulRequests": 1450,
  "failedRequests": 50,
  "averageResponseTime": 245,
  "lastExecutedAt": "2024-01-15T10:30:00.000Z",
  "lastError": "Connection timeout",
  "successRate": 96.67
}
```

## Validação de Assinatura (Receptor)

Para validar a assinatura HMAC no seu endpoint:

### Node.js
```javascript
const crypto = require('crypto');

function validateSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  const receivedSignature = signature.replace('sha256=', '');
  
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(receivedSignature)
  );
}
```

### Python
```python
import hmac
import hashlib

def validate_signature(payload, signature, secret):
    expected_signature = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    
    received_signature = signature.replace('sha256=', '')
    
    return hmac.compare_digest(expected_signature, received_signature)
```

## Boas Práticas

1. **Use HTTPS**: Sempre configure URLs com HTTPS para segurança
2. **Valide Assinaturas**: Ative a validação de assinatura HMAC
3. **Configure Timeouts**: Use timeouts apropriados (recomendado: 30 segundos)
4. **Monitore Estatísticas**: Acompanhe as métricas de sucesso/falha
5. **Filtre Eventos**: Configure apenas os eventos necessários
6. **Use Rate Limiting**: Configure rate limiting para evitar sobrecarga
7. **Implemente Idempotência**: Seu endpoint deve ser idempotente
8. **Log Adequadamente**: Mantenha logs detalhados para debugging

## Troubleshooting

### Webhook não está recebendo eventos
1. Verifique se o webhook está habilitado (`enabled: true`)
2. Confirme se os eventos estão configurados corretamente
3. Verifique os filtros de instância
4. Teste a conectividade com a URL

### Falhas de autenticação
1. Verifique se o tipo de autenticação está correto
2. Confirme se as credenciais estão válidas
3. Para JWT, verifique se a chave secreta está correta

### Problemas de assinatura
1. Verifique se a chave secreta tem pelo menos 16 caracteres
2. Confirme se o algoritmo está correto (sha256, sha1, md5)
3. Teste a validação da assinatura no seu endpoint

### Rate limiting
1. Verifique se não está excedendo os limites configurados
2. Ajuste os valores de `rateLimitRequests` e `rateLimitWindowMinutes`

## Suporte

Para suporte técnico ou dúvidas sobre a implementação, consulte:
- Documentação da API
- Issues no GitHub
- Canal de suporte da comunidade