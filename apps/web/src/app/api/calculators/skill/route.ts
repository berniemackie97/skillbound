import { NextResponse } from 'next/server';
import { isSkillName } from '@skillbound/domain';

import { getCalculatorDataForSkill } from '@/lib/calculators/skill-calculator-data';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const skillParam = (searchParams.get('skill') || '').toLowerCase();

  if (!isSkillName(skillParam)) {
    return NextResponse.json(
      {
        error: 'Invalid skill parameter',
      },
      { status: 400 }
    );
  }

  const data = await getCalculatorDataForSkill(skillParam);
  return NextResponse.json({
    data,
  });
}
