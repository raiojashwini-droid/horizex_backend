import { Request, Response, NextFunction } from 'express';
import { RentRollService } from './rentRoll.service';
import { sendSuccess } from '../../utils/apiResponse.util';

export const getAdminRentRoll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = (req.query.companyId as string) || req.user?.effectiveCompanyId || (req.headers['x-company-context'] as string);
    const buildingId = (req.query.buildingId as string) || (req.query.propertyId as string);

    const data = await RentRollService.getRentRollData({
      companyId: companyId && companyId !== 'all' ? companyId : null,
      buildingId: buildingId && buildingId !== 'all' ? buildingId : null,
    });

    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
};

export const updatePotentialRent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, type, potentialRent } = req.body;
    await RentRollService.updatePotentialRent({
      id,
      type,
      potentialRent: parseFloat(potentialRent),
    });

    return sendSuccess(res, { success: true, message: 'Potential rent updated successfully' });
  } catch (err) {
    return next(err);
  }
};

