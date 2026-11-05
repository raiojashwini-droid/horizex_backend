import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { sendSuccess } from '../../utils/apiResponse.util';
import { AppError } from '../../middlewares/errorHandler';

const COOKIE_NAME = 'refreshToken';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const { accessToken, refreshToken, user } = await AuthService.login(email, password);

    res.cookie(COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SEVEN_DAYS_MS,
    });

    return sendSuccess(res, { accessToken, user }, 200);
  } catch (err) {
    return next(err);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawRefreshToken = req.cookies[COOKIE_NAME];
    if (!rawRefreshToken) {
      throw new AppError('Refresh token cookie missing', 401, 'REFRESH_TOKEN_REQUIRED');
    }

    const { accessToken, refreshToken: newRefreshToken } = await AuthService.refresh(
      rawRefreshToken
    );

    res.cookie(COOKIE_NAME, newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SEVEN_DAYS_MS,
    });

    return sendSuccess(res, { accessToken }, 200);
  } catch (err) {
    return next(err);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user?.userId) {
      await AuthService.logout(req.user.userId);
    }

    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    return sendSuccess(res, { message: 'Logged out successfully' }, 200);
  } catch (err) {
    return next(err);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }
    const user = await AuthService.getMe(req.user.userId);
    return sendSuccess(res, user, 200);
  } catch (err) {
    return next(err);
  }
};

export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }
    const profile = await AuthService.getProfile(req.user.userId);
    return sendSuccess(res, profile, 200);
  } catch (err) {
    return next(err);
  }
};

export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }
    const profile = await AuthService.updateProfile(req.user.userId, req.body);
    return sendSuccess(res, { user: profile, message: 'Profile updated successfully' }, 200);
  } catch (err) {
    return next(err);
  }
};

