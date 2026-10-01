import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getLatestMr11Run } from '../../db/supabase';

const prisma = new PrismaClient();

export async function getVisualizationData(req: Request, res: Response) {
  const latestRun = await getLatestMr11Run(prisma);

  if (!latestRun || !Array.isArray(latestRun.records)) {
    return res.json({
      success: true,
      data: {
        kpi: { totalProjects: 0, totalSellingUSD: 0, totalOrderedM2: 0, totalProduced: 0 },
        designStatusCounts: {},
        streamDistribution: {},
      },
    });
  }

  const records = latestRun.records as Record<string, any>[];

  let totalSellingUSD = 0;
  let totalOrderedM2 = 0;
  let totalProduced = 0;
  const designStatusCounts: Record<string, number> = {};
  const streamDistribution: Record<string, number> = {};

  for (const r of records) {
    if (r['Final Selling Price (USD)']) totalSellingUSD += Number(r['Final Selling Price (USD)']) || 0;
    if (r['total quantity ordered m2']) totalOrderedM2 += Number(r['total quantity ordered m2']) || 0;
    if (r['produced qty']) totalProduced += Number(r['produced qty']) || 0;

    const ds = r['Formwork Design Status'] || 'Unassigned';
    designStatusCounts[ds] = (designStatusCounts[ds] || 0) + 1;

    const stream = r['Stream'] || 'Unassigned';
    streamDistribution[stream] = (streamDistribution[stream] || 0) + 1;
  }

  return res.json({
    success: true,
    data: {
      kpi: {
        totalProjects: records.length,
        totalSellingUSD: Math.round(totalSellingUSD),
        totalOrderedM2: Math.round(totalOrderedM2),
        totalProduced: Math.round(totalProduced),
      },
      designStatusCounts,
      streamDistribution,
    },
  });
}