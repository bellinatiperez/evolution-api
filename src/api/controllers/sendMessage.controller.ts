import { InstanceDto } from '@api/dto/instance.dto';
import { SendTextWithGroupBalancingDto } from '@api/dto/instanceGroup.dto';
import {
  SendAudioDto,
  SendButtonsDto,
  SendContactDto,
  SendListDto,
  SendLocationDto,
  SendMediaDto,
  SendPollDto,
  SendPtvDto,
  SendReactionDto,
  SendStatusDto,
  SendStickerDto,
  SendTemplateDto,
  SendTextDto,
} from '@api/dto/sendMessage.dto';
import { CacheService } from '@api/services/cache.service';
import { InstanceGroupService } from '@api/services/instanceGroup.service';
import { WAMonitoringService } from '@api/services/monitor.service';
import { Logger } from '@config/logger.config';
import { BadRequestException, InternalServerErrorException } from '@exceptions';
import { isBase64, isURL } from 'class-validator';
import emojiRegex from 'emoji-regex';

const regex = emojiRegex();

function isEmoji(str: string) {
  if (str === '') return true;

  const match = str.match(regex);
  return match?.length === 1 && match[0] === str;
}

export class SendMessageController {
  private readonly logger = new Logger('SendMessageController');

  // Configurações de cache para rotação de instâncias
  private readonly CACHE_KEY_PREFIX = 'instance_rotation';
  private readonly CACHE_TTL = 24 * 60 * 60; // 24 horas em segundos
  private readonly GLOBAL_CACHE_KEY = 'global_rotation';
  private readonly GROUP_CACHE_KEY_PREFIX = 'group_rotation';

  // Fallback em memória quando o cache não está habilitado
  private rotationMemory = new Map<
    string,
    {
      usedInstances: Set<string>;
      lastUsedInstance: string | null;
      rotationCount: number;
    }
  >();

  // Estado global em memória para evitar repetição imediata de instância
  private globalRotationMemory: {
    lastUsedInstance: string | null;
    rotationCount: number;
  } = { lastUsedInstance: null, rotationCount: 0 };

  constructor(
    private readonly waMonitor: WAMonitoringService,
    private readonly cache: CacheService,
    private readonly instanceGroupService?: InstanceGroupService,
  ) {}

  public async sendTemplate({ instanceName }: InstanceDto, data: SendTemplateDto) {
    return await this.waMonitor.waInstances[instanceName].templateMessage(data);
  }

  public async sendText({ instanceName }: InstanceDto, data: SendTextDto) {
    return await this.waMonitor.waInstances[instanceName].textMessage(data);
  }

  public async sendMedia({ instanceName }: InstanceDto, data: SendMediaDto, file?: any) {
    if (isBase64(data?.media) && !data?.fileName && data?.mediatype === 'document') {
      throw new BadRequestException('For base64 the file name must be informed.');
    }

    if (file || isURL(data?.media) || isBase64(data?.media)) {
      return await this.waMonitor.waInstances[instanceName].mediaMessage(data, file);
    }
    throw new BadRequestException('Owned media must be a url or base64');
  }

  public async sendPtv({ instanceName }: InstanceDto, data: SendPtvDto, file?: any) {
    if (file || isURL(data?.video) || isBase64(data?.video)) {
      return await this.waMonitor.waInstances[instanceName].ptvMessage(data, file);
    }
    throw new BadRequestException('Owned media must be a url or base64');
  }

  public async sendSticker({ instanceName }: InstanceDto, data: SendStickerDto, file?: any) {
    if (file || isURL(data.sticker) || isBase64(data.sticker)) {
      return await this.waMonitor.waInstances[instanceName].mediaSticker(data, file);
    }
    throw new BadRequestException('Owned media must be a url or base64');
  }

  public async sendWhatsAppAudio({ instanceName }: InstanceDto, data: SendAudioDto, file?: any) {
    if (file?.buffer || isURL(data.audio) || isBase64(data.audio)) {
      // Si file existe y tiene buffer, o si es una URL o Base64, continúa
      return await this.waMonitor.waInstances[instanceName].audioWhatsapp(data, file);
    } else {
      console.error('El archivo no tiene buffer o el audio no es una URL o Base64 válida');
      throw new BadRequestException('Owned media must be a url, base64, or valid file with buffer');
    }
  }

