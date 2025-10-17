import { RouterBroker } from '@api/abstract/abstract.router';
import { InstanceGroupController } from '@api/controllers/instanceGroup.controller';
import { InstanceDto } from '@api/dto/instance.dto';
import {
  AddInstanceToGroupDto,
  CreateInstanceGroupDto,
  RemoveInstanceFromGroupDto,
  UpdateInstanceGroupDto,
} from '@api/dto/instanceGroup.dto';
import { instanceGroupController } from '@api/server.module';
import {
  addInstanceToGroupSchema,
  instanceGroupSchema,
  removeInstanceFromGroupSchema,
  updateInstanceGroupSchema,
} from '@validate/instanceGroup.schema';
import { RequestHandler, Router } from 'express';

import { HttpStatus } from './index.router';

export class InstanceGroupRouter extends RouterBroker {
  constructor(...guards: RequestHandler[]) {
    super();
    this.router
      .post('/', ...guards, async (req, res) => {
        const response = await this.dataValidate<CreateInstanceGroupDto>({
          request: req,
          schema: instanceGroupSchema,
          ClassRef: CreateInstanceGroupDto,
          execute: (instance: InstanceDto, data: CreateInstanceGroupDto) => instanceGroupController.create(data),
        });

        return res.status(HttpStatus.CREATED).json(response);
      })
      .get('/', ...guards, async (req, res) => {
        const response = await instanceGroupController.findAll();
        return res.status(HttpStatus.OK).json(response);
      })
      .get('/:id', ...guards, async (req, res) => {
        const response = await instanceGroupController.findById(req.params.id);
        return res.status(HttpStatus.OK).json(response);
      })
      .get('/name/:name', ...guards, async (req, res) => {
        const response = await instanceGroupController.findByName(req.params.name);
        return res.status(HttpStatus.OK).json(response);
      })
      .get('/alias/:alias', ...guards, async (req, res) => {
        const response = await instanceGroupController.findByAlias(req.params.alias);
        return res.status(HttpStatus.OK).json(response);
      })
      .put('/:id', ...guards, async (req, res) => {
        const response = await this.dataValidate<UpdateInstanceGroupDto>({
          request: req,
          schema: updateInstanceGroupSchema,
          ClassRef: UpdateInstanceGroupDto,
          execute: (instance: InstanceDto, data: UpdateInstanceGroupDto) =>
            instanceGroupController.update(req.params.id, data),
        });

        return res.status(HttpStatus.OK).json(response);
      })
      .delete('/:id', ...guards, async (req, res) => {
        const response = await instanceGroupController.delete(req.params.id);
        return res.status(HttpStatus.OK).json(response);
      })
      .post('/:id/addInstance', ...guards, async (req, res) => {
        const response = await this.dataValidate<AddInstanceToGroupDto>({
          request: req,
          schema: addInstanceToGroupSchema,
          ClassRef: AddInstanceToGroupDto,
          execute: (data) => instanceGroupController.addInstance(req.params.id, data),
        });

        return res.status(HttpStatus.OK).json(response);
      })
      .post('/:id/removeInstance', ...guards, async (req, res) => {
        const response = await this.dataValidate<RemoveInstanceFromGroupDto>({
          request: req,
          schema: removeInstanceFromGroupSchema,
          ClassRef: RemoveInstanceFromGroupDto,
          execute: (data) => instanceGroupController.removeInstance(req.params.id, data),
        });

        return res.status(HttpStatus.OK).json(response);
      })
      .get('/:id/activeInstances', ...guards, async (req, res) => {
        const response = await instanceGroupController.getActiveInstances(req.params.id);
        return res.status(HttpStatus.OK).json(response);
      })
      .get('/:id/stats', ...guards, async (req, res) => {
        const response = await instanceGroupController.getGroupStats(req.params.id);
        return res.status(HttpStatus.OK).json(response);
      });
  }

  public readonly router = Router();
}
