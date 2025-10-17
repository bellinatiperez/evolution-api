# Cenários de Teste - Instance Groups

## Cenário 1: Fluxo Completo Básico

### 1.1 Criar Grupo de Instâncias
```bash
POST /instance-group
{
  "name": "Teste Básico",
  "description": "Grupo para teste básico",
  "enabled": true,
  "instances": ["inst1", "inst2", "inst3"]
}
```
**Resultado esperado**: Status 201, grupo criado com ID

### 1.2 Verificar Grupo Criado
```bash
GET /instance-group/{id}
```
**Resultado esperado**: Status 200, dados do grupo retornados

### 1.3 Enviar Mensagens com Balanceamento
```bash
POST /message/sendTextWithGroupBalancing
{
  "groupId": "{id}",
  "number": "5511999999999",
  "text": "Teste 1"
}
```
**Repetir 6 vezes** para testar rotação entre as 3 instâncias

**Resultado esperado**: 
- Mensagem 1 → inst1
- Mensagem 2 → inst2  
- Mensagem 3 → inst3
- Mensagem 4 → inst1 (volta ao início)
- Mensagem 5 → inst2
- Mensagem 6 → inst3

## Cenário 2: Balanceamento por Contato

### 2.1 Mesmo Contato, Múltiplas Mensagens
```bash
# Enviar 3 mensagens para o mesmo número
POST /message/sendTextWithGroupBalancing
{
  "groupId": "{id}",
  "number": "5511111111111",
  "text": "Mensagem 1"
}
```

**Resultado esperado**: Todas as mensagens para o mesmo contato devem usar a mesma instância

### 2.2 Contatos Diferentes
```bash
# Contato 1
POST /message/sendTextWithGroupBalancing
{
  "groupId": "{id}",
  "number": "5511111111111",
  "text": "Para contato 1"
}

# Contato 2  
POST /message/sendTextWithGroupBalancing
{
  "groupId": "{id}",
  "number": "5511222222222", 
  "text": "Para contato 2"
}

# Contato 3
POST /message/sendTextWithGroupBalancing
{
  "groupId": "{id}",
  "number": "5511333333333",
  "text": "Para contato 3"
}
```

**Resultado esperado**: Cada contato deve ser atribuído a uma instância diferente seguindo a rotação

## Cenário 3: Gerenciamento de Instâncias

### 3.1 Adicionar Nova Instância
```bash
POST /instance-group/{id}/instances
{
  "instanceName": "inst4"
}
```

### 3.2 Testar Balanceamento com 4 Instâncias
```bash
# Enviar mensagens para 4 contatos diferentes
POST /message/sendTextWithGroupBalancing
{
  "groupId": "{id}",
  "number": "551144444444X", # X = 1,2,3,4
  "text": "Teste com 4 instâncias"
}
```

**Resultado esperado**: Distribuição entre inst1, inst2, inst3, inst4

### 3.3 Remover Instância
```bash
DELETE /instance-group/{id}/instances
{
  "instanceName": "inst2"
}
```

### 3.4 Testar Balanceamento Após Remoção
**Resultado esperado**: Apenas inst1, inst3, inst4 devem ser usadas

## Cenário 4: Validações e Erros

### 4.1 Criar Grupo Inválido
```bash
POST /instance-group
{
  "name": "",
  "instances": []
}
```
**Resultado esperado**: Status 400, erro de validação

### 4.2 Grupo Não Encontrado
```bash
GET /instance-group/uuid-inexistente
```
**Resultado esperado**: Status 404

### 4.3 Enviar Mensagem para Grupo Inexistente
```bash
POST /message/sendTextWithGroupBalancing
{
  "groupId": "uuid-inexistente",
  "number": "5511999999999",
  "text": "Teste"
}
```
**Resultado esperado**: Status 404

### 4.4 Grupo Desabilitado
```bash
PUT /instance-group/{id}
{
  "enabled": false
}

POST /message/sendTextWithGroupBalancing
{
  "groupId": "{id}",
  "number": "5511999999999", 
  "text": "Teste"
}
```
**Resultado esperado**: Status 400, grupo desabilitado

## Cenário 5: Performance e Concorrência

### 5.1 Múltiplas Mensagens Simultâneas
```bash
# Enviar 10 mensagens simultaneamente para contatos diferentes
# Usar ferramentas como Apache Bench ou scripts paralelos
```

**Resultado esperado**: 
- Todas as mensagens processadas
- Distribuição equilibrada entre instâncias
- Sem conflitos de concorrência

### 5.2 Mesmo Contato, Mensagens Simultâneas
```bash
# Enviar 5 mensagens simultaneamente para o mesmo contato
```

**Resultado esperado**: Todas as mensagens para a mesma instância

## Cenário 6: Persistência de Dados

### 6.1 Reiniciar Servidor
```bash
# 1. Criar grupo e enviar mensagens
# 2. Reiniciar servidor
# 3. Enviar mais mensagens
```

**Resultado esperado**: 
- Dados do grupo mantidos
- Rotação continua de onde parou
- Mapeamento contato-instância preservado

## Scripts de Teste Automatizado

### Script Bash para Teste Básico
```bash
#!/bin/bash
BASE_URL="http://localhost:8080"
API_KEY="sua-api-key"

# Criar grupo
GROUP_ID=$(curl -s -X POST "$BASE_URL/instance-group" \
  -H "Content-Type: application/json" \
  -H "apikey: $API_KEY" \
  -d '{"name":"Teste Auto","instances":["inst1","inst2","inst3"]}' \
  | jq -r '.id')

echo "Grupo criado: $GROUP_ID"

# Testar balanceamento
for i in {1..6}; do
  echo "Enviando mensagem $i"
  curl -s -X POST "$BASE_URL/message/sendTextWithGroupBalancing" \
    -H "Content-Type: application/json" \
    -H "apikey: $API_KEY" \
    -d "{\"groupId\":\"$GROUP_ID\",\"number\":\"551199999999$i\",\"text\":\"Teste $i\"}"
  sleep 1
done
```

### Script Python para Teste de Concorrência
```python
import requests
import threading
import time

BASE_URL = "http://localhost:8080"
API_KEY = "sua-api-key"
GROUP_ID = "seu-group-id"

def send_message(contact_num):
    payload = {
        "groupId": GROUP_ID,
        "number": f"5511{contact_num:08d}",
        "text": f"Mensagem concorrente {contact_num}"
    }
    
    response = requests.post(
        f"{BASE_URL}/message/sendTextWithGroupBalancing",
        json=payload,
        headers={"apikey": API_KEY}
    )
    
    print(f"Contato {contact_num}: Status {response.status_code}")

# Enviar 20 mensagens simultaneamente
threads = []
for i in range(20):
    thread = threading.Thread(target=send_message, args=(i,))
    threads.append(thread)
    thread.start()

for thread in threads:
    thread.join()

print("Teste de concorrência finalizado")
```

## Métricas de Validação

### 1. Distribuição de Carga
- Verificar se as mensagens são distribuídas igualmente entre instâncias
- Tolerância: ±10% de diferença entre instâncias

### 2. Consistência por Contato
- 100% das mensagens do mesmo contato devem usar a mesma instância

### 3. Performance
- Tempo de resposta < 500ms por mensagem
- Suporte a pelo menos 100 mensagens/minuto

### 4. Disponibilidade
- Sistema deve funcionar mesmo com instâncias indisponíveis
- Redistribuição automática quando instâncias são removidas