  public async sendButtons({ instanceName }: InstanceDto, data: SendButtonsDto) {
    return await this.waMonitor.waInstances[instanceName].buttonMessage(data);
  }

  public async sendLocation({ instanceName }: InstanceDto, data: SendLocationDto) {
    return await this.waMonitor.waInstances[instanceName].locationMessage(data);
  }

  public async sendList({ instanceName }: InstanceDto, data: SendListDto) {
    return await this.waMonitor.waInstances[instanceName].listMessage(data);
  }

  public async sendContact({ instanceName }: InstanceDto, data: SendContactDto) {
    return await this.waMonitor.waInstances[instanceName].contactMessage(data);
  }

  public async sendReaction({ instanceName }: InstanceDto, data: SendReactionDto) {
    if (!isEmoji(data.reaction)) {
      throw new BadRequestException('Reaction must be a single emoji or empty string');
    }
    return await this.waMonitor.waInstances[instanceName].reactionMessage(data);
  }

  public async sendPoll({ instanceName }: InstanceDto, data: SendPollDto) {
    return await this.waMonitor.waInstances[instanceName].pollMessage(data);
  }

  public async sendStatus({ instanceName }: InstanceDto, data: SendStatusDto, file?: any) {
    return await this.waMonitor.waInstances[instanceName].statusMessage(data, file);
  }

  /**
   * Envia mensagem de texto com balanceamento automático de instâncias
   */
  public async sendTextWithBalancing(data: SendTextDto) {
    try {
      this.logger.info(`Iniciando envio com balanceamento para contato: ${JSON.stringify(data.number)}`);

      // Obter instâncias disponíveis
      const availableInstances = this.getAvailableInstances();

      if (availableInstances.length === 0) {
        throw new InternalServerErrorException('Nenhuma instância disponível para envio');
      }

      // Selecionar instância usando algoritmo de balanceamento
      const selectedInstance = await this.selectInstanceForContact(data.number, availableInstances);

      this.logger.info(`Instância selecionada: ${selectedInstance} para contato: ${JSON.stringify(data.number)}`);

      // Enviar mensagem usando a instância selecionada
      const result = await this.waMonitor.waInstances[selectedInstance].textMessage(data);

      this.logger.info(`Mensagem enviada com sucesso via instância: ${selectedInstance}`);

      return {
        ...result,
        instanceUsed: selectedInstance,
        balancingInfo: await this.getContactBalancingInfo(data.number),
      };
    } catch (error) {
      this.logger.error(`Erro no envio com balanceamento: ${JSON.stringify(error.message)}`);
      throw error;
    }
  }

  /**
   * Envia mensagem de texto com balanceamento automático de instâncias por grupo
   */
  public async sendTextWithGroupBalancing(data: SendTextWithGroupBalancingDto) {
    try {
      this.logger.info(`Iniciando envio com balanceamento por grupo: ${data.alias} para contato: ${data.number}`);

      if (!this.instanceGroupService) {
        throw new InternalServerErrorException('Instance Group Service não está disponível');
      }

      // Buscar o grupo pelo alias
      const group = await this.instanceGroupService.findByAlias(data.alias);

      // Obter instâncias ativas do grupo
      const groupInstances = await this.instanceGroupService.getActiveInstances(group.id);

      if (groupInstances.length === 0) {
        throw new BadRequestException('Nenhuma instância ativa encontrada no grupo especificado');
      }

      // Selecionar instância usando algoritmo de balanceamento específico do grupo
      const selectedInstance = await this.selectInstanceForContactInGroup(data.number, groupInstances, group.id);

      this.logger.info(
        `Instância selecionada: ${selectedInstance} para contato: ${data.number} no grupo: ${data.alias}`,
      );

      // Preparar dados para envio
      const sendData: SendTextDto = {
        number: data.number,
        text: data.text,
        delay: data.delay,
        quoted: data.quoted,
        linkPreview: data.linkPreview,
        mentionsEveryOne: data.mentionsEveryOne,
        mentioned: data.mentioned,
      };

      // Enviar mensagem usando a instância selecionada
      const result = await this.waMonitor.waInstances[selectedInstance].textMessage(sendData);

      this.logger.info(`Mensagem enviada com sucesso via instância: ${selectedInstance} (grupo: ${data.alias})`);

      return {
        ...result,
        instanceUsed: selectedInstance,
        groupId: group.id,
        groupAlias: data.alias,
        balancingInfo: await this.getContactBalancingInfoInGroup(data.number, group.id),
      };
    } catch (error) {
      this.logger.error(`Erro no envio com balanceamento por grupo: ${error.message}`);
      throw error;
    }
  }

