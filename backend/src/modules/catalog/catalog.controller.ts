import { Request, Response } from 'express';
import { catalogService } from './catalog.service';
import { BookQuery, CreateBookInput, PageQuery, ReviewInput, UpdateBookInput } from './catalog.schema';

export const catalogController = {
  async listCategories(_req: Request, res: Response): Promise<void> {
    res.status(200).json(await catalogService.listCategories());
  },
  async searchBooks(req: Request, res: Response): Promise<void> {
    res.status(200).json(await catalogService.searchBooks(req.query as unknown as BookQuery));
  },
  async getBook(req: Request, res: Response): Promise<void> {
    res.status(200).json(await catalogService.getBook(req.params.id));
  },
  async getFeatured(_req: Request, res: Response): Promise<void> {
    res.status(200).json(await catalogService.getFeatured());
  },
  async getRelated(req: Request, res: Response): Promise<void> {
    res.status(200).json(await catalogService.getRelated(req.params.id));
  },
  async getAuthor(req: Request, res: Response): Promise<void> {
    res.status(200).json(await catalogService.getAuthor(req.params.id));
  },
  async createBook(req: Request, res: Response): Promise<void> {
    res.status(201).json(await catalogService.createBook(req.body as CreateBookInput));
  },
  async updateBook(req: Request, res: Response): Promise<void> {
    res.status(200).json(await catalogService.updateBook(req.params.id, req.body as UpdateBookInput));
  },
  async listReviews(req: Request, res: Response): Promise<void> {
    res.status(200).json(await catalogService.listReviews(req.params.id, req.query as unknown as PageQuery));
  },
  async createReview(req: Request, res: Response): Promise<void> {
    res.status(201).json(await catalogService.createReview(req.params.id, req.user!.id, req.body as ReviewInput));
  },
};
