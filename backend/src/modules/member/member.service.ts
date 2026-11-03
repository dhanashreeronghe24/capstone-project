import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { Address, Prisma } from '@prisma/client';
import { env } from '../../config/env.config';
import { prisma } from '../../config/prisma.client';
import { AuthUser, RoleName, signAccessToken } from '../../middlewares/auth.middleware';
import { conflict, notFound, unauthorized } from '../../utils/http-error';
import {
  AddressInput,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
} from './member.schema';

const userWithRoles = Prisma.validator<Prisma.UserDefaultArgs>()({
  include: { roles: { include: { role: true } } },
});
type UserWithRoles = Prisma.UserGetPayload<typeof userWithRoles>;

const sha256 = (v: string): string => createHash('sha256').update(v).digest('hex');

const rolesOf = (u: UserWithRoles): RoleName[] => u.roles.map((r) => r.role.name as RoleName);

const toUserSummary = (u: UserWithRoles) => ({
  id: u.id,
  email: u.email,
  firstName: u.firstName,
  lastName: u.lastName,
  roles: rolesOf(u),
});

const toAddress = (a: Address) => ({
  id: a.id,
  recipientName: a.recipientName,
  phoneNumber: a.phoneNumber,
  addressLine1: a.addressLine1,
  addressLine2: a.addressLine2,
  city: a.city,
  state: a.state,
  postalCode: a.postalCode,
  country: a.country,
  isDefault: a.isDefault,
  createdAt: a.createdAt,
});

async function issueTokens(user: UserWithRoles) {
  const authUser: AuthUser = { id: user.id, email: user.email, roles: rolesOf(user) };
  const refreshToken = randomBytes(48).toString('hex');
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000),
    },
  });
  return {
    accessToken: signAccessToken(authUser),
    refreshToken,
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
  };
}

export const memberService = {
  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw conflict('An account with this email already exists');

    const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phoneNumber: input.phoneNumber,
        roles: {
          create: {
            role: {
              connectOrCreate: {
                where: { name: 'ROLE_CUSTOMER' },
                create: { name: 'ROLE_CUSTOMER', description: 'Registered customer' },
              },
            },
          },
        },
      },
      ...userWithRoles,
    });
    return { user: toUserSummary(user), tokens: await issueTokens(user) };
  },

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email: input.email }, ...userWithRoles });
    const ok = user && user.isActive && (await bcrypt.compare(input.password, user.passwordHash));
    if (!user || !ok) throw unauthorized('Invalid email or password');
    return { user: toUserSummary(user), tokens: await issueTokens(user) };
  },

  /** Rotates the refresh token: the presented one is revoked and a new pair is issued. */
  async refresh(refreshToken: string) {
    const record = await prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { user: userWithRoles },
    });
    if (!record || record.revokedAt || record.expiresAt < new Date() || !record.user.isActive) {
      throw unauthorized('Invalid or expired refresh token');
    }
    const revoked = await prisma.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count === 0) throw unauthorized('Refresh token already used');
    return issueTokens(record.user as unknown as UserWithRoles);
  },

  async logout(userId: string, refreshToken: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { ...userWithRoles.include, addresses: { orderBy: { createdAt: 'asc' } } },
    });
    if (!user) throw notFound('User not found');
    return {
      ...toUserSummary(user),
      phoneNumber: user.phoneNumber,
      rewardPoints: user.rewardPoints,
      addresses: user.addresses.map(toAddress),
    };
  },

  async updateProfile(userId: string, input: UpdateProfileInput) {
    await prisma.user.update({ where: { id: userId }, data: input });
    return this.getProfile(userId);
  },

  async listAddresses(userId: string) {
    const rows = await prisma.address.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
    return rows.map(toAddress);
  },

  async addAddress(userId: string, input: AddressInput) {
    const created = await prisma.$transaction(async (tx) => {
      const count = await tx.address.count({ where: { userId } });
      const makeDefault = input.isDefault || count === 0;
      if (makeDefault) {
        await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.address.create({ data: { ...input, isDefault: makeDefault, userId } });
    });
    return toAddress(created);
  },

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    const res = await prisma.address.deleteMany({ where: { id: addressId, userId } });
    if (res.count === 0) throw notFound('Address not found');
  },
};