  /**
   * Seleciona instância para contato dentro de um grupo específico
   */
  private async selectInstanceForContactInGroup(
    contact: string,
    groupInstances: string[],
    groupId: string,
  ): Promise<string> {
    const contactKey = `${this.GROUP_CACHE_KEY_PREFIX}:${groupId}:${contact}`;
    const globalKey = `${this.GROUP_CACHE_KEY_PREFIX}:${groupId}:global`;

    // Obter dados de rotação do contato no grupo
    const contactRotationData = (await this.getRotationDataFromCache(contactKey)) || {
      usedInstances: new Set<string>(),
      lastUsedInstance: null,
      rotationCount: 0,
    };
    const globalRotationData = (await this.getGlobalRotationData()) || {
      lastUsedInstance: null,
      rotationCount: 0,
    };

    // Ordenar instâncias para garantir ordem consistente
    const orderedInstances = [...groupInstances].sort();

    // Calcular próxima instância global
    const currentGlobalIndex = globalRotationData.lastUsedInstance
      ? orderedInstances.indexOf(globalRotationData.lastUsedInstance)
      : -1;
    const nextGlobalIndex = (currentGlobalIndex + 1) % orderedInstances.length;
    const nextGlobalInstance = orderedInstances[nextGlobalIndex];

    let selectedInstance: string;

    // Verificar se o contato pode usar a próxima instância global
    if (
      nextGlobalInstance !== contactRotationData.lastUsedInstance &&
      !contactRotationData.usedInstances.has(nextGlobalInstance)
    ) {
      // Usar a próxima instância global
      selectedInstance = nextGlobalInstance;
    } else {
      // Encontrar primeira instância disponível que não seja a última usada pelo contato
      selectedInstance =
        orderedInstances.find(
          (instance) =>
            instance !== contactRotationData.lastUsedInstance && !contactRotationData.usedInstances.has(instance),
        ) ||
        orderedInstances.find((instance) => instance !== contactRotationData.lastUsedInstance) ||
        orderedInstances[0];
    }

    // Atualizar dados de rotação do contato
    const newUsedInstances = new Set(contactRotationData.usedInstances);
    newUsedInstances.add(selectedInstance);

    // Reset do ciclo se todas as instâncias foram usadas
    if (newUsedInstances.size >= orderedInstances.length) {
      newUsedInstances.clear();
      newUsedInstances.add(selectedInstance);
    }

    const newContactRotationData = {
      usedInstances: newUsedInstances,
      lastUsedInstance: selectedInstance,
      rotationCount: contactRotationData.rotationCount + 1,
    };

    // Atualizar dados globais
    const newGlobalRotationData = {
      lastUsedInstance: selectedInstance,
      rotationCount: globalRotationData.rotationCount + 1,
    };

    // Salvar no cache
    await this.saveRotationDataToCache(contactKey, newContactRotationData);
    await this.saveGlobalRotationData(newGlobalRotationData);

    return selectedInstance;
  }

  /**
   * Obtém informações de balanceamento para um contato em um grupo específico
   */
  private async getContactBalancingInfoInGroup(contact: string, groupId: string) {
    const contactKey = `${this.GROUP_CACHE_KEY_PREFIX}:${groupId}:${contact}`;
    const globalKey = `${this.GROUP_CACHE_KEY_PREFIX}:${groupId}:global`;

    const contactData = await this.getRotationDataFromCache(contactKey);
    const globalData = await this.getGlobalRotationData();

    return {
      contact,
      groupId,
      lastUsedInstance: contactData.lastUsedInstance,
      usedInstancesInCycle: Array.from(contactData.usedInstances),
      rotationCount: contactData.rotationCount,
      globalLastUsedInstance: globalData.lastUsedInstance,
      globalRotationCount: globalData.rotationCount,
    };
  }

  /**
   * Obtém lista de instâncias disponíveis (conectadas)
   */
  private getAvailableInstances(): string[] {
    const allInstances = Object.keys(this.waMonitor.waInstances);
    return allInstances.filter((instanceName) => {
      const instance = this.waMonitor.waInstances[instanceName];
      return instance && instance.connectionStatus?.state === 'open';
    });
  }

