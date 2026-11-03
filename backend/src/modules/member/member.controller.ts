import { Request, Response } from 'express';
import { memberService } from './member.service';
import {
  AddressInput,
  LoginInput,
  RefreshInput,
  RegisterInput,
  UpdateProfileInput,
} from './member.schema';

export const memberController = {
  async register(req: Request, res: Response): Promise<void> {
    res.status(201).json(await memberService.register(req.body as RegisterInput));
  },
  async login(req: Request, res: Response): Promise<void> {
    res.status(200).json(await memberService.login(req.body as LoginInput));
  },
  async refresh(req: Request, res: Response): Promise<void> {
    res.status(200).json(await memberService.refresh((req.body as RefreshInput).refreshToken));
  },
  async logout(req: Request, res: Response): Promise<void> {
    await memberService.logout(req.user!.id, (req.body as RefreshInput).refreshToken);
    res.status(204).send();
  },
  async getMe(req: Request, res: Response): Promise<void> {
    res.status(200).json(await memberService.getProfile(req.user!.id));
  },
  async updateMe(req: Request, res: Response): Promise<void> {
    res.status(200).json(await memberService.updateProfile(req.user!.id, req.body as UpdateProfileInput));
  },
  async listAddresses(req: Request, res: Response): Promise<void> {
    res.status(200).json(await memberService.listAddresses(req.user!.id));
  },
  async addAddress(req: Request, res: Response): Promise<void> {
    res.status(201).json(await memberService.addAddress(req.user!.id, req.body as AddressInput));
  },
  async deleteAddress(req: Request, res: Response): Promise<void> {
    await memberService.deleteAddress(req.user!.id, req.params.id);
    res.status(204).send();
  },
};
