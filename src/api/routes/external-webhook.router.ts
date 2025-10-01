import { RouterBroker } from '@api/abstract/abstract.router';
import { ExternalWebhookDto, ExternalWebhookUpdateDto } from '@api/dto/external-webhook.dto';
import { externalWebhookController } from '@api/server.module';
import { externalWebhookSchema, externalWebhookUpdateSchema } from '@validate/validate.schema';
import { RequestHandler, Router } from 'express';

import { HttpStatus } from './index.router';

export class ExternalWebhookRouter extends RouterBroker {
  constructor(...guards: RequestHandler[]) {
    super();
    this.router
      .post(this.routerPath('create', false), ...guards, async (req, res) => {
        const response = await this.dataValidate<ExternalWebhookDto>({
          request: req,
          schema: externalWebhookSchema,
          ClassRef: ExternalWebhookDto,
          execute: (_, data) => externalWebhookController.create(data),
        });

        res.status(HttpStatus.CREATED).json(response);
      })
      .get(this.routerPath('find', false), ...guards, async (req, res) => {
        const response = await externalWebhookController.findAll();
        res.status(HttpStatus.OK).json(response);
      })
      .get(this.routerPath('find/:id', false), ...guards, async (req, res) => {
        const response = await externalWebhookController.findById(req.params.id);
        res.status(HttpStatus.OK).json(response);
      })
      .put(this.routerPath('update/:id', false), ...guards, async (req, res) => {
        const response = await this.dataValidate<ExternalWebhookUpdateDto>({
          request: req,
          schema: externalWebhookUpdateSchema,
          ClassRef: ExternalWebhookUpdateDto,
          execute: (_, data) => externalWebhookController.update(req.params.id, data),
        });

        res.status(HttpStatus.OK).json(response);
      })
      .delete(this.routerPath('delete/:id', false), ...guards, async (req, res) => {
        const response = await externalWebhookController.delete(req.params.id);
        res.status(HttpStatus.OK).json(response);
      })
      .patch(this.routerPath('toggle/:id', false), ...guards, async (req, res) => {
        const response = await externalWebhookController.toggleEnabled(req.params.id);
        res.status(HttpStatus.OK).json(response);
      })
      .get(this.routerPath('stats/:id', false), ...guards, async (req, res) => {
        const response = await externalWebhookController.getStats(req.params.id);
        res.status(HttpStatus.OK).json(response);
      })
      .post(this.routerPath('test/:id', false), ...guards, async (req, res) => {
        const response = await externalWebhookController.testWebhook(req.params.id, req.body);
        res.status(HttpStatus.OK).json(response);
      });
  }

  public readonly router: Router = Router();
}