  /**
   * Seleciona instância para contato usando algoritmo de rotação
   */
  private async selectInstanceForContact(contactNumber: string, availableInstances: string[]): Promise<string> {
    const normalizedContact = this.normalizeContactNumber(contactNumber);

    // Ordenar instâncias para garantir ordem consistente
    const sortedInstances = [...availableInstances].sort();

    // Obter ou criar informações de rotação para o contato
    let rotationInfo = await this.getRotationDataFromCache(normalizedContact);

    if (!rotationInfo) {
      rotationInfo = {
        usedInstances: new Set(),
        lastUsedInstance: null,
        rotationCount: 0,
      };
    }

    // Se todas as instâncias foram usadas, resetar o ciclo
    if (rotationInfo.usedInstances.size >= sortedInstances.length) {
      this.logger.info(`Resetando ciclo de rotação para contato: ${normalizedContact}`);
      rotationInfo.usedInstances.clear();
      rotationInfo.rotationCount++;
    }

    // Seleção baseada em round-robin global + restrições do contato
    let selectedInstance: string | undefined;
    const globalRotation = await this.getGlobalRotationData();

    // Calcular ponto de partida global (sempre avançar para próxima instância global)
    let globalNextIndex = 0;
    if (globalRotation?.lastUsedInstance) {
      const globalLastIndex = sortedInstances.indexOf(globalRotation.lastUsedInstance);
      globalNextIndex = globalLastIndex >= 0 ? (globalLastIndex + 1) % sortedInstances.length : 0;
    }

    // Primeiro passe: respeitar ambos critérios (diferente da última do contato e não usada no ciclo)
    for (let i = 0; i < sortedInstances.length; i++) {
      const idx = (globalNextIndex + i) % sortedInstances.length;
      const candidate = sortedInstances[idx];
      const notSameAsLastContact = candidate !== rotationInfo.lastUsedInstance;
      const notUsedInCycle = !rotationInfo.usedInstances.has(candidate);

      if (notSameAsLastContact && notUsedInCycle) {
        selectedInstance = candidate;
        break;
      }
    }

    // Segundo passe (fallback): respeitar critério do contato (não repetir consecutivamente), mesmo que já usado no ciclo
    if (!selectedInstance) {
      for (let i = 0; i < sortedInstances.length; i++) {
        const idx = (globalNextIndex + i) % sortedInstances.length;
        const candidate = sortedInstances[idx];
        const notSameAsLastContact = candidate !== rotationInfo.lastUsedInstance;
        if (notSameAsLastContact) {
          selectedInstance = candidate;
          break;
        }
      }
    }

    // Último fallback: usar o globalNext mesmo que seja a única opção
    if (!selectedInstance) {
      selectedInstance = sortedInstances[globalNextIndex];
    }

    // Atualizar informações de rotação
    rotationInfo.usedInstances.add(selectedInstance);
    rotationInfo.lastUsedInstance = selectedInstance;

    // Salvar no cache
    await this.saveRotationDataToCache(normalizedContact, rotationInfo);

    // Atualizar rotação global (sempre avança para a instância selecionada)
    await this.saveGlobalRotationData({
      lastUsedInstance: selectedInstance,
      rotationCount: (globalRotation?.rotationCount ?? 0) + 1,
    });

    this.logger.info(
      `Seleção de instância - Contato: ${normalizedContact}, Instância: ${selectedInstance}, Ciclo: ${rotationInfo.rotationCount}, Usadas: ${rotationInfo.usedInstances.size}/${sortedInstances.length}`,
    );

    return selectedInstance;
  }

  /**
   * Normaliza número de contato removendo caracteres especiais
   */
  private normalizeContactNumber(contactNumber: string): string {
    return contactNumber.replace(/[^\d]/g, '');
  }

  /**
   * Obtém informações de balanceamento para um contato
   */
  private async getContactBalancingInfo(contactNumber: string) {
    const normalizedContact = this.normalizeContactNumber(contactNumber);
    const rotationInfo = await this.getRotationDataFromCache(normalizedContact);

    if (!rotationInfo) {
      return {
        rotationCount: 0,
        usedInstancesInCycle: 0,
        lastUsedInstance: null,
      };
    }

    return {
      rotationCount: rotationInfo.rotationCount,
      usedInstancesInCycle: rotationInfo.usedInstances.size,
      lastUsedInstance: rotationInfo.lastUsedInstance,
    };
  }

