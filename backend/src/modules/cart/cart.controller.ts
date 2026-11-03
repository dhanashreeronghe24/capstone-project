import { Request, Response } from 'express';
import { AddCartItemInput, MergeCartInput, UpdateCartItemInput, WishlistAddInput } from './cart.schema';
import { CartOwner, cartService } from './cart.service';
import { wishlistService } from './wishlist.service';

const GUEST_HEADER = 'x-guest-session-id';

const ownerOf = (req: Request): CartOwner =>
  req.user ? { userId: req.user.id } : { guestSessionId: req.header(GUEST_HEADER) || undefined };

/** Echo the guest session token so anonymous clients can persist it. */
const withGuestHeader = (res: Response, view: { guestSessionId: string | null }): void => {
  if (view.guestSessionId) res.setHeader(GUEST_HEADER, view.guestSessionId);
};

export const cartController = {
  async getCart(req: Request, res: Response): Promise<void> {
    const view = await cartService.getCart(ownerOf(req));
    withGuestHeader(res, view);
    res.status(200).json(view);
  },
  async addItem(req: Request, res: Response): Promise<void> {
    const { bookId, quantity } = req.body as AddCartItemInput;
    const view = await cartService.addItem(ownerOf(req), bookId, quantity);
    withGuestHeader(res, view);
    res.status(201).json(view);
  },
  async updateItem(req: Request, res: Response): Promise<void> {
    const view = await cartService.updateItem(ownerOf(req), req.params.itemId, (req.body as UpdateCartItemInput).quantity);
    withGuestHeader(res, view);
    res.status(200).json(view);
  },
  async removeItem(req: Request, res: Response): Promise<void> {
    const view = await cartService.removeItem(ownerOf(req), req.params.itemId);
    withGuestHeader(res, view);
    res.status(200).json(view);
  },
  async merge(req: Request, res: Response): Promise<void> {
    res.status(200).json(await cartService.mergeGuestCart(req.user!.id, (req.body as MergeCartInput).guestSessionId));
  },
};

export const wishlistController = {
  async list(req: Request, res: Response): Promise<void> {
    res.status(200).json(await wishlistService.list(req.user!.id));
  },
  async add(req: Request, res: Response): Promise<void> {
    res.status(201).json(await wishlistService.add(req.user!.id, (req.body as WishlistAddInput).bookId));
  },
  async remove(req: Request, res: Response): Promise<void> {
    await wishlistService.remove(req.user!.id, req.params.bookId);
    res.status(204).send();
  },
  async moveToCart(req: Request, res: Response): Promise<void> {
    res.status(200).json(await wishlistService.moveToCart(req.user!.id, req.params.bookId));
  },
};
