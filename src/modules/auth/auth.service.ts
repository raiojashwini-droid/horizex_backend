import { prisma } from '../../config/db';
import { comparePassword, hashPassword } from '../../utils/password.util';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  TokenPayload,
} from '../../utils/jwt.util';
import { AppError } from '../../middlewares/errorHandler';
import { uploadBase64Image } from '../../config/cloudinary';

// In-memory cache for profile fields not stored in Prisma schema
const profileExtras: Record<string, any> = {};

export class AuthService {
  static async login(email: string, passwordPlain: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new AppError('Invalid credentials or account is deactivated', 401, 'INVALID_CREDENTIALS');
    }

    const isMatch = await comparePassword(passwordPlain, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid credentials or account is deactivated', 401, 'INVALID_CREDENTIALS');
    }

    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Save hashed refresh token in DB for rotation security
    const hashedRefresh = await hashPassword(refreshToken);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRefresh },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        companyId: user.companyId,
        company: user.company,
      },
    };
  }

  static async refresh(rawRefreshToken: string) {
    let payload: TokenPayload;
    try {
      payload = verifyRefreshToken(rawRefreshToken);
    } catch {
      throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || !user.isActive || !user.refreshToken) {
      throw new AppError('User not found or session revoked', 401, 'SESSION_REVOKED');
    }

    // Verify token against stored hash
    const isTokenValid = await comparePassword(rawRefreshToken, user.refreshToken);
    if (!isTokenValid) {
      // Possible replay attack detected! Wipe token from DB
      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: null },
      });
      throw new AppError('Token reuse detected. Please log in again', 401, 'TOKEN_REUSE_DETECTED');
    }

    // Generate rotated tokens
    const newPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };

    const newAccessToken = signAccessToken(newPayload);
    const newRefreshToken = signRefreshToken(newPayload);

    // Rotate stored hash
    const newHashed = await hashPassword(newRefreshToken);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newHashed },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  static async logout(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: true,
        staffProfile: true,
      },
    });

    if (!user || !user.isActive) {
      throw new AppError('User account not found or inactive', 404, 'USER_NOT_FOUND');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, refreshToken, ...userSafe } = user;
    return userSafe;
  }

  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: true,
        staffProfile: true,
      },
    });

    if (!user || !user.isActive) {
      throw new AppError('User account not found or inactive', 404, 'USER_NOT_FOUND');
    }

    // Attempt to load database-persisted extras from Note table
    let extraDb: any = {};
    try {
      const extraNote = await prisma.note.findFirst({
        where: { targetType: 'USER_PROFILE_EXTRA', targetId: userId },
      });
      if (extraNote?.content) {
        extraDb = JSON.parse(extraNote.content);
      }
    } catch (_) {}

    const extra = { ...extraDb, ...(profileExtras[userId] || {}) };
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      name: fullName || user.email.split('@')[0],
      phone: user.phone || extra.phone || '',
      role: user.role,
      city: extra.city || '',
      state: extra.state || '',
      country: extra.country || '',
      companyName: user.company?.name || extra.companyName || '',
      companyDetails: extra.companyDetails || '',
      profilePictureUrl: extra.profilePictureUrl || null,
    };
  }

  static async updateProfile(userId: string, data: any) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user || !user.isActive) {
      throw new AppError('User account not found or inactive', 404, 'USER_NOT_FOUND');
    }

    const updateData: any = {};
    if (data.firstName !== undefined && data.firstName !== '') updateData.firstName = data.firstName;
    if (data.lastName !== undefined && data.lastName !== '') updateData.lastName = data.lastName;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.password && String(data.password).length >= 6) {
      updateData.passwordHash = await hashPassword(data.password);
    }

    const updatedUser = Object.keys(updateData).length > 0
      ? await prisma.user.update({
          where: { id: userId },
          data: updateData,
          include: { company: true, staffProfile: true },
        })
      : user;

    if (user.companyId && data.companyName) {
      try {
        await prisma.company.update({
          where: { id: user.companyId },
          data: {
            name: data.companyName,
          },
        });
      } catch (e) {
        console.warn('Company profile sync notice:', e);
      }
    }

    // Cloudinary upload with safe fallback for dummy credentials
    let finalPhotoUrl = data.profilePictureUrl;
    if (data.profilePictureUrl && typeof data.profilePictureUrl === 'string' && data.profilePictureUrl.startsWith('data:image/')) {
      try {
        const cloudRes = await uploadBase64Image(data.profilePictureUrl, 'horizex_profiles');
        if (cloudRes?.url) {
          finalPhotoUrl = cloudRes.url;
        }
      } catch (cloudErr: any) {
        console.warn('Cloudinary upload notice (fallback active until credentials provided):', cloudErr?.message || cloudErr);
        finalPhotoUrl = data.profilePictureUrl;
      }
    }

    // Load existing database-persisted extras
    let existingExtraDb: any = {};
    let existingNote: any = null;
    try {
      existingNote = await prisma.note.findFirst({
        where: { targetType: 'USER_PROFILE_EXTRA', targetId: userId },
      });
      if (existingNote?.content) {
        existingExtraDb = JSON.parse(existingNote.content);
      }
    } catch (_) {}

    const extrasToSave = {
      ...existingExtraDb,
      ...(profileExtras[userId] || {}),
      city: data.city !== undefined ? data.city : (existingExtraDb.city || profileExtras[userId]?.city || ''),
      state: data.state !== undefined ? data.state : (existingExtraDb.state || profileExtras[userId]?.state || ''),
      country: data.country !== undefined ? data.country : (existingExtraDb.country || profileExtras[userId]?.country || ''),
      profilePictureUrl: finalPhotoUrl !== undefined ? finalPhotoUrl : (existingExtraDb.profilePictureUrl || profileExtras[userId]?.profilePictureUrl || null),
    };

    // Persist to PostgreSQL Note table
    try {
      if (existingNote) {
        await prisma.note.update({
          where: { id: existingNote.id },
          data: { content: JSON.stringify(extrasToSave) },
        });
      } else {
        await prisma.note.create({
          data: {
            authorId: userId,
            targetType: 'USER_PROFILE_EXTRA',
            targetId: userId,
            title: 'User Profile Extra',
            content: JSON.stringify(extrasToSave),
          },
        });
      }
    } catch (dbErr: any) {
      console.warn('Note extras database persistence notice:', dbErr?.message);
    }

    profileExtras[userId] = extrasToSave;

    const fullName = `${updatedUser.firstName || ''} ${updatedUser.lastName || ''}`.trim();
    return {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName || '',
      lastName: updatedUser.lastName || '',
      name: fullName || updatedUser.email.split('@')[0],
      phone: updatedUser.phone || '',
      role: updatedUser.role,
      city: extrasToSave.city,
      state: extrasToSave.state,
      country: extrasToSave.country,
      companyName: updatedUser.company?.name || '',
      profilePictureUrl: extrasToSave.profilePictureUrl || null,
    };
  }
}