  /**
   * Salva dados de rotação no cache
   */
  private async saveRotationDataToCache(
    contactNumber: string,
    data: {
      usedInstances: Set<string>;
      lastUsedInstance: string | null;
      rotationCount: number;
    },
  ): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_KEY_PREFIX}:${contactNumber}`;
      const cacheData = {
        usedInstances: Array.from(data.usedInstances),
        lastUsedInstance: data.lastUsedInstance,
        rotationCount: data.rotationCount,
        lastUpdated: new Date().toISOString(),
      };

      await this.cache.set(cacheKey, cacheData, this.CACHE_TTL);

      // Atualiza fallback em memória
      this.rotationMemory.set(contactNumber, {
        usedInstances: new Set(data.usedInstances),
        lastUsedInstance: data.lastUsedInstance,
        rotationCount: data.rotationCount,
      });
    } catch (error) {
      this.logger.error(`Erro ao salvar dados de rotação no cache: ${error}`);
      // Em caso de erro, os dados são perdidos mas o sistema continua funcionando
      // pois cada contato será tratado como novo na próxima chamada
    }
  }

  /**
   * Recupera dados de rotação do cache
   */
  private async getRotationDataFromCache(contactNumber: string): Promise<{
    usedInstances: Set<string>;
    lastUsedInstance: string | null;
    rotationCount: number;
  } | null> {
    try {
      const cacheKey = `${this.CACHE_KEY_PREFIX}:${contactNumber}`;
      const cacheData = await this.cache.get(cacheKey);

      if (cacheData) {
        return {
          usedInstances: new Set(cacheData.usedInstances || []),
          lastUsedInstance: cacheData.lastUsedInstance || null,
          rotationCount: cacheData.rotationCount || 0,
        };
      }

      // Fallback em memória quando cache não está habilitado
      const mem = this.rotationMemory.get(contactNumber);
      if (mem) {
        return {
          usedInstances: new Set(mem.usedInstances),
          lastUsedInstance: mem.lastUsedInstance,
          rotationCount: mem.rotationCount,
        };
      }

      return null;
    } catch (error) {
      this.logger.error(`Erro ao recuperar dados de rotação do cache: ${error}`);
      // Em caso de erro, retorna null para que o contato seja tratado como novo
      return null;
    }
  }

  /**
   * Salva dados de rotação global (última instância usada)
   */
  private async saveGlobalRotationData(data: { lastUsedInstance: string | null; rotationCount: number }) {
    try {
      const cacheData = {
        lastUsedInstance: data.lastUsedInstance,
        rotationCount: data.rotationCount,
        lastUpdated: new Date().toISOString(),
      };

      await this.cache.set(this.GLOBAL_CACHE_KEY, cacheData, this.CACHE_TTL);

      // Atualiza fallback em memória
      this.globalRotationMemory = {
        lastUsedInstance: data.lastUsedInstance,
        rotationCount: data.rotationCount,
      };
    } catch (error) {
      this.logger.error(`Erro ao salvar dados de rotação global no cache: ${error}`);
    }
  }

  /**
   * Recupera dados de rotação global (última instância usada)
   */
  private async getGlobalRotationData(): Promise<{ lastUsedInstance: string | null; rotationCount: number } | null> {
    try {
      const cacheData = await this.cache.get(this.GLOBAL_CACHE_KEY);
      if (cacheData) {
        return {
          lastUsedInstance: cacheData.lastUsedInstance || null,
          rotationCount: cacheData.rotationCount || 0,
        };
      }

      // Fallback em memória
      return {
        lastUsedInstance: this.globalRotationMemory.lastUsedInstance,
        rotationCount: this.globalRotationMemory.rotationCount,
      };
    } catch (error) {
      this.logger.error(`Erro ao recuperar rotação global do cache: ${error}`);
      return null;
    }
  }

  /**
   * Remove dados de rotação do cache
   */
  private async removeRotationDataFromCache(contactNumber: string): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_KEY_PREFIX}:${contactNumber}`;
      await this.cache.delete(cacheKey);

      // Remover também do fallback em memória
      this.rotationMemory.delete(contactNumber);
    } catch (error) {
      this.logger.error(`Erro ao remover dados de rotação do cache: ${error}`);
      // Em caso de erro, os dados permanecerão no cache até expirarem pelo TTL
    }
  }
}
