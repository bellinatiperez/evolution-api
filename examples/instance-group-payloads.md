# Exemplos de Payloads - API Instance Groups

## 1. Criar Grupo de Instâncias
**POST** `/instance-group`

```json
{
  "name": "Grupo Vendas",
  "description": "Grupo para equipe de vendas com balanceamento automático",
  "enabled": true,
  "instances": [
    "vendedor1",
    "vendedor2", 
    "vendedor3"
  ]
}
```

## 2. Listar Grupos de Instâncias
**GET** `/instance-group`

*Sem payload - apenas GET request*

**Resposta esperada:**
```json
[
  {
    "id": "uuid-do-grupo",
    "name": "Grupo Vendas",
    "description": "Grupo para equipe de vendas com balanceamento automático",
    "enabled": true,
    "instances": ["vendedor1", "vendedor2", "vendedor3"],
    "createdAt": "2025-10-15T18:00:00.000Z",
    "updatedAt": "2025-10-15T18:00:00.000Z"
  }
]
```

## 3. Obter Grupo Específico
**GET** `/instance-group/{id}`

*Sem payload - apenas GET request com ID na URL*

**Resposta esperada:**
```json
{
  "id": "uuid-do-grupo",
  "name": "Grupo Vendas",
  "description": "Grupo para equipe de vendas com balanceamento automático",
  "enabled": true,
  "instances": ["vendedor1", "vendedor2", "vendedor3"],
  "createdAt": "2025-10-15T18:00:00.000Z",
  "updatedAt": "2025-10-15T18:00:00.000Z"
}
```

## 4. Atualizar Grupo de Instâncias
**PUT** `/instance-group/{id}`

```json
{
  "name": "Grupo Vendas Atualizado",
  "description": "Descrição atualizada do grupo",
  "enabled": false,
  "instances": [
    "vendedor1",
    "vendedor2",
    "vendedor3",
    "vendedor4"
  ]
}
```

## 5. Deletar Grupo de Instâncias
**DELETE** `/instance-group/{id}`

*Sem payload - apenas DELETE request com ID na URL*

## 6. Adicionar Instância ao Grupo
**POST** `/instance-group/{id}/instances`

```json
{
  "instanceName": "vendedor5"
}
```

## 7. Remover Instância do Grupo
**DELETE** `/instance-group/{id}/instances`

```json
{
  "instanceName": "vendedor2"
}
```

## 8. Enviar Mensagem com Balanceamento
**POST** `/message/sendTextWithGroupBalancing`

```json
{
  "groupId": "uuid-do-grupo",
  "number": "5511999999999",
  "text": "Olá! Esta mensagem foi enviada com balanceamento automático entre as instâncias do grupo.",
  "delay": 1000,
  "quoted": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "message-id"
    }
  },
  "mentionsEveryOne": false,
  "mentioned": []
}
```

## Exemplos de Uso com cURL

### Criar Grupo
```bash
curl -X POST http://localhost:8080/instance-group \
  -H "Content-Type: application/json" \
  -H "apikey: SUA_API_KEY" \
  -d '{
    "name": "Grupo Vendas",
    "description": "Grupo para equipe de vendas",
    "enabled": true,
    "instances": ["vendedor1", "vendedor2", "vendedor3"]
  }'
```

### Enviar Mensagem com Balanceamento
```bash
curl -X POST http://localhost:8080/message/sendTextWithGroupBalancing \
  -H "Content-Type: application/json" \
  -H "apikey: SUA_API_KEY" \
  -d '{
    "groupId": "uuid-do-grupo",
    "number": "5511999999999",
    "text": "Mensagem com balanceamento automático"
  }'
```

## Códigos de Resposta HTTP

- **200 OK**: Operação realizada com sucesso
- **201 Created**: Recurso criado com sucesso
- **400 Bad Request**: Dados inválidos no payload
- **401 Unauthorized**: API key inválida ou ausente
- **404 Not Found**: Grupo não encontrado
- **500 Internal Server Error**: Erro interno do servidor

## Validações dos Payloads

### Criar/Atualizar Grupo:
- `name`: Obrigatório, string de 1-100 caracteres
- `description`: Opcional, string até 500 caracteres
- `enabled`: Opcional, boolean (padrão: true)
- `instances`: Obrigatório, array com pelo menos 1 instância, nomes únicos

### Adicionar/Remover Instância:
- `instanceName`: Obrigatório, string não vazia

### Enviar Mensagem:
- `groupId`: Obrigatório, UUID válido do grupo
- `number`: Obrigatório, número de telefone válido
- `text`: Obrigatório, texto da mensagem
- `delay`: Opcional, número em milissegundos